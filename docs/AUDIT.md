# 🔍 CAIM — Diagnóstico Completo da Plataforma

> Análise automatizada executada em **16/08/2026** após as sprints S24–S30. Cobre: testes, build, deploy ao vivo, assets, headers de segurança, PWA e pontos de risco de código.

---

## 1. Testes Automatizados (Vitest) — ✅ 97 verdes

| Arquivo | Escopo | Status |
|---------|--------|--------|
| `vfs-service.test.js` | CRUD, path traversal, persistência, eventos | ✅ |
| `event-emitter.test.js` | Pub/Sub | ✅ |
| `security-service.test.js` | AES-GCM round-trip, IV, master key | ✅ |
| `tool-executor.test.js` | Path traversal, `.git`, 1MB | ✅ |
| `drivers.test.js` | Cline/OpenCode parsing + truncamento | ✅ |
| `git-service.test.js` | init/add/commit/log/status/remotes | ✅ |
| `agent-manager.test.js` | Failover, streaming, thinking, abort, contexto, testConnection | ✅ |
| `auth-service.test.js` | Reset senha, email verify, erros amigáveis | ✅ |
| `auth-views.test.js` | Settings, logout, navegação | ✅ |
| `diff-viewer.test.js` | Blocos, create/delete/binary, minified | ✅ |
| `file-tree.test.js` | Explorer, `.git` oculto, XSS nome | ✅ |
| `viewer.test.js` | XSS markdown/csv/html/xlsx/docx | ✅ |
| `editor.test.js` | Contexto 16KB, guard contra aba duplicada | ✅ |

## 2. Build — ✅ Limpo

- `npm run build` sem erros
- precache: **55 entradas** (landing + app + lazy chunks)
- Worker do pdfjs presente no dist (`pdf.worker.min-*.mjs`)
- dist total: ~4,92 MB (raw, inclui fontes/ícones/splash)

## 3. Deploy ao Vivo — ✅ Todos 200

| Rota | Status |
|------|--------|
| `/` (landing) | 200 |
| `/app` (IDE) | 200 |
| `/manifest.webmanifest` | 200 |
| `/sw.js` | 200 |
| `/assets/icons/logo_caim.svg` | 200 |
| `/assets/icons/icon-192.png` / `apple-touch-icon.png` / `favicon.ico` | 200 |
| `/docs` | 200 |
| Todos os assets referenciados no `/app` (18) | 200 |
| Todos os assets referenciados no `/` (8) | 200 |

## 4. Headers de Segurança — ✅ Ativos

- `Content-Security-Policy` (sem eval, só self + fontes Google)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: SAMEORIGIN`
- SW: `Cache-Control: no-cache` + `Service-Worker-Allowed: /`

## 5. PWA Manifest — ✅ Correto

- `start_url: /app` · `scope: /` · `display: standalone`
- Ícones: SVG + PNG 192/512 + maskable
- `theme_color`/`background_color: #0f172a` (navy da logo)

## 6. Sprints Executadas (S24–S30)

| Sprint | Status | Destaques |
|--------|--------|-----------|
| **S24** | ✅ | Polling Pages (HEAD 5s/5min), spinner+xp-bar deploy, export ZIP, push pendente |
| **S25** | ✅ | `storage.persist()`, storage pressure >90%, badge offline |
| **S26** | ✅ | pdf.js p/ PDFs >1MB, upload >10MB bloqueado, rate limit dinâmico (owners 200/min) |
| **S27** | ✅ | Tokens `--pixel-*`, `.pixel-border`, `.pixel-btn` |
| **S28** | ✅ | Activity bar RPG, bottom sheet, editor 16-bit, tabs pixel |
| **S29** | ✅ | `notify.achievement` + `notify.particles` (deploy/aceitar diff) |
| **S30** | ✅ | xp-bar deploy, efeito CRT, ícones pixel SVG |

---

## 7. Pontos de Risco Identificados (para correção na próxima rodada)

