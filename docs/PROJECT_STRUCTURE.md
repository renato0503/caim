# CAIM (Cerra AI Mobile) - Project Structure

> Estrutura **real** do repositório (atualizada em 18/08/2026). Plano de sprints e pendências: [`implementation.md`](./implementation.md). Contexto e status: [`context.md`](./context.md).

## Stack Atual

- **App shell:** Layout IDE (S4.5) — activity bar + editor central + bottom sheet + explorer drawer; **sem framework** (Framework7 removido no S10, mini-UI `ui/notify.js`)
- **Build:** Vite 8 (rolldown) + `vite-plugin-pwa`
- **Persistência:** Dexie.js (IndexedDB) — Virtual File System (VFS)
- **Editor:** CodeMirror 6 (tabs, auto-save, linguagens)
- **Viewer:** `marked` + `DOMPurify` + `mammoth` + `xlsx` + `jszip` (lazy-load)

## Root Level

- `index.html` — **Landing page** pública (16-bit, honesta) — raiz `https://caim.web.app/`.
- `app.html` — **App (SPA)**: `screen-auth` (default) + `screen-dashboard` + `screen-settings` + `screen-ide` (layout IDE) — `https://caim.web.app/app`.
- `vite.config.js` — Vite 8 + `vite-plugin-pwa` (manifest, icons, splash; multi-page `index.html` + `app.html`). **21/08:** removida a referência morta ao Framework7 do `manualChunks` (fazia o dev server travar no optimizer quando o lockfile mudava).
- `package.json` — Scripts: `predev`/`prebuild` (copiam assets), `dev`, `build`, `preview`, `test` (Vitest).
- `INICIAR.bat` — Sobe o dev server e abre o navegador.
- `scripts/copy-assets.mjs` — Copia `assets/` → `public/assets/` (substitui o `includeAssets` do plugin).
- `firebase.json` — Firebase Hosting (projeto `cerraimobile`) + **CSP/security headers** (S18).
- `context.md` / `implementation.md` / `PROJECT_STRUCTURE.md` — Documentação do projeto.

## Source Structure (`src/`)

