# CAIM - Context & Strategy

> **Cerra AI Mobile (CAIM)** — Mobile-first AI coding agent interface running entirely in the browser as a Progressive Web App (PWA).

**Documentos Relacionados:**
- [implementation.md](./implementation.md) — Plano mestre de sprints (S0–S30) até o Go Live, com critérios de aceite, dependências e estratégia de testes.
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — Estrutura de pastas e arquitetura planejada.
- [layout.md](./layout.md) — Arquitetura de Layout 16-bit (design system retro gamificado) — aprovada para a Fase 7.
- [diagrams/workflows.md](./diagrams/workflows.md) — Workflows de usuário (Mermaid) com cobertura de testes por fluxo.
- [diagrams/journey.md](./diagrams/journey.md) — Jornada do cliente (J0–J7) com as sprints de homologação.

---

## Status Atual (Snapshot — 2026-08-16)

| Área                      | Estado                                   | Observação                                                                              |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| **App shell (S0/S4.5)**   | ✅ Concluído                    | **Layout IDE** (activity bar + editor central + bottom sheet + drawer) em **JS puro** (mini-UI `notify.js`) + Vite 8 + `vite-plugin-pwa`. *(Framework7 removido no S10 — core enxuto.)* |
| **Build tooling**   | ✅ Instalado                   | Vite 8 (rolldown), `scripts/copy-assets.mjs`, `INICIAR.bat`. Dev em `http://localhost:5173/`. |
| **VFS (S1)**        | ✅ Concluído                    | `vfs-service.js` (Dexie: CRUD, rename, path protection, data URLs) + `event-emitter.js`. |
| **Git (S2)**        | ✅ Concluído                    | `git-service.js` (isomorphic-git + VFS adapter) + `security-service.js` (AES-GCM) + CF `gitCorsProxy` no ar. |
| **Explorer (S3)**   | ✅ Concluído                    | Árvore + drawer + upload + renomear/excluir (menu ⋯). |
| **Editor (S4)**     | ✅ Concluído                    | CodeMirror 6: tabs, autosave 800ms, langs lazy, **toolbar flutuante iOS**. |
| **Viewer (S3.5)**   | ✅ Concluído                    | Preview md/img/html/pdf/csv/docx/xlsx/pptx no pane `preview`. |
| **Diff (S5)**       | ✅ Concluído                    | Diffs por bloco no bottom sheet (aceitar/rejeitar). |
| **Agentes (S6/S7/S8)** | ✅ Concluído                | Drivers (JSON/XML) + Tool Executor + failover multi-API + streaming/thinking/abort + contexto. |
| **SaaS (auth-gate)** | ✅ Em produção                | Login/cadastro obrigatórios, dashboard de MVPs, **Settings simplificado (cole a chave → provider autodetectado por prefixo)** com 6 providers (deepseek/qwen/openai/nvidia/groq/opencode), deploy via CF `githubDeployProxy` (PAT do Owner no Secret Manager). |
| **Deploy**          | ✅ Live                        | **https://caim.web.app** (landing) · **https://caim.web.app/app** (IDE) · Functions `githubDeployProxy` + `gitCorsProxy`. |
| **Firebase config** | ✅ Real                        | `projectId: cerraimobile` · Blaze · Auth + Firestore (usuário `gestor.renatorosa@gmail.com`). |
| **Performance (S10)** | ✅ Core ~156KB gzip        | Framework7 removido (mini-UI `notify.js`), CodeMirror minimal, code-splitting nativo. CSS 5,6KB. Lazy: xlsx/mammoth/isomorphic-git/firebase. |
| **Testes (Vitest)** | ✅ 99 verdes (16/08)      | `fake-indexeddb` + `vitest.config.js` + `jsdom`. Cobre: VFS (CRUD/path/persistência/eventos), EventEmitter, SecurityService (AES-GCM + derivação por UID), Drivers (JSON/XML + truncamento), Tool Executor (path traversal), **Git offline**, **Failover multi-API (401/429/prioridade)**, **Settings 3 APIs cifradas**, **streaming/thinking/abort/contexto**, **Diff blocks (aceitar/rejeitar/minified)**, **Explorer (file-tree)**, **Viewer XSS (markdown/csv/html/xlsx/docx)**. |
| **Hardening (16/08)** | ✅ Aplicado              | `gitCorsProxy` com host-allowlist GitHub + rate limit 50 req/min por usuário/IP · parser dos drivers tolerante a **truncamento** (S15) · `syncViewport` com throttle `requestAnimationFrame` (jitter do teclado iOS) · **CSP/security headers no Hosting (ao vivo)** · **XSS no viewer (DOMPurify em xlsx/docx/markdown)** · **gitFs com stat por hash de conteúdo**. |
| **Git**             | ✅ Commitado/pushado           | `main` no `github.com/renato0503/caim`. **S13–S19 automático commitado** · Functions + Hosting redeployados (16/08). |
| **Admin SDK (owner)** | ✅ Ativo (16/08)          | Service account `firebase-adminsdk-fbsvc@cerraimobile` guardado **fora do repo** (`C:\Users\Renato\AppData\Local\Temp\opencode\caim-service-account\service-account.json`, restrito) — usado p/ gravar **llm_keys do owner diretamente no Firestore** cifradas com a chave derivada do UID (`seed-llm-keys.cjs`). *Nunca commitar o JSON nem as chaves LLM.* |
| **Chaves LLM (owner)** | ✅ Gravadas (16/08)     | 5 entradas em `users/O4iLGZdl0DYVJfcROrcZI6eFTdA3/llm_keys` cifradas com `deriveUserKey(uid)`: **Groq** (llama-3.3-70b-versatile) ✅ **200 OK** · **OpenCode Zen** (`https://opencode.ai/zen/v1` + nemotron-3.5-lightning-free) ✅ **200 OK** · **NVIDIA** (meta/llama-3.1-8b-instruct) ✅ **200 OK** + NVIDIA antiga (timeout, modelo 3.3) · **DeepSeek** ❌ **402 saldo zerado**. |
| **Criptografia LLM keys** | ✅ Novo modelo (16/08)   | `security-service.js`: além da master key local (PATs), **chave determinística por UID** (`deriveUserKey` = SHA-256(`caim-llm-v1::` + uid) → AES-GCM 256) — **compatível Admin SDK ↔ app** (`encryptForUser`/`decryptForUser`). `saveSettings`/botão Testar usam `encryptKey()`; `agent-manager.decryptKey(uid, entry)` decifra com uid quando logado. |
| **Pendências**      | 🔄 **device real ⏳** (PWA iPhone, cadastro/login reais, regras Firestore 2 contas, Lighthouse ≥ 90, modo avião, iPhones), **testar chaves gravadas** (DeepSeek 402 saldo, NVIDIA timeout, OpenCode sem baseUrl), **App Check** (`appCheckSiteKey`), **Node 20 → 22 nas Functions** (decomissiona 2026-10-30), README de instalação | |

