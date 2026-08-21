import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agentManager, AGENT_MODE, PERMISSION, isChitchat, chitchatReply } from './agent-manager.js';

// S8/S14: failover multi-API por prioridade + filtro de chaves ativas.
// S32: gate de intenção (chitchat não chama o LLM).
// S33: memória conversacional (histórico + listDir no prompt) + guard overwrite.
// S35: system prompt só com esquema (sem exemplo) + demo JSON válido.
// S42: autonomia (ask/review/auto), planos de execução e undo de tool calls.

vi.mock('../db/db-service.js', () => ({
  dbService: { getUserProfile: vi.fn() },
}));

vi.mock('../security/security-service.js', () => ({
  security: { decrypt: vi.fn(), decryptForUser: vi.fn(), encryptForUser: vi.fn() },
}));

vi.mock('../core/vfs-service.js', () => ({
  vfs: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    listDir: vi.fn(),
    deleteFile: vi.fn(),
    db: { metadata: { get: vi.fn(), put: vi.fn() } },
  },
}));

import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { vfs } from '../core/vfs-service.js';

function sseStream(text) {
  const encoder = new TextEncoder();
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
  const chunks = [`data: ${payload}\n\n`, 'data: [DONE]\n\n'];
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

// SSE com reasoning_content primeiro (modo "Pensar"), depois o conteúdo final.
function sseStreamWithThinking(text, thinkingText) {
  const encoder = new TextEncoder();
  const payloads = [
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: thinkingText } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
    'data: [DONE]\n\n',
  ];
  return new ReadableStream({
    start(controller) {
      for (const c of payloads) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

function okResponse() {
  return new Response(sseStream('{"message":"ok","files":[]}'), { status: 200 });
}

function statusResponse(status) {
  return new Response('', { status });
}

const encrypted = (iv, ct) => ({ iv, ciphertext: ct });

beforeEach(() => {
  vi.clearAllMocks();
  agentManager.mode = AGENT_MODE.LIVE;
  security.decrypt.mockResolvedValue('sk-mock');
  security.decryptForUser.mockResolvedValue('sk-mock');
  // S35/executor: vfs.writeFile deve devolver o shape que o ToolExecutor usa.
  vfs.writeFile.mockResolvedValue({ created: true });
});

describe('AgentManager — failover e chaves (S8/S14)', () => {
  it('chave 1 com 401 → cai na chave 2 (ordem de prioridade)', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
        { provider: 'qwen', key: encrypted('b', 'ct2'), baseUrl: '', model: '', priority: 2, active: true },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(401))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const result = await agentManager.sendPrompt({ text: 'crie um app', uid: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('dashscope.aliyuncs.com');
    expect(result.message).toBe('ok');
  });

  it('chave 2 com 429 → backoff e cai na chave 3', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
        { provider: 'qwen', key: encrypted('b', 'ct2'), baseUrl: '', model: '', priority: 2, active: true },
        { provider: 'openai', key: encrypted('c', 'ct3'), baseUrl: '', model: '', priority: 3, active: true },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(statusResponse(429))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const result = await agentManager.sendPrompt({ text: 'x', uid: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toContain('api.openai.com');
    expect(result.message).toBe('ok');
  }, 15000);

  it('chave desativada não entra no failover', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: false },
        { provider: 'qwen', key: encrypted('b', 'ct2'), baseUrl: '', model: '', priority: 2, active: true },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const result = await agentManager.sendPrompt({ text: 'x', uid: 'u1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('dashscope.aliyuncs.com');
    expect(result.message).toBe('ok');
  });

  it('todas as chaves falham → erro claro com as causas', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
      ],
    });
    globalThis.fetch = vi.fn().mockResolvedValue(statusResponse(401));
    await expect(agentManager.sendPrompt({ text: 'x', uid: 'u1' })).rejects.toThrow(
      /Todas as suas chaves LLM falharam/
    );
  });

  it('testConnection valida chave válida', async () => {
    const { security } = await import('../security/security-service.js');
    security.decrypt.mockResolvedValue('sk-ok');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await agentManager.testConnection({
      provider: 'deepseek',
      key: encrypted('a', 'ct1'),
      baseUrl: '',
      model: '',
    });
    expect(res.ok).toBe(true);
  });

  it('testConnection reporta 401 como chave inválida', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(statusResponse(401));
    const res = await agentManager.testConnection({
      provider: 'deepseek',
      key: encrypted('a', 'ct1'),
      baseUrl: '',
      model: '',
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('401');
  });

  it('providerError é amigável para saldo insuficiente (402)', async () => {
    const err = agentManager.providerError('deepseek', 402);
    expect(err).toContain('saldo insuficiente');
    expect(err).not.toMatch(/^deepseek 402$/);
  });

  it('providerError amigável para chave inválida e erro do provedor', async () => {
    expect(agentManager.providerError('qwen', 401)).toContain('chave inválida');
    expect(agentManager.providerError('openai', 500)).toContain('erro do provedor');
    expect(agentManager.providerError('deepseek', 404)).toContain('modelo');
  });

  it('ordena por prioridade e ignora baseUrl quando provider conhecido', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'openai', key: encrypted('c', 'ct3'), baseUrl: '', model: '', priority: 3, active: true },
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
      ],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(statusResponse(401))
      .mockResolvedValueOnce(okResponse());
    globalThis.fetch = fetchMock;

    const result = await agentManager.sendPrompt({ text: 'x', uid: 'u1' });
    expect(fetchMock.mock.calls[0][0]).toContain('api.deepseek.com');
    expect(result.message).toBe('ok');
  });

  it('decifra a chave só no momento da chamada (nunca texto puro no storage)', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
      ],
    });
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    globalThis.fetch = fetchMock;
    const profile = await dbService.getUserProfile('u1');
    expect(profile.llm_keys[0].key.ciphertext).not.toContain('sk-');
    await agentManager.sendPrompt({ text: 'x', uid: 'u1' });
    expect(security.decryptForUser).toHaveBeenCalledWith('u1', profile.llm_keys[0].key);
  });
});