- `src/js/app.js` — Bootstrap + layout controller (S4.5) + auth-gate + wiring Chat/Explorer/Editor/Viewer/Diff/Git/Deploy + `onOpenProject` (S36) + **S42**: toggle de permissão (ask/review/auto), checklist de planos, "Reverter alteração da IA", `vfs:changed` com modo AUTO.
- `src/js/core/vfs-service.js` — VFS sobre Dexie: CRUD, rename, proteção de path, mime map, data URLs. **Dexie v2 (S36):** tabelas `projects` + `project_files` p/ o gestor de projetos. **v3 (S40/S41):** `projects` com `pinned`/`tags` + tabela `trashed` (lixeira).
- `src/js/core/project-service.js` — **Gestor de projetos locais (S36/S40/S41):** snapshots nomeados do workspace (`newProject`/`createFromWorkspace`/`saveProjectSnapshot`/`openProject`/`renameProject`/`markDeployed`), projeto ativo via `metadata`, `slugify`. **S40:** `PROJECT_TEMPLATES` (5 templates) + `newProjectFromTemplate`/`duplicateProject`/`togglePin`/`setTags`. **S41:** `exportProjectZip`/`importProjectZip` (JSZip, sanitize de paths + limites) e lixeira (`trashProject`/`listTrashed`/`restoreProject`/`purgeProject`/`emptyTrash`). Exclusão **só local** — nunca toca o GitHub.
- `src/js/core/event-emitter.js` — Pub/Sub de estado (emite `vfs:changed`).
- `src/js/core/editor-prefs.js` — Prefs do editor em `metadata` (tema 16-bit/Claro, fonte mono/pixel, tamanho) — **S39**.
- `src/js/core/snippets.js` — 10 snippets padrão por linguagem + `findSnippet` (prefixo `!` custom, `*` todas) — **S39**.
- `src/js/ui/file-tree.js` — Explorer (drawer): árvore recursiva + menu ⋯ (abrir/visualizar/renomear/excluir) + **ícones por extensão via `file-icons.js` (S37)**.
- `src/js/ui/file-icons.js` — SVGs lucide-stroke por extensão (html/css/js/ts/jsx/json/md/img/pdf/doc/xls/ppt/zip/txt/py + git/dotfiles) — **S37**.
- `src/js/ui/search-panel.js` — **Busca global (S38):** go-to-file (score exact > basename > path > subsequência) + Encontrar/Substituir todos no conteúdo, reversível pelo Diff.
- `src/js/ui/editor.js` — CodeMirror 6: tabs, auto-save 800ms, langs lazy, toolbar flutuante iOS (`⚡` com snippets — S39), compartments de tema/fonte, `savedContent`/contexto.
- `src/js/ui/viewer.js` — Visualizador: md/img/html/pdf/csv/docx/xlsx/pptx (libs lazy-load) — pane `preview`.
- `src/js/ui/diff-viewer.js` — Diff por blocos (aceitar/rejeitar) — pane `diff`.
- `src/js/ui/git-panel.js` — Pane Git (init/status/stage/commit/log + Deploy MVP).
- `src/js/ui/auth-views.js` — Telas de auth-gate: login/cadastro, **dashboard = gestor de projetos (S36/S40/S41)** (locais + publicados, "Novo projeto" com **action sheet de templates S40**, Continuar/Fixar/Duplicar/Tags/Exportar .zip/Renomear/Lixeira, busca/ordenação, **importar .zip e lixeira S41**), settings (3 APIs LLM cifradas + bloco Editor S39).
- `src/js/ui/chat-renderer.js` — Bubble legível (S31) + intenção "ver o site" (S34) — `buildFinalText`/`fileChips`/`detectViewIntent`.
- `src/js/ui/notify.js` — Mini-UI de sistema (toast/dialog/confirm/actions) — substitui o Framework7. **`duration:0` = toast persistente (S36b).** `actions({ title, buttons })` com `subtext` (S40).
- `src/js/agents/agent-manager.js` — Orquestrador de agentes (DEMO|LIVE, failover multi-API, streaming, thinking, contexto, truncamento, gate chitchat S32, memória S33, demo robusto S35). **S42 — Autonomia:** `PERMISSION` (ask/review/auto) por projeto em `metadata`, gate `ask` → `{ plan }`, `executePlan` (tudo/passo), `beginUndo`/`undoLastPlan`, `isBinaryPath`.
- `src/js/agents/tool-executor.js` — Executor sandboxed de tools (validação de path/tamanho).
- `src/js/agents/drivers/` — `base-driver.js`, `opencode-driver.js` (JSON), `cline-driver.js` (XML).
- `src/js/auth/auth-service.js` — Firebase Auth (signup/login/logout/onAuthStateChanged/reset senha/email verify).
- `src/js/db/db-service.js` — Firestore: `users/{uid}` (role + `llm_keys`), `projects` (listagem sem `orderBy` — ordenação no cliente).
- `src/js/firebase/firebase-config.js` — Config do Firebase (projeto `cerraimobile`).
- `src/js/security/security-service.js` — Web Crypto AES-GCM (PAT/API keys + chave determinística por UID).
- `src/js/git/git-service.js` + `git/vfs-fs.js` — isomorphic-git sobre o VFS (stat por hash de conteúdo) + proxy CORS.
- `src/js/utils/base64.js` — helpers de base64.
- `src/css/main.css` — Design tokens + layout IDE + auth/dashboard/settings + diff + git + 16-bit (Fase 7) + `.project-card*` (S36) + **S37/S38/S39/S40/S41/S42**: ícones por extensão, search drawer, settings do editor, `.dash-toolbar/.project-pin/.project-tags`, `.perm-toggle/.plan-check/.plan-undo-btn`; **botões dos cards em grid 2 colunas** (`.project-actions` — "Continuar" em linha cheia + 6 ações em 3×2, ajuste UX 18/08).
- `src/test/setup.js` — setup do Vitest (`fake-indexeddb` + `resetIndexedDB()` + polyfill `Range#getClientRects` p/ jsdom — S39).
- `vitest.config.js` — config isolada do Vite (sem plugin PWA) para os testes.
- `src/**/*.test.js` — **212 testes verdes (18/08)**: `vfs-service`, `event-emitter`, `security-service`, `tool-executor`, `agents/drivers/drivers`, `git/git-service` (git offline), `agents/agent-manager` (failover + streaming/thinking/abort/contexto + **chitchat/memória/demo S32/S33/S35** + **autonomia/planos/undo S42**), `ui/auth-views` (Settings + **gestor de projetos S36/S40/S41**), `ui/chat-renderer` (**bubble legível + "ver o site" S31/S34**), `ui/notify` (**toast persistente S36b**), `core/project-service` (**snapshots S36 + templates/duplicar/pin/tags/zip/lixeira S40/S41**), `ui/diff-viewer` (blocos aceitar/rejeitar), `ui/file-tree` (explorer + **ícones S37**), `ui/viewer` (XSS), `ui/search-panel` (**busca S38**), `core/snippets` + `core/editor-prefs` + `ui/editor` (**editor S39**).

## Functions (`functions/`)