### 🔴 Críticos
1. **`gitPanel.refresh` sobrescrita com binding duplo** (`app.js:304-308`) — funcional, mas `bind()` redundante pode re-encadear o refresh se o constructor rodar depois. Recomendo mover a lógica do `checkPendingPush` para dentro do `GitPanel` (método nativo `refresh`).
2. **CSP não inclui `data:` em `script-src`** — ok hoje (nenhum inline script), mas se o pdfjs/canvas precisar de data URI dinâmica pode quebrar. Monitorar.
3. **`renderPdfJs` usa `new URL(..., import.meta.url)`** — em produção o worker está no dist, mas o `import.meta.url` em bundle minificado pode resolver para um path inesperado. Testar PDF grande em produção.

### 🟠 Médios
4. **`checkPendingPush` roda no boot via `gitPanel.refresh` sobrescrito** — se o git não inicializado, `gitService.log(1)` lança e cai no catch (silencioso). Ok, mas poderia dar toast informativo.
5. **`settings-logout` e `settings-back`** — `goBack()` quando o settings foi aberto do dashboard retorna para dashboard (correto). Quando aberto da IDE, retorna à IDE (correto). Verificado.
6. **Fontes Google carregadas 2×** (landing via `<link>` no head; app via `loadPixelFont` async) — impacto mínimo, mas duplicação.

### 🟡 Leves
7. **`ide-logo` CSS órfão** (`main.css:253`) — não usado (imagem removida). Limpar.
8. **`onDeployed` no git-panel chama toast** que pode duplicar com o novo toast de sucesso do `deployProject`. Harmless, mas pode mostrar 2 toasts seguidos.
9. **`docs/` rota** retorna a landing (rewrite SPA) — o Firebase Hosting não tem docs estáticos publicados; o `/docs` cai no fallback do index.html. Se quiser docs públicos, configurar hosting para servir `docs/`.

---

## 8. Recomendações Imediatas

1. Refatorar `gitPanel.refresh` — mover `checkPendingPush` para dentro do `GitPanel`.
2. Limpar CSS órfão (`.ide-logo`).
3. Unificar toasts de deploy (remover `onDeployed` duplicado).
4. Verificar pdfjs em produção com um PDF real >1MB.
5. (Opcional) Servir `docs/` no Firebase Hosting ou remover o link `/docs` da landing.

---

*Gerado automaticamente em 16/08/2026. Commits: `52a80e5` (docs S24-S30), `bb04b6f` (fixes anteriores).*

---

## 9. Atualizações Posteriores (S31–S36b, mesmo 16/08)

A auditoria acima descreve o estado pós S24–S30. Desde então a plataforma evoluiu:

### Testes — de 97 para **141 verdes**

| Arquivo | Escopo | Status |
|---------|--------|--------|
| `chat-renderer.test.js` | Bubble legível (S31) + intenção "ver o site" (S34) | ✅ |
| `agent-manager.test.js` (ampliado) | Gate chitchat (S32), memória+overwrite (S33), demo robusto (S35) | ✅ |
| `project-service.test.js` | Gestor de projetos local: snapshot/continuar/renomear/excluir/markDeployed/createFromWorkspace (S36) | ✅ |
| `auth-views.test.js` (ampliado) | Gestor de projetos no dashboard: cards locais+publicados, Novo projeto, Continuar→IDE (S36) | ✅ |
| `notify.test.js` | Toast persistente `duration:0`, botão fecha+onClick (S36b) | ✅ |

### Sprints adicionadas (S31–S36b)