> **Próximo passo:** **homologação final em device real** (PWA iPhone, cadastro/login, regras 2 contas, Lighthouse ≥ 90) + **testar no app real** (Groq/OpenCode/NVIDIA ok — DeepSeek requer saldo) + **App Check** + upgrade das Functions para Node 22. Depois o README de instalação e Go Live oficial.

---

## 1. Vision & Objectives

### 1.1 Vision

CAIM is a 100% mobile-first, web-based IDE and AI coding agent interface designed specifically for the iPhone. It democratizes and mobilizes the power of AI-assisted software engineering, eliminating the need for native app installation, backend infrastructure, or traditional file system access. It is built to be a self-contained, high-performance ecosystem directly in the user's pocket.

### 1.2 Core Objectives

* **Mobile-Native Engineering:** Highly optimized for iOS Safari utilizing touch-first interactions, dynamic safe area insets (`env(safe-area-inset-*)`), and seamless PWA installability for a native app feel.
* **Offline-First & Resilient:** Full functionality without an internet connection post-initial load. Utilizes Service Workers and an IndexedDB-backed Virtual File System (VFS) for absolute persistence.
* **Zero-Backend Architecture:** 100% client-side execution. External network requests are strictly limited to LLM API endpoints (streaming) and GitHub REST/GraphQL endpoints.
* **Agent-Agnostic Abstraction:** A modular core designed to seamlessly mount multiple AI agent drivers (OpenCode, Cline, Kilo Code) via a standardized tool-calling interface.
* **Git-Native Operations:** True version control on mobile using `isomorphic-git` and `lightning-fs`, allowing standard Git workflows (clone, add, commit, push, pull) entirely within the browser.
* **Security & Compliance:** Client-side encryption for Personal Access Tokens (PATs) and API keys using the Web Crypto API, ensuring zero credential leakage.