- `functions/src/index.js` — `githubDeployProxy` (deploy na conta do Owner via octokit + Secret Manager; **Contents API** — cria commit inicial e atualiza arquivos em repos vazios) + `gitCorsProxy` (push via isomorphic-git).
- `functions/src/seed-admin.js` — define `users/{uid}` como OWNER (UID via env, nunca commitar).

## Regras (`firestore.rules`)

- `users/{uid}`: dono lê/escreve. `projects/{id}`: dono. `config/{key}`: só OWNER (cofre).

## Assets (`assets/`)

- `assets/icons/` — `logo_caim.svg` (base 16-bit), `icon-16/32/192/512.png`, `apple-touch-icon.png` (180), `maskable-192/512.png`, `favicon.ico` (todos gerados por `scripts/generate-icons.mjs`).
- `assets/splash/` — 10 splash screens iOS (geradas a partir do logo).
- `assets/` é copiado para `public/assets/` pelo `scripts/copy-assets.mjs` em `predev`/`prebuild`.

## Docs (`docs/`)

- `implementation.md` — Plano mestre de sprints (S0–S36b) + registro de progresso.
- `context.md` — Contexto, arquitetura, stack e status.
- `AUDIT.md` — Diagnóstico completo (testes/build/deploy/headers/PWA) + atualizações S31–S36b.
- `layout.md` — Arquitetura de Layout 16-bit (design system retro gamificado) — aprovada para a Fase 7.
- `diagrams/workflows.md` — Workflows de usuário em **Mermaid.js** (ciclo do agente, navegação, preview, git).
- `diagrams/journey.md` — Jornada do cliente (J0–J7) + matriz de homologação.

## Build Output (`public/`)

- `public/assets/` — cópia de `assets/` (gerado).
- Demais arquivos de `public/` — gerados pelo Vite em `npm run build` (consumidos pelo SW).

## Roadmap (pendências)

1. **S13–S19 — homologação ✅ automática** (testes + hardening + deploy final 16/08); **device real ⏳**: PWA install, cadastro/login, `seed-admin`, `GITHUB_OWNER_PAT`, chaves LLM, regras com 2 contas, Lighthouse ≥ 90, modo avião, 2 iPhones.
2. **S20–S26 (Fase 6) ✅** — correções da auditoria (auth resiliente, APIs, geração/contexto, diff, deploy, offline, segurança).
3. **S27–S30 (Fase 7) ✅** — **Retrofit 16-bit** conforme `layout.md` (fontes pixel, components core, interações/VFX, polish).
4. **Fase 8 (S31–S36b) ✅** — correções da auditoria do chat (bubble legível, gate chitchat, memória, "ver o site", demo robusto) + **gestor de projetos (S36)** + **toast de deploy persistente (S36b)**.
5. **Fase 9 (S37–S53) 🔄 — em andamento.** Feitas até agora (18/08): **S37 ✅** ícones por extensão · **S38 ✅** busca fuzzy + Find/Replace · **S39 ✅** editor avançado (snippets + tema/fonte, pendentes: atalhos custom e multi-cursor) · **S40 ✅** templates + dashboard UX (duplicar/pin/tags/busca) · **S41 ✅** export/import `.zip` + lixeira · **S42 ✅** autonomia controlada (ask/review/auto, planos, undo). **Faltam: S43–S53** (multi-agente/drivers, multimodal/TTS, memória/RAG, git avançado, deploy contínuo, preview de apps, cloud sync, colaboração, onboarding/i18n, diagnóstico/push, segurança/infra) + **validar Fase 9 em device real**.
6. **S11 🔄** — ativar App Check (`appCheckSiteKey`), auditoria memória (S18).
7. **Node 20 → 22 nas Functions** (runtime deprecado — decomissiona 2026-10-30).
8. **README de instalação** + captura da jornada (S19).
9. **Validar S36–S42 em device real** — gestor de projetos (Novo/templates/Continuar/Duplicar/Lixeira/Importar .zip), toast persistente do deploy, permissões/planos/undo (S42) e busca (S38) no iPhone/PWA.
10. **Postergadas** — KiloDriver, conflitos de merge, virtualização da árvore, swipe de gestos.
11. **Roadmap pós-Go-Live (restante)** — chaves LLM só-locais (opção), Cloud Sync (RxDB) multi-device, colaboração (ver `context.md` §12).

## Planned Architecture (alvo)

1. VFS Layer: Dexie.js/IndexedDB + lightning-fs.
2. Agent Layer: múltiplos drivers de agente (Cline/OpenCode/Kilo) com execução de tools.
3. Git Layer: isomorphic-git in-browser (implementado — git offline coberto por teste).
4. UI Layer: CodeMirror 6, chat, diff viewer, file viewer — orquestrados no layout IDE (S4.5 ✅).