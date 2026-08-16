import { vfs } from '../core/vfs-service.js';
import { gitFs } from './vfs-fs.js';
import { security } from '../security/security-service.js';

/**
 * S2 — Git Service Engine (isomorphic-git + VFS adapter)
 * - Operações offline: init, status, add, commit, log.
 * - Rede: push via proxy CORS (github.com não permite CORS no protocolo git).
 * - GitHub REST (CORS habilitado): createGitHubRepo / enableGitHubPages.
 * - PAT cifrado via SecurityService (AES-GCM); só decifrado na hora do push.
 */

const GIT_DIR = '/';
const GITHUB_API = 'https://api.github.com';
export const GIT_CORS_PROXY = 'https://us-central1-cerraimobile.cloudfunctions.net/gitCorsProxy';

let _gitPromise = null;
function getGit() {
  _gitPromise ??= import('isomorphic-git');
  return _gitPromise;
}

function esc(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function describe(head, workdir, stage) {
  if (head === 0) return 'novo';
  if (workdir === 0) return 'excluído';
  if (stage === 0) return 'adicionado';
  if (workdir !== head) return 'modificado';
  if (stage !== head) return 'staged';
  return 'ok';
}

// Cliente HTTP do isomorphic-git → passa pelo proxy CORS (push)
const gitHttp = {
  async request({ url, method = 'GET', headers = {}, body }) {
    const res = await fetch(`${GIT_CORS_PROXY}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        ...headers,
      },
      body: body || undefined,
    });
    const buffer = await res.arrayBuffer();
    return {
      url,
      method,
      statusCode: res.status,
      statusMessage: res.statusText,
      headers: { 'content-type': res.headers.get('content-type') || '' },
      body: (async function* yieldBody() {
        yield new Uint8Array(buffer);
      })(),
    };
  },
};

class GitService {
  // ---------- Offline: init/status/add/commit/log ----------

  async isInitialized() {
    return vfs.exists('.git/HEAD');
  }

  async ensureInit() {
    const git = await getGit();
    if (await this.isInitialized()) return;
    await git.init({ fs: gitFs, dir: GIT_DIR, defaultBranch: 'main' });
  }

  async status() {
    const git = await getGit();
    await this.ensureInit();
    const matrix = await git.statusMatrix({ fs: gitFs, dir: GIT_DIR });
    return matrix
      .filter(([filepath]) => !filepath.startsWith('.git/'))
      .map(([filepath, head, workdir, stage]) => ({
        filepath,
        status: describe(head, workdir, stage),
      }))
      .filter((e) => e.status !== 'ok');
  }

  async addAll() {
    const git = await getGit();
    await this.ensureInit();
    const matrix = await git.statusMatrix({ fs: gitFs, dir: GIT_DIR });
    for (const [filepath] of matrix) {
      if (filepath.startsWith('.git/')) continue;
      await git.add({ fs: gitFs, dir: GIT_DIR, filepath });
    }
  }

  async commit(message) {
    const git = await getGit();
    return git.commit({
      fs: gitFs,
      dir: GIT_DIR,
      message,
      author: { name: 'CAIM', email: 'caim@cerra.app' },
    });
  }

  async log(depth = 10) {
    const git = await getGit();
    return git.log({ fs: gitFs, dir: GIT_DIR, depth });
  }

  async setRemote(url) {
    const git = await getGit();
    const remotes = await git.listRemotes({ fs: gitFs, dir: GIT_DIR });
    if (remotes.some((r) => r.remote === 'origin')) {
      await git.removeRemote({ fs: gitFs, dir: GIT_DIR, remote: 'origin' });
    }
    await git.addRemote({ fs: gitFs, dir: GIT_DIR, remote: 'origin', url });
  }

  async getRemote() {
    try {
      const git = await getGit();
      const remotes = await git.listRemotes({ fs: gitFs, dir: GIT_DIR });
      return remotes.find((r) => r.remote === 'origin')?.url || null;
    } catch (err) {
      return null;
    }
  }

  // ---------- Rede: push (via proxy CORS) ----------

  async push({ onProgress } = {}) {
    const git = await getGit();
    const url = await this.getRemote();
    if (!url) throw new Error('Sem remote configurado. Faça o deploy do MVP.');
    return git.push({
      fs: gitFs,
      dir: GIT_DIR,
      remote: 'origin',
      url,
      http: gitHttp,
      onProgress,
      onAuth: async () => ({
        username: 'x-access-token',
        password: await security.readSecret('github_pat'),
      }),
    });
  }

  // ---------- GitHub REST API (CORS direto) ----------

  async createGitHubRepo(name, description = '') {
    const pat = await security.readSecret('github_pat');
    if (!pat) throw new Error('Configure um PAT do GitHub primeiro');
    const res = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description, private: false, auto_init: false }),
    });
    if (!res.ok) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg.message || `Falha ao criar repositório (${res.status})`);
    }
    const json = await res.json();
    return {
      owner: json.owner.login,
      repo: json.name,
      htmlUrl: json.html_url,
      cloneUrl: json.clone_url,
    };
  }

  async enableGitHubPages(owner, repo, branch = 'main') {
    const pat = await security.readSecret('github_pat');
    if (!pat) throw new Error('Configure um PAT do GitHub primeiro');
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: { branch, path: '/' } }),
    });
    if (!res.ok && res.status !== 409) {
      const msg = await res.json().catch(() => ({}));
      throw new Error(msg.message || `Falha ao ativar Pages (${res.status})`);
    }
    return { owner, repo, branch, url: `https://${owner}.github.io/${repo}` };
  }

  // ---------- One-Click MVP Deploy (S2/S9) ----------

  async deployMvp({ name, description = '', commitMessage = 'Initial MVP', onStep } = {}) {
    if (!name || !name.trim()) throw new Error('Informe o nome do repositório');
    const repoName = esc(name);
    if (!repoName) throw new Error('Nome do repositório inválido');

    onStep?.('Inicializando repositório git');
    await this.ensureInit();

    onStep?.('Adicionando arquivos (git add)');
    await this.addAll();

    onStep?.('Commitando arquivos');
    await this.commit(commitMessage);

    onStep?.('Criando repositório no GitHub');
    const { owner, repo, cloneUrl } = await this.createGitHubRepo(repoName, description);

    onStep?.('Ativando GitHub Pages');
    const pages = await this.enableGitHubPages(owner, repo, 'main');

    onStep?.('Enviando para o GitHub (push)');
    await this.setRemote(cloneUrl || `https://github.com/${owner}/${repo}.git`);
    await this.push();

    onStep?.('Publicado!');
    return pages.url;
  }
}

export const gitService = new GitService();