| Sprint | Status | Destaques |
|--------|--------|-----------|
| **S31** | ✅ | Chat legível: `chat-renderer.js` (message + chips + `<details>` via textContent) |
| **S32** | ✅ | Gate de intenção: chitchat ("oi"/"obrigado") não gera arquivos (regex combinações) |
| **S33** | ✅ | Memória conversacional: histórico + estado do VFS no prompt + guard de overwrite |
| **S34** | ✅ | Intenção "ver o site": localhost → Preview/Deploy sem chamar o LLM |
| **S35** | ✅ | Geração robusta: `JSON.stringify` no demo + system prompt só com esquema |
| **S36** | ✅ | Dashboard = **gestor de projetos**: locais (VFS snapshots) + publicados (Firestore), Continuar/Nome/Renomear/Excluir (só local — GitHub intacto) |
| **S36b** | ✅ | **Toast de deploy persistente** (`duration:0`): "MVP publicado! Ficou salvo no dashboard." + botão Abrir |

### Deploy & infra corrigidos (mesmo dia)

- IAM do Secret Manager (`GITHUB_OWNER_PAT`) vazio → binding de `roles/secretmanager.secretAccessor` para a SA da Function.
- PAT fine-grained sem permissão de repo → **classic PAT `ghp_` (escopo `repo`)**, testado com `diag-pat.cjs`.
- `githubDeployProxy` reescrito para a **Contents API** (Git Data API retorna `409 Git Repository is empty` em repos vazios) — validado E2E (`diag-e2e.cjs`).
- Dashboard: `listProjects` sem `orderBy` (evita índice composto faltante) — ordenação no cliente.

### Status dos pontos de risco da seção 7

| # | Risco | Status (16/08, pós S36b) |
|---|-------|--------------------------|
| 8 | Toast duplicado no deploy (`onDeployed`) | **Parcialmente endereçado** — S36b tornou o toast de sucesso persistente e único no `deployProject`; a duplicação com o `onDeployed` do git-panel ainda não foi unificada (ver recomendação abaixo). |
| 2 | CSP `script-src` sem `data:` | Sem mudança — ainda ok (nenhum inline script; monitorar pdfjs). |
| 7 | CSS órfão `.ide-logo` | Sem mudança — pendente de limpeza. |

### Recomendações novas

1. Unificar o toast de deploy do `git-panel.onDeployed` com o do `deployProject` (evitar 2 toasts seguidos).
2. Validar o gestor de projetos (S36) e o toast persistente (S36b) em **device real** (iPhone/PWA).
3. Manter a regra: exclusão de projeto é **sempre local** — nunca chamar API de delete de repo no GitHub a partir do app.

---

*Atualização de 16/08/2026 (S31–S36b) — 141 testes verdes, build limpo, hosting `caim` redeployado.*

---

## 10. Atualização de 18/08 (Fase 9: S37–S42)