describe('AgentManager — streaming, thinking, contexto e abort (S15/J3)', () => {
  const oneKey = () =>
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [{ provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }],
    });

  it('streama chunks e thinking (reasoning_content) via callbacks', async () => {
    oneKey();
    const json = '{"message":"MVP criado","files":[{"path":"index.html","content":"<h1>Oi</h1>"}]}';
    const body = sseStreamWithThinking(json, 'vou criar a estrutura…');
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));

    const chunks = [];
    const thinking = [];
    const result = await agentManager.sendPrompt({
      text: 'crie um site',
      uid: 'u1',
      onChunk: (c) => chunks.push(c),
      onThinking: (c) => thinking.push(c),
    });
    expect(chunks.join('')).toBe(json);
    expect(thinking.join('')).toBe('vou criar a estrutura…');
    expect(result.thinking).toBe('vou criar a estrutura…');
    expect(result.message).toBe('MVP criado');
    expect(result.files).toEqual(['index.html']);
    expect(result.truncated).toBe(false);
  });

  it('detecta truncamento (resposta cortada no meio do JSON)', async () => {
    oneKey();
    const cut = '{"message":"parcial","files":[{"path":"a.js","content":"const x = 1;';
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(sseStream(cut), { status: 200 }));

    const result = await agentManager.sendPrompt({ text: 'x', uid: 'u1' });
    expect(result.truncated).toBe(true);
  });

  it('injeta o contexto dos arquivos abertos no prompt de sistema', async () => {
    oneKey();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse());
    agentManager.setContext([
      { path: 'src/app.js', content: 'export const a = 1;' },
      { path: 'src/b.js', content: 'export const b = 2;' },
    ]);
    await agentManager.sendPrompt({ text: 'mude app.js', uid: 'u1' });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('src/app.js');
    expect(body.messages[0].content).toContain('export const a = 1;');
    expect(body.messages[0].content).toContain('src/b.js');
    agentManager.setContext([]);
  });

  it('repassa AbortError quando o usuário para a geração', async () => {
    oneKey();
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation((url, opts) => {
      return new Promise((resolve, reject) => {
        opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    });
    globalThis.fetch = fetchMock;
    const promise = agentManager.sendPrompt({ text: 'x', uid: 'u1', signal: controller.signal });
    // Espera o fetch ser iniciado (e o listener de abort ser registrado)
    // antes de abortar — caso contrário o abort acontece sem listener.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

// ============================================================
// S32 — Gate de intenção: chitchat não chama o LLM nem toca o VFS
// ============================================================

describe('AgentManager — gate de intenção chitchat (S32)', () => {
  it('isChitchat reconhece saudações e agradecimentos', () => {
    for (const s of ['oi', 'olá', 'Ola!', 'bom dia', 'obrigado', 'valeu', 'ok', 'tudo bem?', 'hey', 'ola, tudo bem?', 'bom dia, como vai?', 'oi tudo bem', 'Obrigada!']) {
      expect(isChitchat(s)).toBe(true);
    }
    expect(isChitchat('crie um site de currículo')).toBe(false);
    expect(isChitchat('me de os arquivos')).toBe(false);
    expect(isChitchat('bom dia, quero um site de currículo')).toBe(false);
  });

  it('"ola, tudo bem?" responde texto sem chamar o LLM nem criar arquivos', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [{ provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }],
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    vfs.writeFile.mockClear();

    const result = await agentManager.sendPrompt({ text: 'ola, tudo bem?', uid: 'u1' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vfs.writeFile).not.toHaveBeenCalled();
    expect(result.files).toEqual([]);
    expect(result.message).toContain('Olá');
  });

  it('chitchatReply tem shape estável (zero tools)', () => {
    const reply = chitchatReply();
    expect(reply.files).toEqual([]);
    expect(reply.results).toEqual([]);
    expect(reply.overwrites).toEqual([]);
    expect(typeof reply.message).toBe('string');
  });
});

// ============================================================
// S33 — Memória conversacional: histórico + estado do VFS no prompt
// ============================================================

describe('AgentManager — memória conversacional (S33)', () => {
  const oneKey = () =>
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [{ provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }],
    });

  it('injeta o histórico recente no system prompt', async () => {
    oneKey();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse());
    const history = [
      { type: 'user', text: 'crie um currículo' },
      { type: 'assistant', text: 'Criei index.html, style.css, script.js' },
    ];
    await agentManager.sendPrompt({ text: 'me de os arquivos', uid: 'u1', history, filesList: [] });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    const sys = body.messages[0].content;
    expect(sys).toContain('Histórico recente da conversa');
    expect(sys).toContain('crie um currículo');
    expect(sys).toContain('Criei index.html, style.css, script.js');
  });

  it('injeta a lista de arquivos do VFS no system prompt', async () => {
    oneKey();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse());
    await agentManager.sendPrompt({
      text: 'adicione um contato',
      uid: 'u1',
      history: [],
      filesList: ['index.html', 'style.css', 'script.js'],
    });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('Arquivos que já existem no VFS');
    expect(body.messages[0].content).toContain('index.html');
  });

  it('sinaliza sobrescrita de arquivo pré-existente no resultado', async () => {
    oneKey();
    const json = '{"message":"atualizei","files":[{"path":"index.html","content":"<h1>novo</h1>"}]}';
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(sseStream(json), { status: 200 }));
    const result = await agentManager.sendPrompt({
      text: 'atualize o index.html',
      uid: 'u1',
      history: [],
      filesList: ['index.html'],
    });
    expect(result.overwrites).toContain('index.html');
  });

  it('não sinaliza sobrescrita para arquivo novo', async () => {
    oneKey();
    const json = '{"message":"novo","files":[{"path":"app.js","content":"x"}]}';
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(sseStream(json), { status: 200 }));
    const result = await agentManager.sendPrompt({
      text: 'crie app.js',
      uid: 'u1',
      history: [],
      filesList: ['index.html'],
    });
    expect(result.overwrites).toEqual([]);
  });
});

