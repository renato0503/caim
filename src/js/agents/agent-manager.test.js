import { describe, it, expect, beforeEach, vi } from 'vitest';
import { agentManager, AGENT_MODE } from './agent-manager.js';

// S8/S14: failover multi-API por prioridade + filtro de chaves ativas.

vi.mock('../db/db-service.js', () => ({
  dbService: { getUserProfile: vi.fn() },
}));

vi.mock('../security/security-service.js', () => ({
  security: { decrypt: vi.fn() },
}));

import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';

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
    expect(security.decrypt).toHaveBeenCalledWith(profile.llm_keys[0].key);
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
