// CAIM — Cloud Functions
//
// 1) githubDeployProxy — Deploy do MVP na conta do OWNER (multi-tenant).
//    - Valida o Firebase ID Token do cliente.
//    - Busca o PAT do Owner no Google Secret Manager (nunca no frontend).
//    - Cria o repo, ativa o GitHub Pages e faz o commit/push dos arquivos.
//
// 2) gitCorsProxy — Proxy de CORS para o git push via isomorphic-git.
//
// Deploy:
//   cd functions && npm i
//   firebase functions:secrets:set GITHUB_OWNER_PAT
//   firebase deploy --only functions

const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Octokit } = require('octokit');

let adminApp = null;
function getAdmin() {
  if (!adminApp) adminApp = admin.initializeApp();
  return adminApp;
}

let secretsClient = null;
function getSecrets() {
  // lazy: criar clientes gRPC no top-level faz o deploy dar timeout na análise
  if (!secretsClient) {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    secretsClient = new SecretManagerServiceClient();
  }
  return secretsClient;
}

async function getSecret(name) {
  const projectId = process.env.GCLOUD_PROJECT;
  const [version] = await getSecrets().accessSecretVersion({
    name: `projects/${projectId}/secrets/${name}/versions/latest`,
  });
  return version.payload.data.toString('utf8').trim();
}

async function verifyAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new Error('Não autenticado');
  return getAdmin().auth().verifyIdToken(token);
}

// ---------- githubDeployProxy ----------

exports.githubDeployProxy = onRequest({ cors: true, maxInstances: 20 }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  try {
    const { uid } = await verifyAuth(req);
    const { projectName, files = [], description = 'MVP gerado pelo CAIM' } = req.body || {};

    if (!projectName) throw new Error('projectName obrigatório');
    if (!Array.isArray(files) || files.length === 0) throw new Error('files vazio');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(projectName)) {
      throw new Error('projectName inválido (use minúsculas, hífens, sem espaços)');
    }

    // PAT do OWNER — só existe aqui, no servidor (Secret Manager)
    const ownerPat = await getSecret('GITHUB_OWNER_PAT');
    const octokit = new Octokit({ auth: ownerPat });
    const owner = (await octokit.rest.users.getAuthenticated()).data.login;

    // 1) Criar repositório (se não existir)
    try {
      await octokit.rest.repos.createForAuthenticatedUser({ name: projectName, description, private: false });
    } catch (err) {
      if (err.status !== 422) throw err; // 422 = já existe (prossegue)
    }
    const { data: repoMeta } = await octokit.rest.repos.get({ owner, repo: projectName });
    const defaultBranch = repoMeta.default_branch || 'main';

    // 2) Escrever arquivos via Contents API (createOrUpdateFileContents).
    //    Motivo: a Git Data API (createBlob/createTree/createCommit) retorna
    //    409 "Git Repository is empty" em repos recém-criados (sem nenhum
    //    commit) — não funciona nem com createTree([]). A Contents API cria o
    //    commit inicial automaticamente e também atualiza arquivos existentes.
    for (const { path, content } of files) {
      let existingSha;
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo: projectName, path, ref: defaultBranch });
        if (Array.isArray(data)) throw new Error(`path é um diretório: ${path}`);
        existingSha = data.sha;
      } catch (err) {
        if (err.status !== 404) throw err; // 404 = arquivo novo (sem sha)
      }
      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo: projectName,
        path,
        message: `MVP (CAIM): ${path}`,
        content: Buffer.from(String(content), 'utf8').toString('base64'),
        branch: defaultBranch,
        ...(existingSha ? { sha: existingSha } : {}),
      });
    }

    // 3) Ativar GitHub Pages na branch default
    try {
      await octokit.rest.repos.createPagesSite({ owner, repo: projectName, source: { branch: defaultBranch, path: '/' } });
    } catch (err) {
      if (err.status !== 409) throw err; // 409 = já ativo
    }

    const url = `https://${owner}.github.io/${projectName}`;
    res.status(200).json({ ok: true, owner, project: projectName, url });
  } catch (err) {
    console.error('[githubDeployProxy]', err);
    res.status(400).json({ ok: false, error: err.message || 'Erro no deploy' });
  }
});

// ---------- gitCorsProxy (push via isomorphic-git) ----------

// Allowlist: o proxy só encaminha para endpoints GitHub (blinda contra uso
// do proxy como open-relay para minerar/atacar outras APIs).
const ALLOWED_GIT_HOSTS = [
  'https://api.github.com',
  'https://github.com',
  'https://raw.githubusercontent.com',
  'https://objects.githubusercontent.com',
  'https://codeload.github.com',
];

// Rate limit best-effort por instância (50 req/min padrão; owners 200 req/min).
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_OWNER_MAX = 200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const rateHits = new Map();

function isRateLimited(key, max = RATE_LIMIT_MAX) {
  const now = Date.now();
  const hits = (rateHits.get(key) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= max) {
    rateHits.set(key, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(key, hits);
  return false;
}

exports.gitCorsProxy = onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string') {
    res.status(400).send('Missing ?url');
    return;
  }

  // 1) Host allowlist
  let parsed;
  try {
    parsed = new URL(target);
  } catch (err) {
    res.status(400).send('Invalid ?url');
    return;
  }
  if (!ALLOWED_GIT_HOSTS.includes(parsed.origin)) {
    res.status(403).send('Host não permitido pelo proxy CAIM');
    return;
  }

  // 2) Rate limit: por usuário autenticado (se Bearer) senão por IP.
  //    Owners (role no Firestore) têm cota maior (200 req/min).
  const authHeader = req.headers.authorization || '';
  let rateKey;
  let rateMax = RATE_LIMIT_MAX;
  if (authHeader.startsWith('Bearer ')) {
    try {
      const { uid } = await verifyAuth(req);
      rateKey = `uid:${uid}`;
      const db = getAdmin().firestore();
      const snap = await db.doc(`users/${uid}`).get();
      if (snap.exists && snap.data().role === 'owner') rateMax = RATE_LIMIT_OWNER_MAX;
    } catch (err) {
      rateKey = `ip:${req.headers['x-forwarded-for'] || req.ip || 'unknown'}`;
    }
  } else {
    rateKey = `ip:${req.headers['x-forwarded-for'] || req.ip || 'unknown'}`;
  }
  if (isRateLimited(rateKey, rateMax)) {
    res.status(429).send(`Rate limit excedido (${rateMax} req/min). Tente novamente em instantes.`);
    return;
  }

  const method = typeof req.query.method === 'string' ? req.query.method : req.method;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (['host', 'content-length', 'connection', 'origin', 'accept-encoding'].includes(key)) continue;
    if (typeof value === 'string') headers[key] = value;
  }
  headers['user-agent'] = 'caim-git-proxy';

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : req.body,
    });
  } catch (err) {
    res.status(502).send(`Proxy upstream error: ${err.message}`);
    return;
  }

  const contentType = upstream.headers.get('content-type');
  if (contentType) res.set('content-type', contentType);
  res.status(upstream.status);
  res.send(Buffer.from(await upstream.arrayBuffer()));
});