// ============================================================
// S35 — Geração robusta: demo com JSON.stringify + system prompt só esquema
// ============================================================

describe('AgentManager — geração robusta (S35)', () => {
  it('system prompt NÃO contém exemplo completo de arquivo (evita few-shot leakage)', async () => {
    const oneKey = () =>
      dbService.getUserProfile.mockResolvedValue({
        llm_keys: [{ provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }],
      });
    oneKey();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse());
    await agentManager.sendPrompt({ text: 'crie um site', uid: 'u1' });
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    const sys = body.messages[0].content;
    expect(sys).not.toMatch(/<button id="botao">/); // não contém o template do MVP antigo
    expect(sys).not.toMatch(/"content":"\.\.\."/); // só o esquema, sem conteúdo de exemplo
  });

  it('demo gera arquivos com HTML válido (DOCTYPE + tags fechadas) e rótulo [MODO DEMO]', async () => {
    agentManager.mode = AGENT_MODE.DEMO;
    const created = [];
    vfs.writeFile.mockImplementation(async (path, content) => {
      created.push({ path, content });
      return { created: true };
    });
    const result = await agentManager.sendPrompt({ text: 'site de teste', uid: 'u1' });
    expect(result.message).toContain('[MODO DEMO]');
    const idx = created.find((c) => c.path.endsWith('/index.html'));
    expect(idx).toBeTruthy();
    expect(idx.content).toContain('<!DOCTYPE html>');
    expect(idx.content).toContain('<body>');
    expect(idx.content).toContain('</html>');
    // paths isolados em subpasta (não pisa na raiz)
    expect(created.some((c) => c.path.startsWith('site-de-teste/'))).toBe(true);
    agentManager.mode = AGENT_MODE.LIVE;
  });
});