> **Recontextualização:** o diagnóstico acima (16/08) continua válido. Em 18/08 a plataforma avançou a Fase 9 (roadmap pós-Go-Live) em 6 sprints, com testes, build e **redeploy de produção** (https://caim.web.app).

### Testes — de 141 para **212 verdes** (+71)

| Arquivo | Escopo | Status |
|---------|--------|--------|
| `file-tree.test.js` (ampliado) | Ícones por tipo de arquivo via `file-icons.js` (S37) | ✅ +1 |
| `search-panel.test.js` (novo) | Busca fuzzy go-to-file + Encontrar/Substituir todos (S38) | ✅ +14 |
| `core/snippets.test.js` (novo) | 10 snippets padrão + `findSnippet`/`wordBeforeCursor` (S39) | ✅ +9 |
| `core/editor-prefs.test.js` (novo) | Prefs do editor em metadata (S39) | ✅ +5 |
| `editor.test.js` (ampliado) | Expansão de snippet Ctrl/⌘+Space + applyPrefs (S39) | ✅ +5 |
| `project-service.test.js` (ampliado) | Templates/duplicar/pin/tags (S40) + zip round-trip/lixeira (S41) | ✅ +9 |
| `auth-views.test.js` (ampliado) | Dashboard S40/S41: busca/ordenação/pin, action sheet de templates, lixeira, import .zip | ✅ +9 |
| `agent-manager.test.js` (ampliado) | Autonomia S42: gate ask bloqueia tool, executePlan tudo/passo, undoLastPlan, permissão em metadata | ✅ +9 |

### Sprints adicionadas (S37–S42)

| Sprint | Status | Destaques |
|--------|--------|-----------|
| **S37** | ✅ | Ícones por extensão no Explorer (`file-icons.js` → `ft-icon-*`, paleta 16-bit AA) |
| **S38** | ✅ | `search-panel.js`: drawer 🔍 com go-to-file (score exact>basename>path>subsequência) + Encontrar/Substituir todos (reversível pelo Diff) |
| **S39** | ✅ (parcial) | `snippets.js` (10 snippets, prefixo `!` custom) + `editor-prefs.js` (tema 16-bit/Claro, fonte mono/pixel) + compart no editor (⚡ toolbar + Ctrl/⌘+Space). **Pendentes:** atalhos custom e multi-cursor |
| **S40** | ✅ | `PROJECT_TEMPLATES` (5) + `newProjectFromTemplate`/`duplicateProject`/`togglePin`/`setTags`; dashboard com busca (nome/tag), ordenação e action sheet "Novo projeto" |
| **S41** | ✅ | `exportProjectZip`/`importProjectZip` (JSZip, sanitize + limites 1MB/20MB) + lixeira (`trashed` no **VFS v3**; restaurar/apagar definitivamente/esvaziar) |
| **S42** | ✅ | `PERMISSION` ask/review/auto por projeto (metadata); gate `ask` → `{ plan }` com Aprovar tudo/passo; `undoLastPlan` byte a byte; `vfs:changed` AUTO sem conflito |

### Build & Deploy (18/08)

- `npm run build` **limpo** (exit 0) — 49 entradas no precache, SW gerado.
- **Novo aviso:** chunk `app-*.js` = **553,27 kB** (gzip 176,94 kB) — Vite emite warning `chunks larger than 500 kB`. Não bloqueia (core gzip continua ~177KB), mas o `app.js` (com todo o wiring S36–S42) é o próximo candidato a **code-splitting** (`rolldownOptions.output.codeSplitting` / lazy dos painéis).
- `firebase deploy --only hosting` — **redeployado 18/08** (22 arquivos novos). Live: https://caim.web.app · IDE: https://caim.web.app/app.

### Novos pontos de atenção (herdados dos riscos anteriores + novos)

| # | Risco | Status (18/08) |
|---|-------|----------------|
| 8 | Toast duplicado no deploy (`onDeployed`) | **Pendente** — ainda não unificado (ver §9 recomendação 1). |
| 2 | CSP `script-src` sem `data:` | Sem mudança — ok hoje; monitorar pdfjs. |
| 7 | CSS órfão `.ide-logo` | **Pendente** — limpeza. |
| 10 | **Chunk `app-*.js` > 500KB** (novo) | **Novo aviso de build** — code-splitting futuro (S53/infra ou sprint dedicada). |

### Recomendações novas (18/08)

1. Unificar o toast de deploy do `git-panel.onDeployed` com o do `deployProject` (item 8, ainda aberto).
2. Validar a **Fase 9 em device real**: dashboard S40/S41 (templates, duplicar, pin, tags, busca, lixeira, importar .zip), permissões/planos/undo S42 e busca S38 no iPhone/PWA.
3. Aplicar **code-splitting** no `app.js` para reduzir o chunk > 500KB.
4. Fazer o **upgrade das Functions para Node 22** (decomissiona 2026-10-30) e ativar **App Check**.

### Ajuste UX — botões dos cards de projeto (18/08, pós-deploy)

- `.project-actions` migrou de `flex:1` (7 botões espremidos em 1 linha) para **grid 2 colunas**: "Continuar" (`project-action-primary`) em linha cheia no topo + Fixar/Duplicar/Tags/Exportar .zip/Renomear/Lixeira em 3×2 (`gap:6px`, padding 8px, `nowrap` + `ellipsis`). Aplica-se também aos cards da lixeira (Restaurar/Apagar definitivamente) e publicados.
- Verificado: **212 testes verdes**, build limpo, **redeploy** (22 arquivos novos).

---

## 11. Correção do Dev Server + Verificação de Workflows (21/08)

> **Problema reportado pelo usuário:** o projeto **não rodava**, e os fluxos de **salvar** e **testar as APIs** não funcionavam. Diagnóstico e correção abaixo.

### Diagnóstico (causa raiz)

- O Vite dev server **travava** durante a etapa de re-otimização de dependências com o erro:
  ```
  [vite](client) error while updating dependencies:
  Error: ENOENT: no such file or directory, open '...\node_modules\framework7\framework7-bundle.esm.js'
  ```
- **Causa:** o `vite.config.js` mantinha uma **referência morta ao Framework7** no `manualChunks` (`if (id.includes('node_modules/framework7')) return 'framework7';`) — mas o **Framework7 não está instalado** no `node_modules` (foi removido no S10, substituído pela mini-UI `notify.js`). Ao detectar `Re-optimizing dependencies because lockfile has changed`, o optimizer do Vite tentava ler o `framework7-bundle.esm.js` inexistente e **derrubava o servidor**.
- **Impacto:** o servidor iniciava e servia `/` e `/app` (200), mas **crashava logo em seguida** durante o bundling dos módulos — o que impedia rodar o app, salvar APIs (`saveSettings` → `dbService.updateLlmKeys`) e testar chaves (`agentManager.testConnection`), todos dependentes de um app no ar.

### Correção aplicada

- **`vite.config.js`:** removida a referência morta ao Framework7 do `manualChunks` (o bloco `output` ficou sem `manualChunks`, mantendo o code-splitting nativo/lazy).
- **Cache do Vite:** limpo `node_modules/.vite/deps` para forçar re-bundling limpo.

### Verificação de workflows (tudo testado ✅)

| Workflow | Resultado |
|----------|-----------|
| **Dev server** (`npm run dev -- --port 5173 --strictPort`) | ✅ inicia e **permanece estável** (antes travava no optimizer) |
| **14 módulos principais** carregados (`app.js`, `auth-views`, `agent-manager`, `vfs-service`, `git-panel`, `editor`, `file-tree`, `chat-renderer`, `diff-viewer`, `viewer`, `search-panel`, `notify`, `project-service`, `git-service`) | ✅ todos 200 OK |
| **Testes unitários** (`npm run test`) | ✅ **212 verdes** (19 arquivos) |
| **Build de produção + PWA** (`npm run build`) | ✅ concluído, SW gerado (49 entradas) |
| **Salvar/ler (VFS)** — `vfs-service.test.js` | ✅ |
| **Salvar APIs (Settings)** — `auth-views.test.js` + `auth-service.test.js` | ✅ |
| **Testar APIs** — `agent-manager.test.js` (`testConnection`) | ✅ |
| **Git** — `git-service.test.js` (init/add/commit/log) | ✅ |
| **Projetos** — `project-service.test.js` (snapshots/zip/lixeira) | ✅ |
| **Agente/chat** — `agent-manager.test.js` (failover/streaming/autonomia) | ✅ |

### Observações

- Os **testes unitários** validam a lógica (VFS salva/lê, criptografia das chaves, parse dos drivers, git offline, autonomia do agente). Porém os fluxos de **rede real** — login Firebase, chamadas às LLMs (DeepSeek/OpenAI/Groq/NVIDIA/OpenCode) e deploy no GitHub — **não são testáveis no terminal** (dependem de Firebase ativo, chaves reais e navegador com IndexedDB/CORS/Web Crypto). Esses exigem validação manual em `http://localhost:5173`.

---

*Atualização de 21/08/2026 — correção da referência morta ao Framework7 no `vite.config.js` (dev server travava no optimizer) + verificação completa dos workflows (212 testes verdes, build limpo, 14 módulos OK).*
