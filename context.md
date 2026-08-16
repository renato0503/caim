# CAIM - Context & Strategy

> **Cerra AI Mobile (CAIM)** — Mobile-first AI coding agent interface running entirely in the browser as a Progressive Web App (PWA).

**Documentos Relacionados:**
- [implementation.md](./implementation.md) — Plano mestre de sprints (S0–S12) até o Go Live, com critérios de aceite, dependências e estratégia de testes.
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) — Estrutura de pastas e arquitetura planejada.

---

## Status Atual (Snapshot — 2026-08-15)

| Área                      | Estado                                   | Observação                                                                              |
| ------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| **App shell (S0/S4.5)**   | ✅ Concluído                    | **Layout IDE** (activity bar + editor central + bottom sheet + drawer) em **Framework7 9.1.2** + Vite 8 + `vite-plugin-pwa`. |
| **Build tooling**   | ✅ Instalado                   | Vite 8 (rolldown), `scripts/copy-assets.mjs`, `INICIAR.bat`. Dev em `http://localhost:5173/`. |
| **VFS (S1)**        | ✅ Concluído                    | `vfs-service.js` (Dexie: CRUD, rename, path protection, data URLs) + `event-emitter.js`. |
| **Git (S2)**        | ✅ Concluído                    | `git-service.js` (isomorphic-git + VFS adapter) + `security-service.js` (AES-GCM) + CF `gitCorsProxy` no ar. |
| **Explorer (S3)**   | ✅ Concluído                    | Árvore + drawer + upload + renomear/excluir (menu ⋯). |
| **Editor (S4)**     | ✅ Concluído                    | CodeMirror 6: tabs, autosave 800ms, langs lazy, **toolbar flutuante iOS**. |
| **Viewer (S3.5)**   | ✅ Concluído                    | Preview md/img/html/pdf/csv/docx/xlsx/pptx no pane `preview`. |
| **Diff (S5)**       | ✅ Concluído                    | Diffs por bloco no bottom sheet (aceitar/rejeitar). |
| **Agentes (S6/S7/S8)** | ✅ Concluído                | Drivers (JSON/XML) + Tool Executor + failover multi-API + streaming/thinking/abort + contexto. |
| **SaaS (auth-gate)** | ✅ Em produção                | Login/cadastro obrigatórios, dashboard de MVPs, Settings 3 APIs cifradas, deploy via CF `githubDeployProxy` (PAT do Owner no Secret Manager). |
| **Deploy**          | ✅ Live                        | **https://caim.web.app** · Functions `githubDeployProxy` + `gitCorsProxy`. |
| **Firebase config** | ✅ Real                        | `projectId: cerraimobile` · Blaze · Auth + Firestore (usuário `gestor.renatorosa@gmail.com`). |
| **Performance (S10)** | ✅ Core ~156KB gzip        | Framework7 removido (mini-UI `notify.js`), CodeMirror minimal, code-splitting nativo. CSS 5,6KB. Lazy: xlsx/mammoth/isomorphic-git/firebase. |
| **Git**             | ✅ Commitado/pushado           | `main` no `github.com/renato0503/caim` (`a6e5bdd`). |
| **Pendências**      | 🔄 S11 (memory/App Check), S12 (iPhones/Lighthouse ≥90), **Fase 5 (S13–S19 homologação J1–J7)** | |