// ============================================================
// S42 — Autonomia (ask/review/auto), planos e undo de tool calls
// ============================================================

describe('AgentManager — autonomia e planos de execução (S42)', () => {
  const oneKey = () =>
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [{ provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }],
    });

  const responseWithFiles = () => {
    const json = '{"message":"plano pronto","files":[{"path":"a.txt","content":"aaa"},{"path":"b.txt","content":"bbb"}]}';
    return new Response(sseStream(json), { status: 200 });
  };

  beforeEach(() => {
    agentManager.permission = PERMISSION.REVIEW;
    agentManager.beginUndo();
    vfs.readFile.mockReset();
    vfs.readFile.mockRejectedValue(new Error('not found')); // default: arquivo novo
    vfs.deleteFile.mockReset();
    vfs.writeFile.mockReset();
    vfs.writeFile.mockResolvedValue({ created: true });
    vfs.db.metadata.get.mockReset();
    vfs.db.metadata.put.mockReset();
  });

  it('setPermissionForProject muda o modo e persiste em metadata', async () => {
    const perm = await agentManager.setPermissionForProject('proj-1', PERMISSION.ASK);
    expect(perm).toBe(PERMISSION.ASK);
    expect(vfs.db.metadata.put).toHaveBeenCalledWith({ key: 'agent-permission:proj-1', value: { mode: 'ask' } });
    expect(agentManager.getPermission()).toBe(PERMISSION.ASK);
  });

  it('setPermissionForProject rejeita modo inválido', async () => {
    await expect(agentManager.setPermissionForProject('p', 'nao-existe')).rejects.toThrow(/inválido/);
  });

  it('loadPermission carrega a permissão salva do projeto', async () => {
    vfs.db.metadata.get.mockResolvedValue({ key: 'agent-permission:proj-1', value: { mode: 'auto' } });
    const perm = await agentManager.loadPermission('proj-1');
    expect(perm).toBe(PERMISSION.AUTO);
    expect(agentManager.getPermission()).toBe(PERMISSION.AUTO);
  });

  it('loadPermission sem projeto reseta para review', async () => {
    agentManager.permission = PERMISSION.ASK;
    const perm = await agentManager.loadPermission(null);
    expect(perm).toBe(PERMISSION.REVIEW);
  });

  it('modo ask NÃO executa tools — devolve o plano para aprovação', async () => {
    oneKey();
    await agentManager.setPermissionForProject('p', PERMISSION.ASK);
    globalThis.fetch = vi.fn().mockResolvedValue(responseWithFiles());

    const result = await agentManager.sendPrompt({ text: 'crie dois arquivos', uid: 'u1' });
    expect(result.plan).toBeTruthy();
    expect(result.plan.tools).toHaveLength(2);
    expect(result.plan.tools[0].args.path).toBe('a.txt');
    expect(vfs.writeFile).not.toHaveBeenCalled();
    expect(result.files).toEqual([]);
  });

  it('executePlan executa tudo (Aprovar tudo) e grava os arquivos', async () => {
    const plan = {
      message: 'plano',
      filesList: [],
      tools: [
        { tool: 'write_file', args: { path: 'a.txt', content: 'aaa' } },
        { tool: 'write_file', args: { path: 'b.txt', content: 'bbb' } },
      ],
    };
    const res = await agentManager.executePlan(plan);
    expect(res.planDone).toBe(true);
    expect(res.files.sort()).toEqual(['a.txt', 'b.txt']);
    expect(vfs.writeFile).toHaveBeenCalledTimes(2);
  });

  it('executePlan com { only } executa UM passo (Aprovar passo)', async () => {
    const plan = {
      message: 'plano',
      filesList: [],
      tools: [
        { tool: 'write_file', args: { path: 'a.txt', content: 'aaa' } },
        { tool: 'write_file', args: { path: 'b.txt', content: 'bbb' } },
      ],
    };
    const res = await agentManager.executePlan(plan, { only: 1 });
    expect(res.files).toEqual(['b.txt']);
    expect(vfs.writeFile).toHaveBeenCalledTimes(1);
    expect(vfs.writeFile.mock.calls[0][0]).toBe('b.txt');
  });

  it('undoLastPlan restaura o conteúdo anterior byte a byte', async () => {
    const plan = {
      message: 'plano',
      filesList: [],
      tools: [{ tool: 'write_file', args: { path: 'a.txt', content: 'novo' } }],
    };
    vfs.readFile.mockResolvedValueOnce({ content: 'antigo' });
    await agentManager.executePlan(plan);
    expect(vfs.writeFile).toHaveBeenCalledWith('a.txt', 'novo');

    vfs.writeFile.mockClear();
    const restored = await agentManager.undoLastPlan();
    expect(restored).toEqual(['a.txt (restaurado)']);
    expect(vfs.writeFile).toHaveBeenCalledWith('a.txt', 'antigo', { silent: true });
  });

  it('undoLastPlan remove arquivos que não existiam antes', async () => {
    const plan = {
      message: 'plano',
      filesList: [],
      tools: [{ tool: 'write_file', args: { path: 'novo.txt', content: 'x' } }],
    };
    await agentManager.executePlan(plan);
    const restored = await agentManager.undoLastPlan();
    expect(restored).toEqual(['novo.txt (removido)']);
    expect(vfs.deleteFile).toHaveBeenCalledWith('novo.txt', { silent: true });
  });

  it('modo auto executa tools inline (sem plano) como o review', async () => {
    oneKey();
    await agentManager.setPermissionForProject('p', PERMISSION.AUTO);
    globalThis.fetch = vi.fn().mockResolvedValue(responseWithFiles());
    const result = await agentManager.sendPrompt({ text: 'crie', uid: 'u1' });
    expect(result.files.sort()).toEqual(['a.txt', 'b.txt']);
    expect(vfs.writeFile).toHaveBeenCalledTimes(2);
  });

  it('modo review (padrão) executa tools inline e mantém o comportamento atual', async () => {
    oneKey();
    agentManager.permission = PERMISSION.REVIEW;
    globalThis.fetch = vi.fn().mockResolvedValue(responseWithFiles());
    const result = await agentManager.sendPrompt({ text: 'crie', uid: 'u1' });
    expect(result.plan).toBeUndefined();
    expect(result.files.sort()).toEqual(['a.txt', 'b.txt']);
  });
});