---

## 2. Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                               CAIM Mobile PWA                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐           │
│  │    Chat UI     │   │   Editor UI    │   │ File/Diff UI   │           │
│  │  (DOM Stream)  │   │ (CodeMirror 6) │   │ (Side-by-side) │           │
│  └───────┬────────┘   └───────┬────────┘   └───────┬────────┘           │
│          │                    │                    │                    │
│          └────────────────────┼────────────────────┘                    │
│                               ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    State Management & Events                     │   │
│  │                 (Vanilla JS Pub/Sub or Proxies)                  │   │
│  └────────────────────────────┬─────────────────────────────────────┘   │
│                               │                                         │
│                               ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                   Agent Manager (Orchestrator)                   │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐  │   │
│  │  │ ClineDriver  │ │OpenCodeDriver│ │ KiloDriver   │ │ Custom  │  │   │
│  │  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────┬────┘  │   │
│  └─────────┼────────────────┼────────────────┼──────────────┼───────┘   │
│            │                │                │              │           │
│            └────────────────┼────────────────┼──────────────┘           │
│                             ▼                ▼                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     Virtual File System (VFS)                    │   │
│  │              (IndexedDB via Dexie.js + lightning-fs)             │   │
│  └─────────┬────────────────────────────────────────────────┬───────┘   │
│            │                                                │           │
│            ▼                                                ▼           │
│  ┌──────────────────┐                             ┌─────────────────┐   │
│  │   Git Service    │                             │ Security Module │   │
│  │ (isomorphic-git) │                             │  (Web Crypto)   │   │
│  └──────────────────┘                             └─────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

```

---

## 3. Comprehensive Tech Stack

| Domain                    | Technology                            | Implementation Purpose                                                             |
| ------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| **Frontend Core**   | JS puro (ESM) + mini-UI `notify.js` + HTML5/CSS3 | App shell (activity bar, bottom sheet, drawer, dark theme, dialogs/toasts). *(Framework7 removido no S10.)* |
| **Build & Tooling** | Vite 8 + `vite-plugin-pwa`            | HMR, minificação, code-splitting e PWA. ✅ Instalado (rolldown: `manualChunks` em função). |
| **Hosting & CDN**   | Google Firebase Hosting               | Global edge caching, SSL, SPA routing rewrites, e PWA manifest delivery. ✅ |
| **PWA Engine**      | Service Worker + `virtual:pwa-register`| Registro de SW com `onNeedRefresh`/`onOfflineReady`; `generateSW` + google-fonts StaleWhileRevalidate. ✅ |
| **VFS Database**    | Dexie.js (IndexedDB)                  | Reactive, asynchronous database wrapping for the local file system. ✅ (S1)        |
| **Editor Engine**   | CodeMirror 6                          | Modular architecture, mobile touch support, dynamic syntax highlighting, toolbar flutuante iOS. ✅ (S4) |
| **File Viewer**     | `marked` + `DOMPurify` + `mammoth` + `xlsx` + `jszip` | Preview de md/img/html/pdf/csv/docx/xlsx/pptx com lazy-load e sanitização XSS. ✅ (S3.5/S18) |
| **Version Control** | `isomorphic-git` + VFS adapter (`vfs-fs.js`) | Git offline (init/add/commit/log) + push via `gitCorsProxy`. ✅ (S2) |
| **Security**        | Web Crypto API                        | AES-GCM para PATs (master key local IndexedDB) e **llm_keys com chave determinística por UID** (compatível Admin SDK ↔ app). ✅ (S2/16-08) |
| **Icons**           | Lucide Icons (SVG inline)             | Lightweight, scalable SVG integration.                                             |
| **Testing**         | Vitest + jsdom + `fake-indexeddb`     | **99 testes verdes**; E2E (Playwright) planejado. |

---

## 4. Core Modules Specification

### 4.1 Virtual File System (VFS)

**File:** `src/js/core/vfs-service.js`

* **Storage Engine:** IndexedDB managed via Dexie.js for state, layered with `lightning-fs` specifically to support `isomorphic-git` requirements.
* **Database Schema (Dexie):**

```javascript
db.version(1).stores({
  files: 'path, content, lastModified, mimeType',
  directories: 'path, parentId',
  metadata: 'key, value'
});