> **Próximo passo:** **Fase 5 — Homologação (S13–S19)** — testar a jornada do cliente J1–J7 na ordem cronológica (`docs/diagrams/journey.md`). Antes: rodar `seed-admin` (role owner) + `firebase functions:secrets:set GITHUB_OWNER_PAT` para destravar o deploy ponta-a-ponta.

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
| **Frontend Core**   | Framework7 9.1.2 (Vanilla JS) + HTML5/CSS3 | App shell (tabs, tabbar, dark theme, dialogs/toasts) com JS puro no lugar de framework de UI pesado. |
| **Build & Tooling** | Vite 8 + `vite-plugin-pwa`            | HMR, minificação, code-splitting e PWA. ✅ Instalado (rolldown: `manualChunks` em função). |
| **Hosting & CDN**   | Google Firebase Hosting               | Global edge caching, SSL, SPA routing rewrites, e PWA manifest delivery.         |
| **PWA Engine**      | Service Worker + `virtual:pwa-register`| Registro de SW com `onNeedRefresh`/`onOfflineReady`; estratégias avançadas no S10. |
| **VFS Database**    | Dexie.js (IndexedDB)                  | Reactive, asynchronous database wrapping for the local file system. ✅ (S1)        |
| **Editor Engine**   | CodeMirror 6                          | Modular architecture, mobile touch support, dynamic syntax highlighting. 🔄 (S4)   |
| **File Viewer**     | `marked` + `DOMPurify` + `mammoth` + `xlsx` + `jszip` | Preview de md/img/html/pdf/csv/docx/xlsx/pptx com lazy-load. 🔄 (S3.5) |
| **Version Control** | `isomorphic-git` + `lightning-fs` | Pure JavaScript implementation of Git parsing and execution. ⏳ (S2)               |
| **Security**        | Web Crypto API                        | AES-GCM encryption for storing GitHub PATs and LLM API keys locally. ⏳ (S2)       |
| **Icons**           | Lucide Icons (SVG inline)             | Lightweight, scalable SVG integration.                                             |
| **Testing**         | Vitest + Playwright                   | Unit/integration tests (Vitest) and E2E of the main flows (Playwright).            |

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
| **Phase 1** | **Infrastructure & PWA Core** | App shell **Framework7** + Vite 8 + PWA, manifest, sw.js, firebase.json, logo/dark theme. | ✅ Complete |
| **Phase 2** | **Storage & Versioning**      | VFS (Dexie) ✅ · `lightning-fs` + isomorphic-git wrapper (`git-service.js`) pendentes.     | 🔄 Em andamento |
| **Phase 3** | **Editing & Rendering**       | Explorer/Editor/Viewer parciais; **S4.5 Layout IDE aprovado** (activity bar + bottom sheet); falta toolbar flutuante iOS e Diff. | 🔄 Em andamento |
| **Phase 4** | **AI Orchestration**          | `AgentManager`, Driver implementations, LLM streaming connections (demo local só).          | ⏳ Pending  |
| **Phase 5** | **Security & Polish**         | Web Crypto PAT encryption, UI/UX animations, safe-area adjustments, offline testing.      | ⏳ Pending  |

---

## 6. Strict Functional Requirements

### 6.1 Chat & AI Interaction

* [ ] Connect securely to external LLM APIs (DeepSeek, Qwen) using fetch streams.
* [ ] Render Markdown and syntax-highlighted code blocks dynamically within the chat.
* [ ] Expose an interactive "Thinking Process" toggle for complex model reasoning.
* [ ] Implement user-approval popups for destructive AI file operations.

### 6.2 Code Editing Experience

* [ ] Ensure CodeMirror 6 responds smoothly to touch-and-drag selection.
* [x] Maintain cursor position and file state across tab switches.
* [ ] Implement semantic file search within the local directory structure.

### 6.3 File Management & Git

* [x] Visual file tree with collapsible directories.
* [ ] One-click staging and committing process.
* [ ] Conflict resolution UI (fallback to manual text editing if Git merge fails).

> **Novo (15/08):** Visualizador de arquivos (S3.5) — preview de Markdown/imagem/HTML/PDF/CSV/DOCX/XLSX/PPTX com lazy-load; wireframes e crítica em `implementation.md`.

---

## 7. Non-Functional Requirements & Performance Targets

* **Bundle Size:** Core JavaScript application must remain under 500KB (gzipped).
* **Time to Interactive (TTI):** Under 1.5 seconds on a standard 4G mobile connection.
* **Memory Management:** Aggressive garbage collection of old chat streams and diffs to prevent Safari tab crashes on older iPhones.
* **Security Standard:** Strict Content Security Policy (CSP) headers applied via `firebase.json`. No `eval()` allowed.

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
* **Logo Assets:** Root directory `assets/icons/logo_caim.png` serving as the base for all PWA maskable icons (192x192, 512x512).

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

*Last updated: 2026-08-15*
