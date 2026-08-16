import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { OpenCodeDriver } from './drivers/opencode-driver.js';
import { ClineDriver } from './drivers/cline-driver.js';
import { toolExecutor } from './tool-executor.js';

export const AGENT_MODE = { DEMO: 'DEMO', LIVE: 'LIVE' };

// Endpoints OpenAI-compatible (base URL). Em Configurações o usuário pode
// sobrescrever a baseUrl (ex.: um proxy OpenCode) e o model.
const PROVIDERS = {
  deepseek: { url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
};

const SYSTEM_PROMPT = `Você é o agente de código do CAIM, um IDE mobile. O usuário pede um MVP.
Gere os arquivos necessários (index.html, style.css, script.js etc.) e responda EXCLUSIVAMENTE
em JSON válido, sem texto fora do bloco:

{"message":"resumo do que foi criado em português","files":[{"path":"index.html","content":"..."},{"path":"style.css","content":"..."}]}

Regras: paths sem barra inicial e sem ".."; conteúdo completo dos arquivos; sem markdown code fences.`;

const TIMEOUT_MS = 120000; // S8: timeout por chamada
const CONTEXT_CAP = 8000; // S7: limite do contexto injetado

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function slugify(text) {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30) || 'mvp'
  );
}

// S7: injeta os arquivos abertos no editor como contexto (com limite de bytes)
function buildSystemPrompt(contextFiles = []) {
  let ctx = '';
  if (contextFiles && contextFiles.length) {
    const parts = [];
    let total = 0;
    for (const { path, content } of contextFiles) {
      if (!path || typeof content !== 'string') continue;
      const chunk = content.slice(0, 4000);
      total += chunk.length;
      if (total > CONTEXT_CAP) break;
      parts.push(`### ${path}\n\`\`\`\n${chunk}\n\`\`\``);
    }
    if (parts.length) ctx = `\n\nArquivos abertos no editor (contexto):\n${parts.join('\n')}`;
  }
  return SYSTEM_PROMPT + ctx;
}

async function streamReader(res, { onChunk, onThinking } = {}) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  let thinking = '';
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta;
        if (delta?.reasoning_content) {
          thinking += delta.reasoning_content;
          onThinking?.(delta.reasoning_content);
        }
        if (delta?.content) {
          full += delta.content;
          onChunk?.(delta.content);
        }
      } catch (err) {
        // linha não-JSON (keep-alive) — ignora
      }
    }
  }
  return { full, thinking };
}

class AgentManager {
  constructor() {
    this.mode = AGENT_MODE.DEMO;
    this.driver = new OpenCodeDriver();
    this.contextFiles = [];
  }

  /** S6: trocar o driver de parsing (OpenCode JSON | Cline XML) */
  setDriver(driver) {
    this.driver = driver;
  }

  /** S7: arquivos abertos injetados no prompt de sistema */
  setContext(files) {
    this.contextFiles = Array.isArray(files) ? files : [];
  }