```

* **Operations:** Promisified `createFile`, `readFile`, `updateFile`, `deleteFile`, `listDir`, `ensureDir`.
* **Event Emitters:** Triggers `vfs:changed` events to automatically update the Editor UI and Diff Viewer upon AI modifications.

### 4.2 Agent Driver Architecture

**Files:** `src/js/agents/agent-manager.js`, `src/js/agents/drivers/*.js` · **Stub atual:** `src/js/drivers/base-agent.js`

**BaseAgent Interface (Contract):**

```javascript
export class BaseAgent {
  /** @param {string} prompt - The user input */
  async sendPrompt(prompt) { throw new Error('Not implemented'); }

  /** @param {string} response - Full/streamed LLM response */
  async parseResponse(response) { throw new Error('Not implemented'); }

  /** @param {string} toolName - Tool identifier */
  /** @param {Object} args - Validated tool arguments */
  async executeTool(toolName, args) { throw new Error('Not implemented'); }
}
```

**Driver Implementations:**

* `ClineDriver`: Parses streaming XML tags (`<thinking>`, `<write_to_file path="...">`).
* `OpenCodeDriver`: Parses JSON-based or Markdown-fenced tool commands natively used by OpenCode.
* `KiloCodeDriver`: Custom parser for specific Kilo Code prompt instructions.

**Tool Execution Lifecycle:**

1. LLM streams response.
2. Driver intercepts tool invocation signatures.
3. Driver pauses stream, requests user permission via UI (if required).
4. Tool executes against VFS (e.g., modifying `index.html`).
5. Driver injects tool result back into context and resumes LLM generation.

### 4.3 GitHub & Synchronization Layer

**File:** `src/js/git/git-service.js`

* **Repository Management:** Capable of handling multiple repos by scoping `lightning-fs` directories.
* **Network Operations:** Utilizes an open or self-hosted CORS proxy (e.g., `cors-anywhere`) to bypass browser limitations during `git clone`, `git fetch`, and `git push`.
* **Authentication Flow:**

1. User inputs GitHub PAT.
2. Token is encrypted via `SecurityService` (Web Crypto API).
3. Encrypted token is stored in `IndexedDB`.
4. Decrypted dynamically only during `isomorphic-git` network calls.

### 4.4 Mobile UI/UX Engine

**Files:** `src/css/main.css`, `index.html`

* **Layout Strategy (S4.5 — Layout IDE):** Fixed viewport (`user-scalable=no`), preventing native iOS zooming during typing. Estrutura em flexbox: **Activity Bar lateral (48px)** + **Editor central sempre visível** + **Bottom Sheet retrátil** (Chat/Diff/Preview/Git) + **Explorer drawer** sobreposto (`translateX`). Zero troca de tela.
* **Bottom Sheet:** Fixo ao rodapé (`position: fixed; bottom: 0`), altura 48px recolhido até ~80% do `visualViewport` expandido, arrastável por touch nativo; `padding-bottom: env(safe-area-inset-bottom)` para o home indicator do iPhone.
* **Code Editor Enhancements:**
  * Floating Action Toolbar: Injected dynamically above the iOS virtual keyboard providing one-tap access to `{ }`, `[ ]`, `( )`, `<`, `>`, `=`, and `TAB`. *(Ancorar via `window.visualViewport` + `view.scrollDOM.getBoundingClientRect()`.)*
  * Debounced auto-save to VFS (800ms after last keystroke).
* **Diff Viewer Engine (S5):**
  * Generates a structured visual map of file changes before committing — vive no **pane `diff` do bottom sheet**, lado a lado com o editor em cima.
  * Mobile-friendly blocks (Deletions in faint red background, Additions in faint green background).
  * Sticky header with "Approve" / "Reject" actions.

---

## 5. Execution Plan & Phasing

| Phase             | Focus Area                          | Key Deliverables                                                                          | Status      |
| ----------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- | ----------- |
| **Phase 1** | **Infrastructure & PWA Core** | App shell (JS puro) + Vite 8 + PWA, manifest, sw.js, firebase.json, logo/dark theme. | ✅ Complete |
| **Phase 2** | **Storage & Versioning**      | VFS (Dexie) ✅ · `git-service.js` (isomorphic-git + `vfs-fs`) ✅ · SecurityService AES-GCM ✅. | ✅ Complete |
| **Phase 3** | **Editing & Rendering**       | Explorer ✅ · Editor ✅ · Viewer ✅ · **S4.5 Layout IDE** (activity bar + bottom sheet + toolbar flutuante iOS) ✅. | ✅ Complete |
| **Phase 4** | **AI Orchestration**          | `AgentManager` ✅ · Drivers (JSON/XML) ✅ · failover multi-API + streaming/thinking/abort/contexto ✅. | ✅ Complete |
| **Phase 5** | **Security & Polish**         | Web Crypto PAT/API keys ✅ · CSP/security headers ✅ · XSS viewer ✅ · gitCorsProxy blindado ✅ · offline (S17) ⏳ device real. | 🔄 Quase (device real) |

---

## 6. Strict Functional Requirements

### 6.1 Chat & AI Interaction

* [x] Connect securely to external LLM APIs (DeepSeek, Qwen) using fetch streams. *(failover multi-API, streaming — S8/S14)*
* [x] Render Markdown and syntax-highlighted code blocks dynamically within the chat. *(marked + DOMPurify sanitização)*
* [x] Expose an interactive "Thinking Process" toggle for complex model reasoning. *(`reasoning_content` — S7)*
* [ ] Implement user-approval popups for destructive AI file operations. *(diff aceitar/rejeitar cobre a revisão; popup de confirmação de exclusão no explorer ✅)*

### 6.2 Code Editing Experience

* [ ] Ensure CodeMirror 6 responds smoothly to touch-and-drag selection. *(device real ⏳)*
* [x] Maintain cursor position and file state across tab switches.
* [ ] Implement semantic file search within the local directory structure. *(roadmap pós-Go-Live)*

### 6.3 File Management & Git

* [x] Visual file tree with collapsible directories.
* [x] One-click staging and committing process. *(Git pane: init/status/stage/commit/log)*
* [ ] Conflict resolution UI (fallback to manual text editing if Git merge fails). *(roadmap)*

> **Novo (15/08):** Visualizador de arquivos (S3.5) — preview de Markdown/imagem/HTML/PDF/CSV/DOCX/XLSX/PPTX com lazy-load; wireframes e crítica em `implementation.md`.

---

## 7. Non-Functional Requirements & Performance Targets

* **Bundle Size:** Core JavaScript application must remain under 500KB (gzipped). *(hoje ~156KB gzip)*
* **Time to Interactive (TTI):** Under 1.5 seconds on a standard 4G mobile connection.
* **Memory Management:** Aggressive garbage collection of old chat streams and diffs to prevent Safari tab crashes on older iPhones.
* **Security Standard:** Strict Content Security Policy (CSP) headers applied via `firebase.json`. No `eval()` allowed. *(CSP ao vivo em caim.web.app — S18)*

---

## 8. Deployment & CI/CD

* **Hosting Environment:** Google Firebase Hosting.
* **Deployment Command:** `firebase deploy --only hosting`
* **Build Pipeline:** Vite production build (`npm run build`).
* **Analytics:** Opt-in Firebase Analytics for error tracking and crash reporting on edge cases.

---

## 9. Brand Identity

* **Name:** CAIM (Cerra Ai Mobile)
* **Primary Brand Color:** `#0f172a` (Dark Slate)
* **Accent Color:** `#2dd4bf` (Teal/Cyan for syntax highlighting and active states)
* **Logo Assets:** Root directory `assets/icons/logo_caim.svg` serving as the base for all PWA maskable icons (192x192, 512x512) — gerados por `scripts/generate-icons.mjs`.

