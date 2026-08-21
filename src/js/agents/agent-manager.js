import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { OpenCodeDriver } from './drivers/opencode-driver.js';
import { ClineDriver } from './drivers/cline-driver.js';
import { toolExecutor } from './tool-executor.js';
import { vfs } from '../core/vfs-service.js';

export const AGENT_MODE = { DEMO: 'DEMO', LIVE: 'LIVE' };

// S42 — modos de autonomia do agente (por projeto, persistido em metadata).
export const PERMISSION = { ASK: 'ask', REVIEW: 'review', AUTO: 'auto' };

// Endpoints OpenAI-compatible (base URL). Em Configurações o usuário pode
// sobrescrever a baseUrl (ex.: um proxy OpenCode) e o model.
const PROVIDERS = {
  deepseek: { url: 'https://api.deepseek.com', model: 'deepseek-chat' },
  qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  nvidia: { url: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct' },
  groq: { url: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  opencode: { url: '', model: 'default' }, // proxy OpenAI-compatible — preencher baseUrl no Settings
};

// S35: system prompt SEM exemplo completo de arquivo — apenas o esquema.
// Exemplo completo causava few-shot leakage (o modelo copiava o MVP do botão
// em vez de seguir o pedido do usuário).
const SYSTEM_PROMPT = `Você é o agente de código do CAIM, um IDE mobile. O usuário pede um MVP.
Gere os arquivos necessários (index.html, style.css, script.js etc.) e responda EXCLUSIVAMENTE
com um único JSON válido, sem texto fora do bloco e sem markdown code fences, no formato:

{"message":"resumo do que foi criado em português","files":[{"path":"nome-do-arquivo.ext","content":"conteúdo completo do arquivo"}]}

Regras:
- paths sem barra inicial e sem "..";
- "content" deve ter o conteúdo COMPLETO e válido do arquivo (tags HTML fechadas, aspas do JSON escapadas com \\");
- nunca repita exemplos nem use templates genéricos: siga exatamente o pedido do usuário;
- imagens/placeholders: NÃO use serviços externos como via.placeholder.com, placehold.co, picsum.photos (bloqueados por CSP no preview). Use SVG inline ou data URI embutidos no próprio HTML;
- se o usuário só conversar (saudações, agradecimentos), responda com {"message":"...","files":[]}.`;

// S32: saudações/agradecimentos não devem disparar geração de arquivos.
// Aceita combinações ("ola, tudo bem?", "bom dia, como vai?") — não só a
// saudação pura ancorada no fim da string (bug: "ola, tudo bem?" não casava).
// Funciona sobre a string normalizada (minúscula, pontuação removida),
// permitindo 1–3 tokens de chitchat ("ola", "tudo bem", "obrigada").
const CHITCHAT_RE =
  /^((oi|olá|ola|hey|eai|e ai|bom dia|boa tarde|boa noite|obrigad[oa]|valeu|obg|ok|okay|certo|entendi|tudo bem|td bem|como vai|como você está|bem e vc|bem e você)[\s,.;:!?]*){1,3}$/i;

export function isChitchat(text) {
  const normalized = (text || '')
    .trim()
    .toLowerCase()
    .replace(/[!.,?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  return CHITCHAT_RE.test(normalized);
}

// S32: resposta textual para chitchat — zero tools, zero chamada de LLM.
export function chitchatReply() {
  return {
    message: 'Olá! 👋 Me diga o que você quer construir.',
    files: [],
    results: [],
    thinking: '',
    truncated: false,
    approxTokens: 0,
    binaryWarnings: [],
    overwrites: [],
  };
}

const TIMEOUT_MS = 120000; // S8: timeout por chamada
const CONTEXT_CAP = 8000; // S7: limite do contexto injetado

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// S42: extensões binárias que a geração não suporta (upload cobre).
function isBinaryPath(path) {
  return /\.(png|jpe?g|gif|webp|pdf|zip|docx?|xlsx?|pptx?|ico)$/i.test(path || '');
}

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
// S33: adiciona histórico recente da conversa + estado do VFS (paths raiz) —
// resolve "me de os arquivos" e impede regenerar/sobrescrever projetos.
function buildSystemPrompt(contextFiles = [], { history = [], filesList = [] } = {}) {
  let ctx = '';
  if (history && history.length) {
    const recent = history
      .slice(-6)
      .map((h) => `${h.type === 'user' ? 'Usuário' : 'Assistente'}: ${String(h.text || '').slice(0, 400)}`)
      .join('\n');
    if (recent.trim()) ctx += `\n\nHistórico recente da conversa:\n${recent}`;
  }
  if (filesList && filesList.length) {
    ctx += `\n\nArquivos que já existem no VFS (NÃO sobrescreva sem necessidade):\n${filesList.join('\n')}`;
  }
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
    if (parts.length) ctx += `\n\nArquivos abertos no editor (contexto):\n${parts.join('\n')}`;
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
    // S42: autonomia (ask/review/auto) + rastreio p/ undo de tool calls.
    this.permission = PERMISSION.REVIEW;
    this.activeProjectId = null;
    this.undoStack = [];
  }

  /** S6: trocar o driver de parsing (OpenCode JSON | Cline XML) */
  setDriver(driver) {
    this.driver = driver;
  }

  /** S7: arquivos abertos injetados no prompt de sistema */
  setContext(files) {
    this.contextFiles = Array.isArray(files) ? files : [];
  }

  // ---- S42 — autonomia (permissão por projeto) ----

  setActiveProjectId(id) {
    this.activeProjectId = id || null;
  }

  getPermission() {
    return this.permission;
  }

  // Carrega a permissão salva do projeto ativo (metadata `agent-permission:<id>`).
  async loadPermission(projectId) {
    if (!projectId) {
      this.permission = PERMISSION.REVIEW;
      return this.permission;
    }
    try {
      const rec = await vfs.db.metadata.get(`agent-permission:${projectId}`);
      this.permission = rec?.value?.mode || PERMISSION.REVIEW;
    } catch (err) {
      this.permission = PERMISSION.REVIEW;
    }
    return this.permission;
  }

  async setPermissionForProject(projectId, mode) {
    if (!Object.values(PERMISSION).includes(mode)) throw new Error('Modo de permissão inválido');
    this.permission = mode;
    if (projectId) {
      await vfs.db.metadata.put({ key: `agent-permission:${projectId}`, value: { mode } });
    }
    return this.permission;
  }

  // ---- S42 — undo de tool calls ----

  beginUndo() {
    this.undoStack = [];
  }

  // Restaura o estado anterior de TODAS as tool calls desta rodada.
  async undoLastPlan() {
    const changes = [...this.undoStack];
    this.undoStack = [];
    const restored = [];
    for (const ch of changes) {
      try {
        if (ch.before == null) {
          await vfs.deleteFile(ch.path, { silent: true });
          restored.push(`${ch.path} (removido)`);
        } else {
          await vfs.writeFile(ch.path, ch.before, { silent: true });
          restored.push(`${ch.path} (restaurado)`);
        }
      } catch (err) {
        restored.push(`${ch.path}: erro ao reverter (${err.message})`);
      }
    }
    return restored;
  }

  async getLlmKeys(uid) {
    if (!uid) return [];
    const profile = await dbService.getUserProfile(uid);
    return (profile?.llm_keys || [])
      .filter((k) => k.active)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99));
  }

  async sendPrompt({ text, uid, onChunk, onThinking, signal, history = [], filesList = [] }) {
    // S32: gate de intenção — chitchat não chama o LLM nem toca o VFS.
    if (isChitchat(text)) return chitchatReply();
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
      // provider sem URL padrão (ex.: opencode) exige baseUrl no Settings
      if ((!cfg || !cfg.url) && !entry.baseUrl) continue;
      try {
        return await this.liveSend(text, entry, cfg, { uid, onChunk, onThinking, signal, history, filesList });
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

  // Decifra a chave de um entry LLM. Com uid, usa a chave derivada do usuário
  // (compatível com o Admin SDK); sem uid, usa a master key local.
  async decryptKey(uid, entry) {
    if (uid) return security.decryptForUser(uid, entry.key);
    return security.decrypt(entry.key);
  }

  async liveSend(text, entry, cfg, { uid, onChunk, onThinking, signal, history = [], filesList = [] }) {
    const apiKey = await this.decryptKey(uid, entry);
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
            { role: 'system', content: buildSystemPrompt(this.contextFiles, { history, filesList }) },
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
      // S42: modo `ask` — NÃO executa; devolve o plano para o usuário aprovar.
      if (this.permission === PERMISSION.ASK) {
        return {
          message,
          files: [],
          results: [],
          thinking,
          truncated,
          approxTokens: Math.ceil((buildSystemPrompt(this.contextFiles, { history, filesList }).length + text.length + full.length) / 4),
          binaryWarnings: [],
          overwrites: [],
          plan: { message, tools, filesList },
        };
      }
      this.beginUndo();
      const executed = await this.executeTools(tools, { filesList, truncated });
      // S22: custo aproximado visível (caracteres / 4 ≈ tokens)
      const approxTokens = Math.ceil((buildSystemPrompt(this.contextFiles, { history, filesList }).length + text.length + full.length) / 4);
      return { message, ...executed, thinking, truncated, approxTokens };
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  // S42 — executa uma lista de tool calls (compartilhado por `liveSend` e
  // `executePlan`), gravando `before/after` no undoStack para reverter.
  async executeTools(tools, { filesList = [], truncated = false } = {}) {
    const results = [];
    const created = [];
    const overwrites = [];
    const binaryWarnings = [];
    for (const t of tools || []) {
      try {
        if (t.tool === 'write_file' && isBinaryPath(t.args.path || '')) {
          binaryWarnings.push(t.args.path);
          results.push(`AVISO: ${t.args.path} é binário — não suportado na geração (use upload).`);
          continue;
        }
        if (t.tool === 'write_file') {
          // S42: cache do estado anterior para o undo.
          let before = null;
          try {
            const existing = await vfs.readFile(t.args.path);
            before = existing?.content ?? null;
          } catch (err) {
            before = null;
          }
          this.undoStack.push({ path: t.args.path, before });
        }
        const r = await toolExecutor.execute(t.tool, t.args);
        results.push(r);
        if (t.tool === 'write_file') {
          created.push(t.args.path);
          // S33: guard contra sobrescrita — sinaliza arquivos pré-existentes.
          if (filesList.includes(t.args.path) || filesList.includes(`./${t.args.path}`)) {
            overwrites.push(t.args.path);
          }
        }
      } catch (err) {
        results.push(`ERRO ${t.tool}: ${err.message}`);
      }
    }
    if (truncated) {
      results.push('⚠ resposta truncada: a saída do modelo foi cortada no meio. Use "Continuar geração".');
    }
    return { files: created, results, binaryWarnings, overwrites };
  }

  // S42 — executa um plano aprovado pelo usuário. `only` executa um único passo
  // (índice) — "Aprovar passo"; sem `only`, executa tudo ("Aprovar tudo").
  async executePlan(plan, { only } = {}) {
    const tools = plan?.tools || [];
    const idxs = only == null ? tools.map((_, i) => i) : [only];
    const selected = idxs.map((i) => tools[i]).filter(Boolean);
    if (!selected.length) return { message: plan?.message || '', files: [], results: [], binaryWarnings: [], overwrites: [] };
    this.beginUndo();
    const executed = await this.executeTools(selected, { filesList: plan.filesList || [] });
    return { message: plan?.message || '', ...executed, planDone: true };
  }

  /**
   * S21: valida uma chave LLM com um prompt mínimo antes de salvar no Settings.
   * Retorna { ok, error } — não lança (usado no botão "Testar" da UI).
   */
  async testConnection(entry, uid) {
    const cfg = PROVIDERS[entry.provider];
    if (!cfg && !entry.baseUrl) return { ok: false, error: 'Provider desconhecido' };
    try {
      const apiKey = await this.decryptKey(uid, entry);
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
    const intro = `**[MODO DEMO]** Entendido! Vou gerar um MVP de exemplo para "${text}" (configure APIs em Configurações para gerar de verdade). `;
    return new Promise((resolve) => {
      let i = 0;
      const tick = () => {
        if (i <= intro.length) {
          onChunk?.(intro.slice(0, i));
          i += 3;
          setTimeout(tick, 8);
        } else {
          const slug = slugify(text);
          // S35: template HTML válido (DOCTYPE, head, body, tags fechadas) —
          // montado via JSON.stringify nunca concatena aspas quebradas.
          const tools = [
            {
              tool: 'write_file',
              args: {
                path: `${slug}/index.html`,
                content: `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${text}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>${text}</h1>\n  <p>MVP gerado pelo CAIM em modo demo.</p>\n  <script src="script.js"></script>\n</body>\n</html>\n`,
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
          const overwrites = [];
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
          ).then(() =>
            resolve({
              message: '[MODO DEMO] Arquivos criados no Explorer. Abra o Diff e depois publique!',
              files: created,
              results,
              thinking: '',
              truncated: false,
              approxTokens: 0,
              binaryWarnings: [],
              overwrites,
            })
          );
        }
      };
      tick();
    });
  }
}

export const agentManager = new AgentManager();
export { ClineDriver, OpenCodeDriver };
