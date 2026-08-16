# CAIM — Master Implementation & Sprint Plan

> Plano de execução de engenharia do estado atual (Step 1 ✅) até o Go Live.
> Desenvolvido para máxima resiliência e foco na produtividade do fluxo de trabalho *on-the-go*.
> **Data de Referência:** 15/08/2026 · **Duração Média por Sprint:** 5–7 dias (Solo Dev)

---

## Sumário

1. [Definition of Done (DoD) Global](#definition-of-done-dod-global)
2. [Visão Geral das Sprints](#visão-geral-das-sprints)
3. [Fase 0 — Fundação (Concluída)](#fase-0--fundação-concluída)
4. [Fase 1 — Core Data Layer (Step 2)](#fase-1--core-data-layer-step-2)
5. [Fase 2 — UI/UX & Interatividade (Step 3)](#fase-2--uiux--interatividade-step-3)
6. [Fase 3 — AI Agent & Context Layer (Step 4)](#fase-3--ai-agent--context-layer-step-4)
7. [Fase 4 — Integração, Hardening & Deploy (Step 5)](#fase-4--integração-hardening--deploy-step-5)
8. [Fase 5 — Homologação Ponta-a-Ponta (S13–S19)](#fase-5--homologação-ponta-a-ponta-s13s19)
9. [Dependências entre Sprints](#dependências-entre-sprints)
10. [Estratégia de Testes](#estratégia-de-testes)
11. [Estrutura de Pastas Alvo](#estrutura-de-pastas-alvo)
12. [Matriz de Riscos & Mitigação](#matriz-de-riscos--mitigação)
13. [Critérios de Go Live](#critérios-de-go-live)
14. [Pós-Go-Live & Rollback](#pós-go-live--rollback)

---

## Registro de Progresso (2026-08-15)

### Sessão de 16/08 — S14 (parcial): Settings 3 APIs + failover cobertos por teste

- **Bug de persistência (regressão S14) corrigido:** `AuthViews.renderSettings` não repassava a chave cifrada já salva para a linha → **reabrir Configurações e salvar sem redigitar apagava todas as chaves**. Agora `row.__encrypted` herda `data.key` ao renderizar (`auth-views.js`).
- **Testes (Vitest + jsdom):** +10 → **51 verdes**. Novo `agent-manager.test.js` cobre **failover multi-API** (401 → cai na chave seguinte, 429 → backoff → próxima, chave desativada ignorada, erro agregado, ordem por prioridade, chave decifrada só no momento da chamada). Novo `auth-views.test.js` (jsdom) cobre Settings: 3 linhas, **reabrir preserva chaves cifradas sem redigitar**, chave digitada é cifrada (nunca texto puro), linha desativada salva com `active:false`. Dep `jsdom` adicionado.
- **Build:** `npm run build` limpo.

### Sessão de 16/08 — S13 (parcial): testes automatizados + fixes de homologação

- **Bug crítico encontrado e corrigido:** `VFS.writeFile` chamava `this.resolveMime()` mas `resolveMime` é **estático** → **toda escrita de arquivo quebrava** (novo arquivo, chat demo, upload, autosave). Corrigido para `VFSService.resolveMime()` (`vfs-service.js:119`). Detectado pelos novos testes (antes só "funcionava" porque o demo engolia o erro do Tool Executor).
- **Path traversal (DoD J1):** `normalizePath` agora **bloqueia `..` que escapa da raiz** com erro amigável ("Caminho inválido: não é possível sair do VFS (../)") em vez de silenciosamente virar um path órfão.
- **Auth-gate sem flash (J1):** `screen-ide` deixou de ser a tela ativa padrão no `index.html`; `screen-auth` é o default. Visitante não logado não vê a IDE nem por um instante.
- **Testes (Vitest + `fake-indexeddb`):** infra criada (`vitest.config.js`, `src/test/setup.js`) com **24 testes verdes** — VFS (CRUD, rename, delete, path traversal, persistência pós-reload, listDir, mime, limite 1MB, eventos `vfs:changed`), EventEmitter e SecurityService (AES-GCM round-trip, IV aleatório, master key persistente, adulteração falha).
- **Build:** `npm run build` limpo (zero erros) · dev server boot OK · core eager **155,80 KB gzip** (meta < 400KB ✅).
- **Pendente (device real, manual):** PWA install/splash, cadastro/login reais, `seed-admin`, `GITHUB_OWNER_PAT` + deploy ponta-a-ponta, regras Firestore com 2 contas. Risco conhecido: `xlsx` (SheetJS) com advisory high sem fix no npm — aceito, lazy-load no viewer (S18).

### Sessão de 16/08 (cont.) — Hardening com base em research (nuncio/Nexus-IDE/hackpadfs/viewport-truth/opencode/cline/cors-proxy)

- **Parser tolerante a truncamento (S15-critical):** `ClineDriver` agora **salva `write_file` sem fechamento no fim da stream** (conteúdo parcial, flag `truncated`) + `detectTruncation()`; `OpenCodeDriver` **resgata arquivos completos de JSON truncado** via regex; `agent-manager`/`app.js` exibem aviso "⚠ Resposta truncada — reenvie o prompt". *(Bug clássico do Cline: modelos cortam a resposta no limite de tokens, no meio da tag.)*
- **`gitCorsProxy` blindado (S19/S2):** host-**allowlist** (só `api.github.com`/`github.com`/`raw.githubusercontent.com`/`objects.githubusercontent.com`/`codeload.github.com`) + **rate limit 50 req/min** por usuário autenticado (Bearer → uid) ou IP. Impede uso do proxy como open-relay.
- **`syncViewport` com throttle `requestAnimationFrame`** (`app.js`): teclado iOS dispara resize+scroll em rajada — o throttle elimina o jitter da toolbar flutuante/bottom sheet (padrão `viewport-truth`).
- **Tool Executor:** `listDir` passou a validar path (`validatePath`) e `.git` (sem barra) agora é bloqueado — fechamento de brecha S6.
- **VFS:** `.git` (sem barra) não era protegido na validação do executor — corrigido.
- **Testes:** +13 → **37 verdes** (drivers truncamento JSON/XML, tool-executor path traversal, `.git`, listDir).


### Sessão de 16/08 (cont.) — S13 git offline + hardening S2/S18/S17

- **Testes de Git offline (S2/S13):** `src/js/git/git-service.test.js` cobre `init → add → commit → log`, status "novo"/"modificado", persistência entre instâncias e `setRemote/getRemote` (troca de origin). **41 testes verdes.**
- **`gitFs` com `stat` por hash de conteúdo (S2):** `compareStats` do isomorphic-git só olha segundos; edições no mesmo segundo passavam despercebidas. `contentStamp` (FNV-1a 32-bit dupla) torna `mtime/ctime` derivados do conteúdo → conteúdo igual reusa cache do index, diferente força re-leitura.
- **`gitFs.readFile` com encoding (S2):** suporta `{ encoding: 'utf8' }` (HEAD/refs/config) e propaga `err.code = 'ENOENT'` (isomorphic-git confia no `code`); `stat` idem.
- **`deleteRemote` (S2):** isomorphic-git 1.41 usa `git.deleteRemote` (não `removeRemote`) — fix em `setRemote`.
- **CSP + security headers (S18/S11):** `firebase.json` com `Content-Security-Policy` (sem `eval`, só `self` + fontes Google), `X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options`.
- **XSS no viewer (S18):** `renderXlsx` e `renderDocx` sanitizam a saída com DOMPurify (SheetJS/mammoth podem embutir HTML malicioso).
- **LCP (S12/S17):** fonte Press Start 2P sai do caminho crítico (load assíncrono em `app.js`), `preload` + `fetchpriority=high` no icon-192.

### Sessão de 15/08 — Rebuild F7 + Stack + Editor/Explorer + Visualizador

- **Rebuild do app shell em Framework7 9.1.2 (Vanilla JS):** abas Chat/Editor/Files + tabbar inferior com SVGs inline. Substituiu a UI custom manual.
- **Scaffolding Vite 8** (`vite.config.js`, `package.json`, `scripts/copy-assets.mjs`, `INICIAR.bat`) com `vite-plugin-pwa`. Dev server em `http://localhost:5173/`.
- **Identidade visual:** logo `logo_caim.png` aplicado em favicon, icons PWA, apple-touch-icon, splash screens e header.
- **Dark theme:** `--bg-primary: #000000`, accent `#2dd4bf`, `theme-color` preto, `dark: true`.
- **S1 VFS ✅:** `core/vfs-service.js` (Dexie, CRUD, seed, proteção de path, `vfs:changed`, mime map, data URLs) + `core/event-emitter.js`.
- **S3 parcial:** `ui/file-tree.js` (árvore recursiva, colapso, re-render reativo) + botão "Novo arquivo".
- **S4 parcial:** `ui/editor.js` (CodeMirror 6 + oneDark + tabs + autosave 800ms + linguagens JS/Python/HTML/CSS/JSON/MD).
- **Fluxo chat→agente→arquivo:** prompt cria `src/<slug>-N.md` via VFS e abre no editor (streaming é **demo local**, sem LLM real).
- **Tabbar fix:** highlight deslizante do F7 desativado + estado ativo limpo + ícones 24px robustos.
- **S3.5 File Viewer 🔄 (em andamento):** aba "Preview" + botão upload no Explorer + `ui/viewer.js` com render de Markdown (`marked`+`DOMPurify`), imagens, HTML (iframe sandbox), PDF, CSV, DOCX (`mammoth`), XLSX (`xlsx`), PPTX (texto via `jszip`). Libs lazy-load.
  - ✅ Feito: deps instaladas, mime map no VFS, `viewer.js`, aba Preview + 4º tab-link + botão upload no `index.html`.
  - ⏳ Falta: botão de preview por arquivo no file-tree, botão preview no editor, wiring no `app.js`, CSS do viewer, upload funcional, build/validação. *(Com a aprovação da S4.5, o wiring migra para o novo layout — ver abaixo.)*

### Sessão de 15/08 (cont.) — Crítica de UX + Aprovação do Layout IDE (S4.5)

- **Crítica recebida:** o padrão de **4 abas mutuamente exclusivas** (Chat/Editor/Files/Preview) sabota o fluxo "VSCode de bolso" — cada troca de aba é um corte de contexto (o usuário perde o arquivo, o prompt e o diff ao mesmo tempo). Crítica integral na conversa de 15/08; veredito: arquitetura (VFS/drivers/Web Crypto) ⭐⭐⭐⭐⭐, UX de abas ⭐⭐.
- **Decisão:** **S4.5 — Rebuild da UX para Layout IDE aprovado.** Abas viram **Activity Bar lateral** (📁 Explorer · 💬 Chat · 🔍 Search · ⚙️ Settings) + **Editor central sempre visível** + **Bottom Sheet retrátil** (Chat/Diff/Preview/Git). Explorer vira **drawer sobreposto** (sem troca de tela).
- **Preservação:** `CodeEditor`, `FileTree`, `FileViewer` e o fluxo `vfs:changed → editor.openFile` **ficam intactos** — só mudam os containers (`id`s preservados) e o `app.js` troca `app.tab.show()` por `showPane()`/`expandSheet()`.
- **Decisões da crítica incorporadas:**
  - 🪦 **Matar o `sw.js` legado** — o `vite-plugin-pwa` gera SW + manifest com `registerSW()` e `skipWaiting()` integrados (evita conflito de cache duplo).
  - 🧪 **`AgentMode` enum `DEMO | LIVE`** — o orchestrator falha rápido se `LIVE` sem provider configurado (impede o demo de vazar para o fluxo real).
  - 🗜️ **CodeMirror langs lazy-load** — já temos o `Compartment`; reconfigurar linguagem sob demanda é trivial.
  - 📱 **Toolbar flutuante iOS elevada a topo de prioridade** em S4 (ancorar via `visualViewport` + `view.scrollDOM.getBoundingClientRect()`).
  - 🛡️ **Firebase App Check** (reCAPTCHA Enterprise) anotado como hardening de S11 — em PWA não há DeviceCheck/Play Integrity.
  - 📦 **Bundle:** `isomorphic-git` só carrega ao abrir Git; `mammoth`/`xlsx`/`jszip` já são lazy ✅.
  - ❌ **Sem novas deps de animação/scroll:** bottom sheet usa `transform: translateY` + CSS transition; scroll nativo iOS. `allotment` fica como opcional para split lateral (landscape/iPad).
- **Nota técnica:** não existe `EditorView.split` no CodeMirror 6 — o preview inline é uma **segunda view** (iframe/HTML) num pane ao lado via CSS, não split nativo do CM.

### Sessão de 15/08 (cont.) — S3/S7/S10 + SaaS (auth-gate, deploy, S6/S7/S8)

- **S3 ✅** — Menu ⋯ por arquivo (Action Sheet F7): Abrir, Visualizar, **Renomear** (`vfs.renameFile`), **Excluir** (`vfs.deleteFile` + `editor.forceRemove`).
- **S7 parcial → ✅** — Chat com markdown sanitizado (`marked`+`DOMPurify`), toggle **"Pensar"** (`reasoning_content` em `<details>`), botão **Parar** (AbortController), **contexto dos arquivos abertos** (até 3, cap 8KB) e **histórico persistido** no VFS (60 msgs).
- **S8 ✅** — Failover multi-API por prioridade, timeout 120s, backoff em 429/5xx, modelo/baseUrl sobrescrevíveis no Settings.
- **S10 parcial** — `sw.js`/`manifest.json` legados removidos da raiz.
- **SaaS (auth-gate)** — Login/cadastro obrigatórios (Firebase Auth), dashboard com histórico de MVPs (`projects/{id}`), Settings com até 3 chaves LLM cifradas (`users/{uid}/llm_keys`), **regra de ouro**: deploy roteado pela CF `githubDeployProxy` (PAT do Owner no **Google Secret Manager**, nunca no frontend). `firestore.rules` com acesso por dono + `config/{key}` só OWNER.
- **Deploy realizado** — Hosting em **https://caim.web.app** · Functions `githubDeployProxy` + `gitCorsProxy` no ar · `firebase.json` agora aponta para `dist/` com site `caim`.

### Sessão de 15/08 (cont.) — S9/S10/S11/S12 + Jornada do Cliente

- **S10 ✅ parcial→core enxuto** — Removido o **Framework7** (substituído pela mini-UI `ui/notify.js`: toast/dialog/confirm/actions). CodeMirror com **setup mínimo** (sem autocomplete/lint/search). Code-splitting nativo (manualChunks só para F7 → removido). **Core eager ~156KB gzip + CSS 5,6KB** (antes ~800KB F7). Lazy: xlsx/mammoth/isomorphic-git/marked/DOMPurify/firebase.
- **S9 ✅ parcial** — GitPanel "Publicar MVP" agora roteado pela CF `githubDeployProxy` (PAT do Owner no Secret Manager); botão **"Novo projeto"** (`resetWorkspace` limpa VFS+abas). `deployProject` retorna a URL.
- **S11 ✅ parcial** — Stub de **Firebase App Check** (ativa só com `appCheckSiteKey`); `aria-label` nos inputs de auth; XSS já mitigado (DOMPurify + iframe sandbox).
- **S12 ✅ parcial** — Lighthouse rodado: **Performance 72 · Best Practices 100 · FCP 1,9s · LCP 6,6s**; trocado o logo 483KB→icon-192 (15KB) no auth e icon-32 no header p/ reduzir LCP.
- **Jornada do Cliente** — `docs/diagrams/journey.md` com J0–J7 (auth, APIs, geração, diff, deploy, IDE, offline) + **Fase 5: sprints de homologação S13–S19** testando cada workflow na ordem cronológica.

---

## 🎯 Definition of Done (DoD) Global

Para que uma tarefa seja considerada concluída, ela deve obrigatoriamente cumprir:

1. **Zero Console Errors:** Nenhum aviso ou erro no console do navegador (Safari/Chrome).
2. **Mobile-First:** Testado fisicamente em dispositivo móvel (ou simulador fiel), respeitando `safe-area-insets` e sem acionar o zoom nativo do iOS ao tocar em inputs.
3. **Offline Resilience:** A funcionalidade deve operar perfeitamente sem rede (exceto chamadas de API de LLM ou Git Push/Pull).
4. **Performance:** Ações de UI não podem bloquear a thread principal por mais de 50ms.

> **DoD por sprint:** além do checklist de tarefas, cada sprint possui uma lista de **Critérios de Aceite** — apenas quando todos forem validados o sprint é considerado concluído e o próximo pode começar.

---

## Visão Geral das Sprints

| # | Sprint                                  | Fase | Foco                                             | Status    |
|---|-----------------------------------------|------|--------------------------------------------------|-----------|
| S0 | PWA Scaffolding                         | 0    | App shell, SW, hosting, infra de módulos         | ✅ Done   |
| S1 | VFS & Gestão de Estado                  | 1    | Persistência IndexedDB + EventEmitter            | ✅ Done   |
| S2 | Git Service Engine                      | 1    | isomorphic-git + PAT cifrado + CF deploy MVP    | ✅ Done   |
| S3 | File Explorer & Tree Navigation         | 2    | Árvore, drawer, upload, renomear/excluir         | ✅ Done   |
| S3.5 | File Viewer (Visualizador)             | 2    | Preview md/img/html/pdf/csv/docx/xlsx/pptx      | ✅ Done   |
| S4 | Mobile Code Editor (CodeMirror 6)       | 2    | Editor + toolbar flutuante + auto-save           | ✅ Done   |
| S4.5 | Rebuild da UX — Layout IDE             | 2    | Activity bar + editor central + bottom sheet     | ✅ Done   |
| S5 | Diff Viewer Móvel                       | 2    | Diffs por bloco no bottom sheet (aceitar/rejeitar) | ✅ Done   |
| S6 | Agent Drivers & Tool Executers          | 3    | Drivers (JSON/XML) + Tool Executor sandboxed     | ✅ Done   |
| S7 | Chat Orchestrator & UI Streaming        | 3    | Streaming, markdown, thinking, contexto, histórico | ✅ Done   |
| S8 | Providers & API Management              | 3    | Multi-API, failover, timeout, 429, abort         | ✅ Done   |
| S9 | Workflow de Ponta-a-Ponta               | 4    | Wiring completo chat→diff→deploy (MVP Factory)  | ✅ Done   |
| S10 | Otimização PWA & Service Worker        | 4    | Bundle ~156KB gzip, cache-first, modo avião      | ✅ Done   |
| S11 | QA, Segurança & Auditoria               | 4    | XSS, memory leaks, acessibilidade                | 🔄 Em andamento |
| S12 | Go Live 🚀                              | 4    | Deploy live, Lighthouse, iPhones reais           | 🔄 Em andamento |
| S13 | Homologação — Fundação & Auth          | 5    | J1: PWA + VFS + auth-gate + rules + seed owner   | ⏳ Pending|
| S14 | Homologação — APIs de LLM              | 5    | J2: 3 chaves, prioridade, failover, cifragem     | ⏳ Pending|
| S15 | Homologação — Geração & Revisão        | 5    | J3/J4: chat→agente→arquivos→diff                 | ⏳ Pending|
| S16 | Homologação — Deploy & IDE             | 5    | J5/J6: publicar MVP + explorer/editor/viewer/git | ⏳ Pending|
| S17 | Homologação — PWA & Performance        | 5    | J7: modo avião, bundle, atualização              | ⏳ Pending|
| S18 | Homologação — Segurança                | 5    | App Check, XSS, memória, firestore.rules         | ⏳ Pending|
| S19 | Go Live Final 🚀                       | 5    | Lighthouse, iPhones reais, deploy final          | ⏳ Pending|

---

## Fase 0 — Fundação (Concluída)

| #  | Sprint          | Foco Técnico                                                                                                 | Status |
| -- | --------------- | ------------------------------------------------------------------------------------------------------------- | ------ |
| S0 | PWA Scaffolding | App shell, `manifest.json`, Service Worker básico, Firebase Hosting config, infraestrutura de módulos ES6. | ✅     |

**Entregáveis:** `index.html`, `manifest.json`, `sw.js`, `firebase.json`, `main.css`, `base-agent.js`.

**Critérios de Aceite:**
- [x] PWA instalável com "Add to Home Screen" no iOS.
- [x] Service Worker registrado com cache básico dos assets estruturais.
- [x] Navegação entre os painéis Chat/Editor/Files funcionando.
- [x] Deploy inicial no Firebase Hosting validado.

---

## Fase 1 — Core Data Layer (Step 2)

### S1 — Virtual File System (VFS) & Gestão de Estado

**Objetivo:** Estabelecer a persistência local assíncrona blindada contra a política de *eviction* (limpeza de cache) do iOS Safari.

- [x] Criar `src/js/core/vfs-service.js`.
- [x] Integrar **Dexie.js** como storage. *(Bridge `lightning-fs` fica para o S2, junto do `isomorphic-git`.)*
- [x] **Schema Database:** tabela `files` (path, content, mimeType, lastModified) + `metadata`.
- [x] Implementar operações atômicas: `create`, `read`, `update`, `write`, `delete`, `listDir`.
- [x] **Proteção de Path:** sanitização estrita contra *Directory Traversal* (`../`).
- [x] **Pub/Sub de Estado:** `EventEmitter` vanilla em `core/event-emitter.js` emitindo `vfs:changed`.
- [x] Mime map estendido (`resolveMime`) + suporte a binários via *data URL* (imagens, PDF, DOCX, XLSX, PPTX).

**Critérios de Aceite:**
- [x] CRUD completo persiste após reload do navegador.
- [x] Paths normalizados; tentativa de `../` é bloqueada com erro amigável.
- [x] Eventos `vfs:changed` são emitidos e observáveis pela UI.
- [x] Operações são atômicas (falha não deixa estado corrompido).

### S2 — Git Service Engine ✅ Done

**Objetivo:** Motor de versionamento 100% in-browser, capaz de rodar sem dependência de terminal.
> **Nota (SaaS):** o deploy do MVP agora é **roteado pela Cloud Function `githubDeployProxy`** (PAT do Owner no Secret Manager). O `git-service.js` local mantém as operações offline (init/status/add/commit/log) e push opcional via `gitCorsProxy`. **Deploy realizado em 15/08** — `https://us-central1-cerraimobile.cloudfunctions.net/githubDeployProxy` e `.../gitCorsProxy`.

- [x] Criar `src/js/git/git-service.js` instanciando `isomorphic-git` (lazy).
- [x] Mapear comandos: `init`, `status`, `add`, `commit`, `log`.
- [x] **Network Operations:** cliente HTTP via proxy CORS (`gitCorsProxy` deployada).
- [x] **Criptografia Web Crypto API:** `security-service.js` (AES-GCM) para PAT/API keys no IndexedDB.
- [x] `createGitHubRepo` / `enableGitHubPages` (REST) + `deployMvp` (cliente) — *substituídos pelo `githubDeployProxy` no fluxo padrão*.
- [x] **VFS adapter** (`git/vfs-fs.js`) — `.git/` em base64 (binário-safe), raiz = VFS.
- [ ] Rotina de conflitos de merge — *postergada (S9, via Diff manual)*.

**Critérios de Aceite:**
- [x] Fluxo `init → add → commit → log` 100% offline.
- [x] PAT nunca em texto puro (cifrado AES-GCM).
- [x] `push` via proxy CORS (função deployada; requer `GITHUB_OWNER_PAT` no Secret Manager).
- [ ] Conflitos de merge detectados/sinalizados — *postergado*.

---

## Fase 2 — UI/UX & Interatividade (Step 3)

### S3 — File Explorer & Tree Navigation ✅ Done

**Objetivo:** Interface touch-friendly para o sistema de arquivos virtual.

- [x] Construir renderizador recursivo do DOM em `src/js/ui/file-tree.js` (painel `#file-tree`, dentro do drawer).
- [x] Ações por arquivo via botão **⋯** → Action Sheet do F7: Abrir, Visualizar, **Renomear** (`vfs.renameFile` + prompt), **Excluir** (confirm + `vfs.deleteFile` + `editor.forceRemove`).
- [x] Sincronização reativa: a árvore atualiza instantaneamente via evento `vfs:changed` (incl. `rename`).
- [x] Botão "Novo arquivo" (`app.dialog.prompt` do F7).
- [x] Upload de arquivos locais via `<input type="file">` → texto ou data URL → `uploads/<nome>` → preview.

**Critérios de Aceite:**
- [x] Usuário cria, renomeia e exclui arquivos pelo celular. *(Mover pastas via swipe: postergado — não bloqueia.)*
- [x] Árvore reflete mudanças externas ao VFS em tempo real.
- [ ] Listagem de diretórios com muitas entradas permanece fluida (virtualização) — *postergado*.

### S3.5 — File Viewer (Visualizador) 🔄

**Objetivo:** Pré-visualizar qualquer arquivo do VFS sem abrir no editor — o equivalente ao "Preview" do VS Code.

- [x] Criar `src/js/ui/viewer.js` com renderers: Markdown (`marked` + `DOMPurify`), imagem, HTML (iframe sandbox), PDF (iframe blob), CSV (tabela), DOCX (`mammoth`), XLSX (`xlsx`/SheetJS), PPTX (texto extraído via `jszip`).
- [x] Aba "Preview" no app shell + 4º `tab-link` no tabbar (`#tab-preview`). *(No layout IDE da S4.5, o preview vira o pane `preview` do bottom sheet.)*
- [x] Botão de Upload no Explorer (`#upload-btn`).
- [x] Extensão do mime map no VFS (`resolveMime`) + suporte a binários via data URL.
- [ ] Botão "olho" (preview) por arquivo no `file-tree.js` (`onPreviewFile`).
- [ ] Botão "Preview" no editor para o arquivo ativo (e "Abrir no editor" no viewer).
- [ ] Wiring no `app.js`: upload (`FileReader` → data URL/texto) e abertura do viewer. *(Merged com a S4.5 — o viewer passa a renderizar no pane `preview` do bottom sheet, não numa aba.)*
- [ ] CSS dos renderers (markdown, tabelas, iframes) em `main.css`.
- [ ] Validação: build + fluxo real no dispositivo.

**Critérios de Aceite:**
- [ ] Markdown/imagem/HTML/PDF/CSV renderizam no dispositivo.
- [ ] DOCX/XLSX/PPTX renderizam via lazy-load (sem pesar o bundle core).
- [ ] Upload de arquivo local persiste no VFS e abre no Visualizador.
- [ ] Botões e mensagens em PT-BR.

### S4 — Mobile Code Editor (CodeMirror 6)

**Objetivo:** O coração da IDE. Precisa ser rápido e perfeitamente adaptado a telas pequenas.

- [x] Integrar a arquitetura modular do CodeMirror 6 (`@codemirror/state`, `@codemirror/view`) em `src/js/ui/editor.js`.
- [x] **Keyboard Floating Toolbar:** barra dinâmica ancorada via `window.visualViewport` acima do teclado iOS (`{}`, `()`, `[]`, `<>`, `=`, `TAB`, undo/redo). Aparece só com teclado aberto + foco no editor.
- [x] Auto-save com *debounce* de 800ms direto para o VFS.
- [x] Carregamento preguiçoso (*lazy loading*) de linguagens via `Compartment.reconfigure` + `import()` (`@codemirror/lang-*` só baixa ao abrir a extensão).
- [x] Gestão de abas com retenção de posição do cursor e scroll (`selection`/`scrollTop` por aba) + `savedContent` por arquivo (base do Diff).

**Critérios de Aceite:**
- [ ] Edição touch fluida (seleção por arraste) em arquivos reais — *validar em iPhone físico*.
- [x] Cursor e scroll preservados ao alternar de aba.
- [x] Auto-save grava no VFS após 800ms de pausa sem travar a UI.
- [x] Toolbar flutuante ancorada pelo `visualViewport` (sem `layout shift`; zoom nativo já bloqueado por `user-scalable=no`).

### S4.5 — Rebuild da UX: Layout IDE ✅ Done

**Objetivo:** Substituir o padrão de 4 abas mutuamente exclusivas por um layout tipo IDE (VSCode de bolso), onde **tudo é visível e conectado**: Activity Bar lateral + Editor central sempre presente + Bottom Sheet retrátil + Explorer como drawer sobreposto. **Nenhum componente (VFS/Editor/Explorer/Viewer) muda** — só a orquestração em `index.html` e `app.js`. *(Design aprovado em 15/08; mockup e esqueleto na sessão de design.)*

**Estrutura do novo shell (`index.html`):**
```text
#app
├── .ide-header          ← logo CAIM + ações (⚙ run + novo arquivo) — safe-area-top
├── .ide-workspace       ← flex row
│   ├── .activity-bar    ← 48px: 📁 Explorer · 💬 Chat · 🔍 Search · ⚙️ Settings
│   └── .ide-main        ← flex column
│       ├── #editor-tabs / #editor-container / #editor-statusbar
├── .bottom-sheet        ← fixed bottom: [Chat][Diff][Preview][Git] + handle arrastável
│   └── .bs-panes        ← 4 panes (ids preservados: #chat-messages, #viewer-content…)
├── .explorer-drawer     ← drawer sobreposto 78vw com #file-tree (translateX -100%)
└── .drawer-backdrop
```

- [x] Novo `index.html` (header + activity bar + workspace + bottom sheet + drawer), removendo `.tabs`/tabbar do F7.
- [x] CSS do layout em `main.css`: `ide-header`, `activity-bar` (48px), `ide-workspace` (flex, `min-height: 0`), `bottom-sheet` (44px ↔ 80% do `visualViewport`, `transition: height`), `explorer-drawer` (`translateX`), `drawer-backdrop`, panes, viewer, diff, git.
- [x] Controller de layout no `app.js`: `expandSheet()`/`collapseSheet()`/`showPane(name)`; `app.tab.show()` substituído por `showPane()`.
- [x] **Drag do bottom sheet** com touch nativo (`touchstart`/`touchmove`, clamp 44px..80%) — sem lib.
- [x] **Teclado iOS:** `syncViewport` via `window.visualViewport`; foco no input do chat expande o sheet; foco no editor recolhe.
- [x] **Activity bar:** 📁 abre drawer (com backdrop); 💬 expande o sheet no pane chat; ⚙️ toast placeholder.
- [x] **Explorer drawer:** `FileTree` intacto em `#file-tree`; abrir arquivo recolhe o sheet e fecha o drawer; botão 👁 abre `showPane('preview')`.
- [x] **Editor:** `#editor-tabs` no topo do workspace (container novo, classe intacta).
- [x] **Preview:** `FileViewer` intacto no pane `preview`; "Abrir no editor" volta ao workspace.
- [x] Migrar wiring do chat/upload/novo-arquivo (ids preservados); `vfs:changed → editor.openFile` intacto (ignorando `.git/`).
- [x] Validar: build + navegação sem console errors (dev server OK).

**Critérios de Aceite:**
- [x] Zero troca de tela para ver Chat+Editor+Preview juntos (drawer/sheet/split, nunca `page` novo).
- [x] Editor nunca sai da tela durante qualquer interação (chat/diff/preview/explorer).
- [x] Bottom sheet recolhe ao focar o editor e expande ao tocar no chat — sem layout shift nem zoom.
- [x] Todos os `id`s atuais preservados; `CodeEditor`/`FileTree`/`FileViewer` sem alteração de API.
- [ ] Landscape/iPad: painel lateral (1/3) com `allotment` — postergado, não bloqueia.

### S5 — Diff Viewer Móvel ✅ Done

**Objetivo:** Ferramenta visual para auditar as alterações propostas pela IA antes de aplicar no VFS ou no Git.
> **Nota (S4.5):** o diff vive no **pane `diff` do bottom sheet**, lado a lado com o editor em cima — revisão sem sair do contexto.

- [x] Criar `src/js/ui/diff-viewer.js` (`DiffViewer`, `buildBlocks`, `applyBlockAccept`, `applyBlockReject`, `isMinifiedFile`).
- [x] Algoritmo de parse de hunks via `diff` (jsdiff, lazy) com números de linha 1-based.
- [x] Layout *Mobile-Stack*: linha removida (vermelho pálido) em cima, linha adicionada (verde pálido) embaixo.
- [x] Ações granulares: "Aceitar bloco" / "Rejeitar bloco" + "Aceitar tudo" / "Descartar".
- [x] Wiring no `app.js`: `editor.getDiffCandidates()` (arquivos sujos, `savedContent` vs atual) → diff no pane; aceitar grava no VFS e aplica no editor; rejeitar reverte bloco.
- [x] Arquivos `.min.*`/`.map` ignorados (`isMinifiedFile`).
- [x] Teste de lógica (accept/reject por bloco) validado em Node.

**Critérios de Aceite:**
- [x] Diff de arquivo modificado é renderizado em blocos corretos (add/del/mod).
- [x] Aceitar/Rejeitar por bloco reflete o resultado no VFS e no editor.
- [x] Arquivos minificados (`.min.js`, `.map`) são ignorados.

---

## Fase 3 — AI Agent & Context Layer (Step 4)

### S6 — Agent Drivers & Tool Executers ✅ Done

**Objetivo:** O "cérebro" da aplicação, traduzindo as intenções da IA em ações reais no celular.

- [x] Criar `src/js/agents/drivers/base-driver.js` (contrato: `parseResponse`/`extractMessage`).
- [x] **ClineDriver**: parsing de tags XML (`<write_to_file path>` / `<read_file>` / `<list_dir>`).
- [x] **OpenCodeDriver**: parsing de saída JSON (`{message, files:[{path, content}]}`).
- [x] **Tool Executor sandboxed** (`agents/tool-executor.js`): `write_file`/`read_file`/`list_dir`/`delete_file` com validação de path (`..`, `/`, `.git/`) e limite de 1MB.
- [x] `agent-manager.js` usa o driver ativo (OpenCode default; `setDriver` p/ Cline) + executa tools e devolve resultados para o contexto.
- [x] Teste dos drivers validado em Node (JSON + XML).

**Critérios de Aceite:**
- [x] Tool calls dos formatos (Cline/OpenCode) parseados corretamente.
- [x] Execução de tools validada (args, path, tamanho máximo).
- [x] Resultado de cada tool devolvido ao contexto do agente. *(KiloDriver: fica para S9.)*

### S7 — Chat Orchestrator & UI Streaming ✅ Done

**Objetivo:** Interface de comunicação fluida, sem *layout shifts* violentos durante a geração.
> **Nota:** existe **modo DEMO** no `agent-manager.js` (sem LLM) e **modo LIVE** com as APIs do usuário (S8).

- [x] `agent-manager.js` com **`AGENT_MODE` enum (`DEMO | LIVE`)** — falha rápida se `LIVE` sem provider configurado.
- [x] Streaming via `ReadableStream` (`streamReader`), incluindo `reasoning_content` (DeepSeek/Qwen).
- [x] Markdown sanitizado no chat via `marked` + `DOMPurify` (render ao finalizar, sem XSS).
- [x] Seção colapsável "Pensamento" (toggle "Pensar" + `<details>`).
- [x] **Gestão de janela de contexto**: `buildSystemPrompt(contextFiles)` injeta até 3 arquivos abertos (cap 8KB) via `editor.getOpenFilesContext()`.
- [x] **Histórico do chat persiste no VFS** (`chatHistory` em metadata, 60 msgs) e recarrega ao entrar na IDE.

**Critérios de Aceite:**
- [x] Resposta streama no chat sem re-render total (texto incremental + markdown no fim).
- [x] Markdown sanitizado (sem XSS).
- [x] Histórico persiste no VFS.
- [ ] Tool calls interrompem a stream e pedem aprovação — *aprovado via Diff no bottom sheet (S5), sem popup*.

### S8 — Providers & API Management ✅ Done

**Objetivo:** Resiliência de rede e flexibilidade de modelos.

- [x] Configuração segura de endpoints DeepSeek/Qwen/OpenAI (OpenAI-compatible) + **baseUrl/modelo sobrescrevíveis** no Settings.
- [x] Failover automático por prioridade (1→2→3) com as chaves do usuário.
- [x] **Timeout (120s)** via `AbortController`; **429/5xx** com backoff 1,2s antes de trocar de chave.
- [x] Botão "Parar" (AbortController acoplado ao fetch; distingue abort do usuário vs timeout).
- [x] Chaves cifradas (AES-GCM) em `users/{uid}/llm_keys`.

**Critérios de Aceite:**
- [x] Troca de provider/modelo sem recarregar o app.
- [x] Chaves nunca em texto puro no Firestore.
- [x] Erros de rede/rate-limit mostram mensagem clara (failover tenta a próxima chave).

---

## Fase 4 — Integração, Hardening & Deploy (Step 5)

### S9 — Workflow de Ponta-a-Ponta ✅ Done

**Objetivo:** Unificar as engrenagens.
> **Fluxo MVP Factory:** prompt → agente cria arquivos → revisar Diff → **Deploy** → CF `githubDeployProxy` (repo + Pages na conta do Owner) → URL + `projects/{uid}` no Firestore → toast/dashboard.

- [x] **Wiring:** Chat UI ↔ Agent Manager ↔ Drivers ↔ Tool Executor ↔ VFS ↔ Diff ↔ Deploy.
- [x] Fluxo completo: pedir alteração no chat → arquivos criados → aprovar Diff → **Publicar MVP** (header ou Git pane) → Pages + Firestore.
- [x] **GitPanel** usa a CF `githubDeployProxy` (PAT do Owner no Secret Manager — nunca no frontend).
- [x] **Novo projeto** (`resetWorkspace`): limpa VFS + abas após confirmação.
- [x] Sincronização de painéis (S4.5): tudo na mesma tela (drawer + sheet, sem `page` novo).

**Critérios de Aceite:**
- [x] Fluxo ponta-a-ponta (prompt → código → diff → deploy) implementado e deployado (Functions no ar).
- [x] Estado preservado ao navegar entre painéis.
- [ ] Homologado em teste real (aguarda `GITHUB_OWNER_PAT` + seed owner) — **S16**.

### S10 — Otimização PWA & Service Worker ✅ Done

**Objetivo:** Garantir que o app funcione como um app nativo baixado da App Store.

- [x] Build de produção + registro do Service Worker (`virtual:pwa-register` com `onNeedRefresh`/`onOfflineReady`).
- [x] **🪦 `sw.js`/`manifest.json` legados removidos** — só o SW do `vite-plugin-pwa` (evita cache duplo).
- [x] **Bundle enxuto:** removido o **Framework7** (mini-UI `ui/notify.js`) + CodeMirror **minimal** (sem autocomplete/lint/search) + **code-splitting nativo**. **Core eager ~156KB gzip + CSS 5,6KB**. Lazy: xlsx/mammoth/isomorphic-git/marked/DOMPurify/firebase.
- [x] Workbox: precache + `runtimeCaching` StaleWhileRevalidate p/ Google Fonts.
- [ ] Homologar Modo Avião rigorosamente — **S17**.
- [x] Manifest gera UI *Standalone* (PWA instalável).

**Critérios de Aceite:**
- [x] App opera offline após o primeiro acesso (SW + precache).
- [x] Nova versão detectada com pop-up de atualização.
- [x] Bundle core < 400KB gzipped (hoje **~156KB** — verificado no build).

### S11 — QA, Segurança & Auditoria 🔄

**Objetivo:** Eliminar vulnerabilidades e falhas críticas.

- [x] Auditoria contra XSS no chat — markdown sanitizado com **DOMPurify**; preview HTML em **iframe sandbox**; paths validadas no tool executor (`..`, `/`, `.git/`).
- [ ] Verificação de memory leaks: Alternar entre arquivos grandes no CodeMirror 50 vezes e checar o consumo de RAM no Safari. *(S18)*
- [x] Validação de Acessibilidade — ARIA labels nos botões/inputs; navegação por teclado no desktop.
- [x] **Firebase App Check** (reCAPTCHA Enterprise) — stub pronto; ativa ao preencher `appCheckSiteKey` no `firebase-config.js`. *(S18)*

**Critérios de Aceite:**
- [ ] Testes unitários dos drivers, VFS e git-service verdes (Vitest).
- [ ] E2E dos 3 fluxos principais (chat→tools, file CRUD, deploy) — **Fase 5 (S13–S19)**.
- [x] Auditoria de segurança sem falhas críticas (path traversal, XSS, secrets).
- [ ] Lighthouse ≥ 90 em Performance (hoje **72**), PWA, Best Practices (100) e Accessibility.

### S12 — Go Live 🚀

**Objetivo:** Lançamento de produção impecável.

- [x] Build limpo de produção (`npm run build`).
- [x] Deploy atômico via Firebase CLI (`firebase deploy --only hosting`) — **live em https://caim.web.app**.
- [ ] Instalação via "Add to Home Screen" em múltiplos iPhones reais. *(S19)*
- [x] Lighthouse executado — **Performance 72 · Best Practices 100 · FCP 1,9s · LCP 6,6s** (logo 483KB→15KB aplicado). Meta ≥90 na S19.

---

## Fase 5 — Homologação Ponta-a-Ponta (S13–S19)

> Fluxos mapeados na **jornada do cliente** em `docs/diagrams/journey.md` (J1–J7). Cada sprint de homologação testa um grupo de workflows **na ordem cronológica das sprints já entregues** (S0→S12). Sprint só é "done" com todos os cenários verdes em **device real + modo avião**.

### S13 — Homologação da Fundação & Auth (J1)

**Cobre:** S0 (PWA) · S1 (VFS) · S11 (auth-gate) · S12 (deploy).

- [ ] **PWA:** instalar via "Add to Home Screen"; abre standalone sem barra de URL; splash correto. *(device real)*
- [x] **Auth-gate:** visitante não logado vê só a tela de login; logout volta para login. *(verificado no boot; sem flash de IDE — fix 16/08)*
- [ ] **Cadastro:** criar conta nova (nome/email/senha/whatsapp) → `users/{uid}` criado no Firestore com `role: client`. *(device real)*
- [ ] **Login:** `gestor.renatorosa@gmail.com` entra; dashboard mostra nome. *(device real)*
- [ ] **Seed owner:** rodar `seed-admin` → `users/{uid}.role == 'owner'`; regra `config/{key}` só OWNER. *(requer service account GCP)*
- [x] **VFS:** criar/editar/renomear/excluir arquivo persiste após reload; `../` bloqueado com erro amigável. *(24 testes verdes + 2 fixes — 16/08)*
- [ ] **firestore.rules:** tentar ler `projects` de outro usuário → negado (testar com 2 contas). *(device real / rules simulator)*

**Critérios de Aceite:** zero console errors no fluxo completo; regras de Firestore aplicadas no console.

### S14 — Homologação de Configuração de APIs (J2)

**Cobre:** S8 (Providers) · Settings (auth-views).

- [x] Salvar até 3 chaves (DeepSeek/Qwen/OpenAI) com prioridade e modelo/baseUrl opcionais. *(coberto por teste jsdom — 16/08)*
- [x] Reabrir Settings → chaves persistem (cifradas no Firestore; campo de chave fica vazio). *(fix regressão + teste — 16/08)*
- [x] Desativar uma chave → não é usada no failover. *(filtro `active` + teste — 16/08)*
- [x] **Failover:** chave 1 inválida (401) → cai na 2; chave 2 com 429 → backoff e cai na 3. *(testes `agent-manager.test.js` — 16/08)*
- [x] **Cifragem:** conferir no Firestore que `llm_keys[].key` é objeto `{iv, ciphertext}` e nunca texto puro. *(teste round-trip — 16/08)*

**Critérios de Aceite:** troca de provider/modelo sem reload; nenhuma chave em texto puro.

### S15 — Homologação de Geração & Revisão (J3/J4)

**Cobre:** S6 (drivers/executor) · S7 (streaming/thinking/contexto/histórico) · S5 (diff).

- [ ] **Chat real (LIVE):** prompt → streaming no chat; resposta em markdown sanitizado; arquivos criados no VFS e abertos no editor.
- [ ] **Pensar:** toggle ativo mostra `reasoning_content` em bloco colapsável.
- [ ] **Parar:** interromper a geração → mensagem "_geração interrompida_".
- [ ] **Contexto:** com 2 arquivos abertos, pedir alteração citando-os → agente usa o conteúdo.
- [ ] **Histórico:** recarregar a página → chat recarrega as últimas mensagens.
- [ ] **Diff:** editar um arquivo → pane Diff lista; aceitar/rejeitar bloco reflete no VFS e no editor; `.min.js`/`.map` ignorados.
- [x] **Truncamento (S15-critical):** resposta cortada no meio de `<write_to_file>` ou de JSON → arquivo parcial salvo + aviso "Resposta truncada" no chat. *(Parser tolerante + `detectTruncation` — coberto por testes, 16/08.)*

**Critérios de Aceite:** sem XSS (injetar markdown malicioso → sanitizado); nenhum console error durante streaming/abort.

### S16 — Homologação de Deploy & IDE (J5/J6)

**Cobre:** S9 (deploy) · S3 (explorer) · S3.5 (viewer) · S4 (editor) · S2 (git).

- [ ] **Deploy ponta-a-ponta:** gerar MVP → revisar diff → clicar **Deploy** → `githubDeployProxy` cria repo na conta do Owner → Pages ativo → toast com URL → projeto salvo no dashboard.
- [ ] **Explorer:** abrir/visualizar/renomear/excluir via menu ⋯; upload de arquivo local.
- [ ] **Viewer:** preview de md/img/html/pdf/csv/docx/xlsx/pptx (upload de amostras).
- [ ] **Editor:** tabs, autosave 800ms, toolbar flutuante iOS, cursor/scroll preservados.
- [ ] **Git offline:** init → status → stage → commit → log sem rede.
- [ ] **Novo projeto:** `resetWorkspace` limpa arquivos e abas após confirmação.

**Critérios de Aceite:** URL do Pages abre em 1–5 min; histórico do MVP aparece no dashboard; deploy falha sem login com mensagem clara.

### S17 — Homologação de PWA & Performance (J7)

**Cobre:** S10 (bundle/SW).

- [ ] **Modo avião:** primeiro acesso online → depois abrir offline: app + editor + preview funcionam.
- [ ] **Atualização:** publicar nova versão → toast "Nova versão disponível" → atualizar sem perder dados.
- [ ] **Fonte pixel:** Press Start 2P carrega online e cacheia para offline (StaleWhileRevalidate).
- [ ] **Bundle:** `npm run build` → core eager < 400KB gzip (hoje ~156KB) + lazy chunks separados (xlsx/mammoth/isomorphic-git/marked/DOMPurify/firebase).

**Critérios de Aceite:** Lighthouse Performance ≥ 85 no dispositivo; nenhum asset 404 em modo avião.

### S18 — Homologação de Segurança (S11)

- [ ] **App Check:** preencher `appCheckSiteKey` no `firebase-config.js` → requisições protegidas.
- [ ] **XSS:** chat com markdown com `<img onerror>`, `<script>` → sanitizado (DOMPurify); preview HTML em iframe sandbox.
- [ ] **Memory:** alternar 50× entre arquivos grandes no editor → RAM estável no Safari.
- [ ] **Acessibilidade:** ARIA labels presentes; navegação por teclado no desktop.
- [x] **Path traversal:** tool executor rejeita `..`, `/abs`, `.git/`. *(testes verdes — incl. `listDir` e `.git` sem barra, 16/08)*
- [x] **Proxy CORS blindado:** `gitCorsProxy` com host-allowlist (só GitHub) + rate limit 50 req/min por uid/IP. *(aplicado em code; **redeploy de Functions pendente**)*

**Critérios de Aceite:** auditoria sem falhas críticas; Lighthouse Best Practices 100 (já verificado).

### S19 — Go Live Final 🚀

- [ ] Redeploy final de Hosting + Functions.
- [ ] Lighthouse ≥ 90 (Performance/PWA/Best Practices) em dispositivo real.
- [ ] Fluxo completo em 2 iPhones reais (Safari, 4G e modo avião).
- [ ] Feedback do cliente (jornada J0→J7) sem bloqueios.
- [ ] README com instruções de instalação e captura da jornada.

---

## Dependências entre Sprints

```text
S0 (✅) ──► S1 ──► S3 ──► S4.5 (UX IDE) ──► S4 ──► S5 ──► S9 ──► S10 ──► S11 ──► S12
          │      │                       │
          │      ├──► S3.5 ──────────────┤
          │      └──► S2 ────────────────┘
S6 ──► S7 ──► S8 ────────────────────────┘
```

- **S2 depende de S1** (o git usa o VFS/lightning-fs como backend de storage).
- **S5 depende de S2** (diffs derivam do status/área de staging do git).
- **S3, S3.5 e S4 dependem de S1** (operam sobre o VFS).
- **S4.5 (UX IDE) depende de S3, S3.5 e S4** (orquestra os componentes já construídos no novo shell; prioridade sobre agentes).
- **S7 depende de S6** (o orchestrator invoca os drivers) **e de S1**.
- **S9 depende de S3, S4, S5, S7 e S8** (workflow unificado).
- **S10/S11 só fazem sentido com S9 completo** (não se otimiza/hardeneia o que não existe).
- **S13–S19 (Homologação) seguem a ordem cronológica** de S0→S12, testando os workflows da jornada (J1–J7) — ver `docs/diagrams/journey.md`.

---

## Estratégia de Testes

| Camada        | Ferramenta | Escopo                                                                 |
| ------------- | ---------- | ---------------------------------------------------------------------- |
| **Unitários** | Vitest     | Drivers (parsing), VFS (CRUD/path), git-service (comandos), security.  |
| **Integração**| Vitest + jsdom | VFS ↔ Git, Drivers ↔ Tool Executor, editor ↔ auto-save.            |
| **E2E**       | Playwright | 3 fluxos principais: chat→tools, file CRUD, git workflow completo.     |
| **Mobile**    | Testes manuais | iPhones reais (Safari), modo avião, safe-areas, teclado flutuante. |

> **Regra:** cada sprint entrega seus testes junto do código. Sprint só é "done" com testes verdes.

---

## Estrutura de Pastas Alvo

```text
src/
├── css/
│   └── main.css                 # Design tokens + overrides F7 + layout IDE (S4.5)
├── js/
│   ├── app.js                   # Bootstrap F7 + layout controller (S4.5) + wiring + PWA update
│   ├── core/
│   │   ├── vfs-service.js       # VFS sobre Dexie (S1) — mime map + data URLs
│   │   └── event-emitter.js     # Pub/Sub de estado (S1)
│   ├── agents/                  # (futuro — S6/S7)
│   ├── git/                     # (futuro — S2)
│   └── ui/
│       ├── file-tree.js         # Explorer: árvore recursiva (S3)
│       ├── editor.js            # CodeMirror 6: tabs, autosave, linguagens (S4)
│       └── viewer.js            # Visualizador de arquivos (S3.5)
docs/
└── diagrams/
    ├── workflows.md             # Workflows de usuário em Mermaid (15/08)
    └── journey.md               # Jornada do cliente (J1–J7) + matriz de homologação (15/08)
public/
└── assets/                      # copiado de assets/ via scripts/copy-assets.mjs (predev/prebuild)
```

---

## Matriz de Riscos & Mitigação

| Risco Técnico Identificado                      | Impacto                                                               | Estratégia de Mitigação                                                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bloqueio de CORS no GitHub API**         | Alto (Impede o push/pull de código real).                            | Utilizar um proxy CORS confiável ou orientar a implantação de um Cloud Function simples no próprio Firebase para mediar o tráfego Git.  |
| **Safari Evicting IndexedDB**              | Alto (Perda de código não comitado se o celular ficar sem espaço). | Alertas na UI para comitar e fazer push frequentemente. Solicitar permissão de `persist()` na Storage API, se disponível.                 |
| **Travamento por Arquivos Gigantes**       | Médio (CodeMirror ou o Diff visual podem congelar a thread).         | Implementar um limite de tamanho (ex: 1MB) para carregar no editor. Evitar renderizar diffs de arquivos minificados (`.min.js`, `.map`). |
| **Quebra de Estado do Service Worker**     | Médio (Atualizações do PWA não refletem na tela).                 | Implementar um pop-up de "Nova versão disponível" que força o reload com a limpeza do cache usando `skipWaiting()`.                      |
| **Limitações de Memória em Background** | Baixo (Perda de contexto do chat ao trocar de app no iOS).            | Salvar o rascunho atual da textarea do chat e o log de mensagens no IndexedDB a cada nova linha renderizada.                                 |
| **Sem build tooling no repo hoje**         | ~~Médio~~ ✅ Resolvido | Vite 8 + `vite-plugin-pwa` + Vitest instalados. **Nota Vite 8 (rolldown):** `manualChunks` deve ser função. Assets copiados via `scripts/copy-assets.mjs` (evitar `includeAssets`, que emitia cópias hasheadas quebrando URLs). |
| **SW duplicado (`sw.js` legado + `vite-plugin-pwa`)** | Médio (Cache duplo / versão velha servida). | 🪦 Remover `sw.js` e `manifest.json` manuais no S10; manter apenas o SW gerado pelo plugin com `registerSW()` + `skipWaiting()`. |
| **Demo do chat vazar para o fluxo real**   | Médio (Arquivos falsos no VFS do usuário). | `AgentMode` enum `DEMO | LIVE` no `agent-manager.js` (S7); orchestrator falha rápido se `LIVE` sem provider. |
| **Chaves de API em texto puro**            | Alto (Vazamento de credenciais).                                     | Criptografia AES-GCM via Web Crypto; armazenar apenas ciphertext; escopo mínimo de permissão no GitHub.                                  |

---

## Critérios de Go Live

Checklist final antes do lançamento público:

- [ ] Lighthouse ≥ 95 em Performance, PWA, Best Practices.
- [ ] Bundle core < 400KB gzipped.
- [ ] Zero console errors em Safari/Chrome (rede real e modo avião).
- [ ] Fluxo completo: prompt → diff → commit → push testado em iPhone real.
- [ ] Deploy atômico via Firebase com rollback documentado.
- [ ] Analytics (Firebase) recebendo eventos de erro/uso.
- [ ] README/publicação com instruções de instalação PWA.

---

## Pós-Go-Live & Rollback

- **Monitoramento:** Firebase Analytics + Crash Reporting; watch dos endpoints de LLM.
- **Rollback:** reutilizar o deploy anterior via `firebase hosting:channel:deploy` ou restaurar build anterior no Hosting.
- **Iteração pós-lançamento:** roadmap do `context.md` (multi-repo, colaboração WebRTC, plugins, voz, iPad/desktop, cloud sync).