---

## 10. Code Conventions & Testing Strategy

### 10.1 Code Conventions

* **Modules:** ES6 Modules (`import`/`export`) — zero global namespace pollution.
* **No framework:** Vanilla JS only. Libraries are tools (CodeMirror, Dexie, isomorphic-git), never the application architecture.
* **Comments:** Code should be self-documenting; comments reserved for non-obvious business logic.
* **Naming:** `camelCase` para funções/variáveis; `PascalCase` para classes; `kebab-case` para arquivos.
* **Async:** Always `async/await` with explicit error handling — no unhandled promise rejections.
* **Design tokens:** Reuse CSS variables from `main.css` (`--bg-*`, `--text-*`, `--accent`); never hardcode hex colors in components.

### 10.2 Testing Strategy

| Camada        | Ferramenta | Escopo                                                                        |
| ------------- | ---------- | ----------------------------------------------------------------------------- |
| **Unitários** | Vitest     | Drivers (parsing), VFS (CRUD/path traversal), git-service, security module.   |
| **Integração**| Vitest + jsdom | VFS ↔ Git, Drivers ↔ Tool Executor, editor ↔ auto-save.                   |
| **E2E**       | Playwright | Fluxos principais: chat→tools, file CRUD, git workflow completo.              |
| **Mobile**    | Manual     | iPhones reais (Safari), modo avião, safe-areas, teclado flutuante.            |

