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

  it('todas as chaves falham → erro de failover com as causas', async () => {
    dbService.getUserProfile.mockResolvedValue({
      llm_keys: [
        { provider: 'deepseek', key: encrypted('a', 'ct1'), baseUrl: '', model: '', priority: 1, active: true },
      ],
    });
    globalThis.fetch = vi.fn().mockResolvedValue(statusResponse(401));
    await expect(agentManager.sendPrompt({ text: 'x', uid: 'u1' })).rejects.toThrow(/failover/);
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