  async getLlmKeys(uid) {
    if (!uid) return [];
    const profile = await dbService.getUserProfile(uid);
    return (profile?.llm_keys || [])
      .filter((k) => k.active)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));
  }

  async sendPrompt({ text, uid, onChunk, onThinking, signal }) {
    if (this.mode === AGENT_MODE.DEMO) {
      return this.demoSend(text, onChunk);
    }
    const keys = await this.getLlmKeys(uid);
    if (!keys.length) {
      throw new Error('Nenhuma API de LLM configurada. Adicione em Configurações.');
    }
    const errors = [];
    for (const entry of keys) {
      const cfg = PROVIDERS[entry.provider];
      if (!cfg && !entry.baseUrl) continue;
      try {
        return await this.liveSend(text, entry, cfg, { onChunk, onThinking, signal });
      } catch (err) {
        if (err?.name === 'AbortError' && signal?.aborted) throw err; // usuário parou
        errors.push(`${entry.provider}: ${err.message}`);
      }
    }
    // S21: mensagem clara quando TODAS as chaves falham (não é erro de rede genérico)
    throw new Error(
      'Todas as suas chaves LLM falharam. Verifique saldos, permissões e o estado de cada chave em Configurações.' +
        (errors.length ? ` (${errors.join(' | ')})` : '')
    );
  }

  /**
   * S21/S26: mensagem amigável por status HTTP do provedor (não mostra código cru).
   */
  providerError(provider, status) {
    if (status === 402 || status === 429) {
      return `${provider}: saldo insuficiente ou limite atingido (${status}). Verifique a conta/cobrança na plataforma da chave.`;
    }
    if (status === 401 || status === 403) {
      return `${provider}: chave inválida ou sem permissão (${status}). Confira a chave em Configurações.`;
    }
    if (status === 404) {
      return `${provider}: modelo ou endpoint não encontrado (404). Confira o model/baseUrl.`;
    }
    if (status >= 500) {
      return `${provider}: erro do provedor (${status}). Tente novamente em instantes.`;
    }
    return `${provider}: erro HTTP ${status}`;
  }

  async liveSend(text, entry, cfg, { onChunk, onThinking, signal }) {
    const apiKey = await security.decrypt(entry.key);
    const baseUrl = (entry.baseUrl || cfg.url).replace(/\/+$/, '');
    const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: entry.model || cfg.model,
          stream: true,
          temperature: 0.2,
          messages: [
            { role: 'system', content: buildSystemPrompt(this.contextFiles) },
            { role: 'user', content: text },
          ],
        }),
      });
      if (!res.ok) {
        if (res.status === 429 || res.status >= 500) {
          await sleep(1200); // S8: backoff antes do failover
          throw new Error(this.providerError(entry.provider, res.status));
        }
        throw new Error(this.providerError(entry.provider, res.status));
      }
      const { full, thinking } = await streamReader(res, { onChunk, onThinking });
      const message = this.driver.extractMessage(full);
      const tools = this.driver.parseResponse(full);
      const truncated = typeof this.driver.detectTruncation === 'function' && this.driver.detectTruncation(full);
      const results = [];
      const created = [];
      const binaryWarnings = [];
      for (const t of tools) {
        try {
          if (t.tool === 'write_file' && /\.(png|jpe?g|gif|webp|pdf|zip|docx?|xlsx?|pptx?|ico)$/i.test(t.args.path || '')) {
            binaryWarnings.push(t.args.path);
            results.push(`AVISO: ${t.args.path} é binário — não suportado na geração (use upload).`);
            continue;
          }
          const r = await toolExecutor.execute(t.tool, t.args);
          results.push(r);
          if (t.tool === 'write_file') created.push(t.args.path);
        } catch (err) {
          results.push(`ERRO ${t.tool}: ${err.message}`);
        }
      }
      if (truncated) {
        results.push('⚠ resposta truncada: a saída do modelo foi cortada no meio. Use "Continuar geração".');
      }
      // S22: custo aproximado visível (caracteres / 4 ≈ tokens)
      const approxTokens = Math.ceil((buildSystemPrompt(this.contextFiles).length + text.length + full.length) / 4);
      return { message, files: created, results, thinking, truncated, approxTokens, binaryWarnings };
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /**
   * S21: valida uma chave LLM com um prompt mínimo antes de salvar no Settings.
   * Retorna { ok, error } — não lança (usado no botão "Testar" da UI).
   */
  async testConnection(entry) {
    const cfg = PROVIDERS[entry.provider];
    if (!cfg && !entry.baseUrl) return { ok: false, error: 'Provider desconhecido' };
    try {
      const apiKey = await security.decrypt(entry.key);
      const baseUrl = (entry.baseUrl || cfg.url).replace(/\/+$/, '');
      const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: entry.model || cfg.model,
            stream: false,
            max_tokens: 5,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        });
        if (res.ok) return { ok: true };
        if (res.status === 401 || res.status === 403) return { ok: false, error: 'Chave inválida ou sem permissão (401/403)' };
        if (res.status === 429) return { ok: false, error: 'Rate limit (429) — tente mais tarde' };
        if (res.status >= 500) return { ok: false, error: `Erro do provedor (${res.status})` };
        return { ok: false, error: `HTTP ${res.status}` };
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, error: 'Timeout — verifique a base URL' };
      return { ok: false, error: err.message || 'Falha na conexão' };
    }
  }

  async demoSend(text, onChunk) {
    const intro = `Entendido! Vou gerar um MVP para "${text}" (modo DEMO — configure APIs em Configurações para gerar de verdade). `;
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (i <= intro.length) {
          onChunk?.(intro.slice(0, i));
          i += 3;
          setTimeout(tick, 8);
        } else {
          const slug = slugify(text);
          const tools = [
            {
              tool: 'write_file',
              args: {
                path: `${slug}/index.html`,
                content: `<!DOCTYPE html>\n<html>\n<head><title>${text}</title></head>\n<body>\n  <h1>${text}</h1>\n  <p>MVP gerado pelo CAIM.</p>\n</body>\n</html>\n`,
              },
            },
            {
              tool: 'write_file',
              args: {
                path: `${slug}/style.css`,
                content: ':root { --accent: #2dd4bf; }\nbody { font-family: system-ui; background: #000; color: #e2e8f0; }\n',
              },
            },
            { tool: 'write_file', args: { path: `${slug}/script.js`, content: "console.log('MVP CAIM');\n" } },
          ];
          const created = [];
          const results = [];
          Promise.all(
            tools.map(async (t) => {
              try {
                const r = await toolExecutor.execute(t.tool, t.args);
                results.push(r);
                created.push(t.args.path);
              } catch (err) {
                results.push(`ERRO: ${err.message}`);
              }
            })
          ).then(() => resolve({ message: 'Arquivos criados no Explorer. Abra o Diff e depois publique!', files: created, results }));
        }
      };
      tick();
    });
  }
}

export const agentManager = new AgentManager();
export { ClineDriver, OpenCodeDriver };