> Regra: cada sprint entrega seus testes junto do código — sprint só é "done" com testes verdes (ver `implementation.md`).

---

## 11. Development Protocol

This is a strictly controlled, solo-engineer project.
**Rule of Execution:** Do not skip phases. Each step outlined in Section 5 must be fully implemented, documented, and tested within the browser before advancing to the next. O detalhamento por sprint (tarefas, critérios de aceite, dependências) está em `implementation.md`.

**Repository Constraints:**

* **Main Branch:** `main`
* **Remote Tracking:** `[https://github.com/renato0503/caim.git](https://github.com/renato0503/caim.git)`

**Commit Conventions:** Mensagens curtas e descritivas no formato `<tipo>: <resumo>` (ex.: `feat: add vfs-service`, `fix: resolve sw cache bump`, `chore: scaffold vite`). Nunca commitar secrets.

---

## 12. Benchmarking & Roadmap (research 16/08)

Referências estudadas em 16/08 e o que já foi incorporado ou ficou para o roadmap pós-Go-Live:

| Fonte | Aprendizado | Status no CAIM |
| ----- | ----------- | -------------- |
| `oscarleuuh/nuncio`, `TheStrongestOfTomorrow/Nexus-IDE` | Mobile-first PWA delegando tarefas a agentes; **chaves de API estritamente locais (IndexedDB), código nunca passa por SaaS intermediário** | ✅ Valida a regra de ouro (PAT do Owner só no Secret Manager). Chaves LLM cifradas (AES-GCM) em `users/{uid}` com **master key local** — trade-off cross-device documentado; opção "chaves só locais" no roadmap. |
| `hack-pad/hackpadfs` | FS extensível + driver próprio de IndexedDB com operações atômicas | ✅ VFS validado por testes (CRUD/persistência/atomicidade); adotar padrões do hackpadfs se surgir corrupção de estado. |
| CodeMirror 6 + `visualViewport` + `viewport-truth` | Teclado iOS: `requestAnimationFrame` atrelado ao resize do `visualViewport` reduz **jitter** da toolbar flutuante e do bottom sheet | ✅ Aplicado em `app.js` (`syncViewport` com throttle rAF). Validação em iPhone real pendente (S19). |
| `opencode-ai/opencode`, `cline/cline` (issues de parsing) | **Truncamento de resposta no meio da tool call** (tag XML/JSON cortada) é o bug clássico — parser precisa ser tolerante | ✅ Aplicado nos drivers (`salvageTruncatedWrite` + `detectTruncation` + aviso no chat). Testes verdes. |
| `Zibri/cloudflare-cors-anywhere`, `rednafi/cors-proxy` | Blindar proxy CORS: **host-allowlist** (só api.github.com etc.) + **rate limit por usuário/IP** | ✅ Aplicado na CF `gitCorsProxy` (allowlist + 50 req/min por uid/IP). Redeploy de Functions pendente. |
| `pazguille/offline-first`, RxDB | Evicção do Safari; **Cloud Sync IndexedDB ↔ backend** (RxDB) para trocar de device sem perder contexto | ⏳ Roadmap pós-Go-Live (multi-device, colaboração). |

---

*Last updated: 2026-08-16*
