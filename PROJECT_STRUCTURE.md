# CAIM (Cerra AI Mobile) - Project Structure

> Estrutura **real** do repositório (atualizada em 16/08/2026). Plano de sprints e pendências: [`implementation.md`](./implementation.md). Contexto e status: [`context.md`](./context.md).

## Stack Atual

- **App shell:** Layout IDE (S4.5) — activity bar + editor central + bottom sheet + explorer drawer; **sem framework** (Framework7 removido no S10, mini-UI `ui/notify.js`)
- **Build:** Vite 8 (rolldown) + `vite-plugin-pwa`
- **Persistência:** Dexie.js (IndexedDB) — Virtual File System (VFS)
- **Editor:** CodeMirror 6 (tabs, auto-save, linguagens)
- **Viewer:** `marked` + `DOMPurify` + `mammoth` + `xlsx` + `jszip` (lazy-load)

## Root Level

- `index.html` — App shell: `screen-auth` (default, sem flash de IDE) + `screen-dashboard` + `screen-settings` + `screen-ide` (layout IDE: activity bar + workspace + bottom sheet + explorer drawer).
- `vite.config.js` — Vite 8 + `vite-plugin-pwa` (manifest, icons, splash; `manualChunks` como função por causa do rolldown).
- `package.json` — Scripts: `predev`/`prebuild` (copiam assets), `dev`, `build`, `preview`, `test` (Vitest).
- `INICIAR.bat` — Sobe o dev server e abre o navegador.
- `scripts/copy-assets.mjs` — Copia `assets/` → `public/assets/` (substitui o `includeAssets` do plugin).
- `firebase.json` — Firebase Hosting (projeto `cerraimobile`) + **CSP/security headers** (S18).
- `context.md` / `implementation.md` / `PROJECT_STRUCTURE.md` — Documentação do projeto.

## Source Structure (`src/`)

- `src/js/app.js` — Bootstrap + layout controller (S4.5) + auth-gate + wiring Chat/Explorer/Editor/Viewer/Diff/Git/Deploy.
- `src/js/core/vfs-service.js` — VFS sobre Dexie: CRUD, rename, proteção de path, mime map, data URLs.
- `src/js/core/event-emitter.js` — Pub/Sub de estado (emite `vfs:changed`).
- `src/js/ui/file-tree.js` — Explorer (drawer): árvore recursiva + menu ⋯ (abrir/visualizar/renomear/excluir).
- `src/js/ui/editor.js` — CodeMirror 6: tabs, auto-save 800ms, langs lazy, toolbar flutuante iOS, `savedContent`/contexto.
- `src/js/ui/viewer.js` — Visualizador: md/img/html/pdf/csv/docx/xlsx/pptx (libs lazy-load) — pane `preview`.
- `src/js/ui/diff-viewer.js` — Diff por blocos (aceitar/rejeitar) — pane `diff`.
- `src/js/ui/git-panel.js` — Pane Git (init/status/stage/commit/log + Deploy MVP).
- `src/js/ui/auth-views.js` — Telas de auth-gate: login/cadastro, dashboard (MVPs), settings (3 APIs LLM cifradas).
- `src/js/ui/notify.js` — Mini-UI de sistema (toast/dialog/confirm/actions) — substitui o Framework7.
- `src/js/agents/agent-manager.js` — Orquestrador de agentes (DEMO|LIVE, failover multi-API, streaming, thinking, contexto, truncamento).
- `src/js/agents/tool-executor.js` — Executor sandboxed de tools (validação de path/tamanho).
- `src/js/agents/drivers/` — `base-driver.js`, `opencode-driver.js` (JSON), `cline-driver.js` (XML).
- `src/js/auth/auth-service.js` — Firebase Auth (signup/login/logout/onAuthStateChanged).
- `src/js/db/db-service.js` — Firestore: `users/{uid}` (role + `llm_keys`), `projects`.
- `src/js/firebase/firebase-config.js` — Config do Firebase (projeto `cerraimobile`).
- `src/js/security/security-service.js` — Web Crypto AES-GCM (PAT/API keys).
- `src/js/git/git-service.js` + `git/vfs-fs.js` — isomorphic-git sobre o VFS (stat por hash de conteúdo) + proxy CORS.
- `src/js/utils/base64.js` — helpers de base64.
- `src/css/main.css` — Design tokens + layout IDE + auth/dashboard/settings + diff + git.
- `src/test/setup.js` — setup do Vitest (`fake-indexeddb` + `resetIndexedDB()`).
- `vitest.config.js` — config isolada do Vite (sem plugin PWA) para os testes.
- `src/**/*.test.js` — **51 testes verdes (16/08)**: `vfs-service`, `event-emitter`, `security-service`, `tool-executor`, `agents/drivers/drivers`, `git/git-service` (git offline), `agents/agent-manager` (failover), `ui/auth-views` (Settings).

## Functions (`functions/`)

- `functions/src/index.js` — `githubDeployProxy` (deploy na conta do Owner via octokit + Secret Manager) + `gitCorsProxy` (push via isomorphic-git).
- `functions/src/seed-admin.js` — define `users/{uid}` como OWNER (UID via env, nunca commitar).

## Regras (`firestore.rules`)

- `users/{uid}`: dono lê/escreve. `projects/{id}`: dono. `config/{key}`: só OWNER (cofre).

## Assets (`assets/`)

- `assets/icons/` — `logo_caim.png` (base 1024²), `icon-16/32/192/512.png`, `apple-touch-icon.png` (180), `maskable-192/512.png`, `favicon.ico`.
- `assets/splash/` — 10 splash screens iOS (geradas a partir do logo).
- `assets/` é copiado para `public/assets/` pelo `scripts/copy-assets.mjs` em `predev`/`prebuild`.

## Docs (`docs/`)

- `docs/diagrams/workflows.md` — Workflows de usuário em **Mermaid.js** (ciclo do agente, navegação, preview, git).

## Build Output (`public/`)

- `public/assets/` — cópia de `assets/` (gerado).
- Demais arquivos de `public/` — gerados pelo Vite em `npm run build` (consumidos pelo SW).

## Roadmap (pendências)

1. **S13 🔄** — parte automática ✅ (VFS/auth-gate/testes git offline); **device real**: PWA install, cadastro/login, `seed-admin`, `GITHUB_OWNER_PAT`, regras com 2 contas.
2. **S14 🔄** — automação ✅ (Settings 3 APIs cifradas + failover cobertos por teste); **device real**: chaves reais no Firestore.
3. **S15–S19** — homologação da jornada J3–J7 (geração+diff, deploy+IDE, offline, segurança, Go Live); ver `docs/diagrams/journey.md`.
4. **S11 🔄** — ativar App Check (`appCheckSiteKey`), auditoria memória (S18).
5. **S18/S19** — **redeploy de Functions** (hardening do `gitCorsProxy` já no code); Lighthouse ≥ 90, iPhones reais.
6. **Postergadas** — KiloDriver, conflitos de merge, virtualização da árvore, swipe de gestos.
7. **Roadmap pós-Go-Live** — chaves LLM só-locais (opção), Cloud Sync (RxDB) multi-device, colaboração (ver `context.md` §12).

## Planned Architecture (alvo)

1. VFS Layer: Dexie.js/IndexedDB + lightning-fs.
2. Agent Layer: múltiplos drivers de agente (Cline/OpenCode/Kilo) com execução de tools.
3. Git Layer: isomorphic-git in-browser (implementado — git offline coberto por teste).
4. UI Layer: CodeMirror 6, chat, diff viewer, file viewer — orquestrados no layout IDE (S4.5 ✅).