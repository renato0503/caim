# CAIM — Master Implementation & Sprint Plan

> Plano de execução de engenharia do estado atual (Step 1 ✅) até o Go Live.
> Desenvolvido para máxima resiliência e foco na produtividade do fluxo de trabalho *on-the-go*.
> **Data de Referência:** 21/08/2026 · **Duração Média por Sprint:** 5–7 dias (Solo Dev)

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
9. [Fase 6 — Correções da Auditoria (S20–S26)](#fase-6--correções-da-auditoria-s20s26)
10. [Fase 7 — Retrofit 16-bit (S27–S30)](#fase-7--retrofit-16-bit-s27s30)
11. [Fase 8 — Correções da Auditoria do Chat + Gestor de Projetos (S31–S36b)](#fase-8--correções-da-auditoria-do-chat-s31s36b)
12. [Fase 9 — Roadmap pós-Go-Live: Produtividade, Poder & Colaboração (S37–S53)](#fase-9--roadmap-pós-go-live-produtividade-poder--colaboração-s37s53)
13. [Dependências entre Sprints](#dependências-entre-sprints)
14. [Estratégia de Testes](#estratégia-de-testes)
15. [Estrutura de Pastas Alvo](#estrutura-de-pastas-alvo)
16. [Matriz de Riscos & Mitigação](#matriz-de-riscos--mitigação)
17. [Critérios de Go Live](#critérios-de-go-live)
18. [Pós-Go-Live & Rollback](#pós-go-live--rollback)

---

## Registro de Progresso (2026-08-15)

### Sessão de 21/08 — Fix do dev server (referência morta ao Framework7) + verificação de workflows

- **Problema reportado pelo usuário:** o projeto **não rodava**, e os fluxos de **salvar** e **testar as APIs** não funcionavam.
- **Causa raiz:** o `vite.config.js` mantinha uma referência morta ao **Framework7** no `manualChunks` (`if (id.includes('node_modules/framework7')) return 'framework7';`), mas o Framework7 **não está instalado** (removido no S10, substituído pela mini-UI `notify.js`). Ao re-otimizar dependências (`Re-optimizing dependencies because lockfile has changed`), o optimizer do Vite tentava ler `framework7-bundle.esm.js` (inexistente) e **derrubava o dev server** — o que impedia rodar o app, salvar APIs (`saveSettings` → `dbService.updateLlmKeys`) e testar chaves (`agentManager.testConnection`).
- **Correção aplicada:** removida a referência morta ao Framework7 do `manualChunks` em `vite.config.js` e limpo o cache `node_modules/.vite/deps` para forçar re-bundling limpo.
- **Verificação (tudo ✅):** dev server **estável** (antes travava no optimizer); **14 módulos principais** carregam (200 OK); **212 testes verdes** (19 arquivos); **build + PWA** concluído (SW gerado, 49 entradas); lógica de VFS/Settings/APIs/Git/Projetos/Agente validada por testes. Detalhes em `AUDIT.md §11`.
- **Ressalva:** fluxos de **rede real** (login Firebase, chamadas LLM, deploy GitHub) exigem validação manual no navegador.

### Sessão de 18/08 — Fase 9 planejada (S37–S53) + S37 (ícones por tipo de arquivo) concluído

- **Brainstorm completo de features pós-Go-Live** (sessão de 18/08) transformado em **Fase 9 — S37–S53** abaixo, ordenadas cronologicamente (UX imediata → agentes → git/deploy → colaboração → infra). Foco: produtividade no celular, autonomia segura do agente, multi-device e colaboração.
- **S37 — Ícones por tipo de arquivo ✅:** novo `src/js/ui/file-icons.js` (SVGs lucide-stroke por extensão: html/css/js/ts/jsx/json/md/img/pdf/doc/xls/ppt/zip/txt/py + `.gitignore`→git + dotfiles→config; contorno do arquivo com `opacity .45` + glyph colorido; fallback genérico). Wiring em `file-tree.js` (`getFileIcon(file.name)` → classe `ft-icon-*`), cores AA no `main.css` (paleta 16-bit). **142 testes verdes** (+1 `file-tree.test.js`) + build limpo.
- **S38 — Busca fuzzy + Find/Replace global ✅:** novo `src/js/ui/search-panel.js` — activity bar ganhou botão 🔍 e um **search drawer** (direita); modo **Arquivos** (go-to-file com score `exact > basename > path > subsequência`, Enter abre) e modo **Encontrar** (busca no conteúdo de todos os arquivos de texto, ignora `.git/`/binários/data URLs, agrupado por arquivo com L:número; **"Substituir todos"** com `notify.confirm` → grava no VFS e emite `vfs:changed`, reversível pelo Diff). **156 testes verdes** (+14 `search-panel.test.js`), build limpo.
- **S39 — Editor avançado ✅ (parcial: atalhos custom e multi-cursor ficam para depois):** novos `src/js/core/snippets.js` (10 snippets padrão por linguagem + `findSnippet` com prefixo `!` e custom prioritário) e `src/js/core/editor-prefs.js` (`DEFAULT_PREFS`, `load/saveEditorPrefs` em `metadata` `editor-prefs`). Editor ganhou **compartments** de tema (**16-bit** padrão / **Claro** via `lightTheme`) e fonte (tamanho 12–20, **mono/pixel**) com `applyPrefs` sem recarregar; **expansão de snippet** por **Ctrl/⌘+Space** (palavra antes do cursor) e botão **⚡ na toolbar flutuante iOS** com picker + "＋ Novo snippet" (prompt gatilho/conteúdo, persistido). Settings ganhou bloco **"Editor"** (`#prefs-theme/#prefs-font-size/#prefs-font-family`) salvo no botão Salvar e aplicado via `onEditorPrefsChange` → `editor.applyPrefs`. **175 testes verdes** (+5 `editor-prefs`, +9 `snippets`, +5 `editor.test.js`; `setup.js` com polyfill `Range#getClientRects` p/ jsdom), build limpo.
- **S40/S41/S42 — Dashboard UX + ZIP/Lixeira + Autonomia ✅:** `project-service.js` ganhou **`PROJECT_TEMPLATES`** (5 templates), `newProjectFromTemplate`, `duplicateProject`, `togglePin`, `setTags`, `exportProjectZip`/`importProjectZip` (JSZip, sanitize de paths + limites 1MB/20MB) e a **Lixeira** (`trashProject`/`listTrashed`/`restoreProject`/`purgeProject`/`emptyTrash`). **VFS v3** (tabela `trashed` + `pinned/tags` em `projects`). Dashboard reescrito: busca por nome/tag, ordenação, pin no topo, Duplicar, Tags, Exportar .zip, Importar .zip e Lixeira. `agent-manager.js` ganhou **`PERMISSION` (ask/review/auto)** persistida em metadata por projeto, **planos de execução** (gate `ask` → `{ plan }` + `executePlan` com "Aprovar tudo/passo") e **undo de tool calls** (`beginUndo`/`undoLastPlan` byte a byte). UI: toggle de permissão no chat, checklist do plano com aprovar tudo/passo e botão "Reverter alteração da IA". **212 testes verdes** (+9 `project-service`, +9 S42 `agent-manager`, +9 `auth-views`), build limpo, **hosting `caim` redeployado (18/08)** → https://caim.web.app. **Falta (o que vem a seguir):** pendências da S39 (atalhos customizáveis e multi-cursor), **S43–S53** (drivers/multi-agente, multimodal/TTS, memória/RAG, git avançado, deploy contínuo, preview de apps, cloud sync, colaboração, onboarding/i18n, diagnóstico/push, segurança/infra) e a homologação da **Fase 9 em device real**.
- **Ajuste UX — botões dos cards de projeto ✅ (18/08, pós-deploy):** `.project-actions` deixou de ser `flex:1` em linha única (7 botões espremidos) e virou **grid de 2 colunas**: "Continuar" (`project-action-primary`) ocupa **linha cheia** no topo e as ações secundárias (Fixar/Duplicar/Tags/Exportar .zip/Renomear/Lixeira) distribuem-se em 3 linhas de 2, com `gap:6px`, padding maior, `letter-spacing` e `text-overflow:ellipsis` (nada encosta/estoura — inclusive na lixeira e nos cards publicados). **212 testes verdes**, build limpo, **hosting `caim` redeployado (18/08)**.
- **Pendências de device real da Fase 5/8** seguem em aberto (ver `context.md`).

### Sessão de 16/08 — Fase 8 (S31–S35) concluída — Chat legível, gate, memória, intenção e geração robusta

- **S31 — Chat legível ✅:** lógica de render movida para `src/js/ui/chat-renderer.js` (testável): `buildFinalText` usa o `message` do driver (nunca o `buf` bruto), chips por arquivo com Abrir/Preview, JSON cru em `<details>` via `textContent` (sem XSS/`innerHTML`). CSS `.chat-file-chip*`/`.chat-debug-raw*` em `main.css`.
- **S32 — Gate de intenção ✅:** `CHITCHAT_RE` + `isChitchat()` + `chitchatReply()` em `agent-manager.js` — "oi"/"obrigado" respondem com texto sem chamar o LLM nem tocar o VFS (nos modos DEMO e LIVE).
- **S33 — Memória conversacional ✅:** `buildSystemPrompt` agora recebe `{ history, filesList }` e injeta as últimas ~6 mensagens + paths do VFS; `sendPrompt` repassa o estado; guard de sobrescrita devolve `overwrites` (nota no bubble).
- **S34 — Intenção "ver o site" ✅:** `detectViewIntent`/`handleViewIntent` em `chat-renderer.js` — "me de o localhost" abre o Preview do primeiro `.html` sem chamar o LLM, com mensagem clara de que não há localhost.
- **S35 — Geração robusta ✅:** `SYSTEM_PROMPT` só com esquema (sem exemplo — fim do few-shot leakage); `demoSend` com `JSON.stringify` + template HTML válido (DOCTYPE/head/body) + rótulo `[MODO DEMO]`.
- **Testes:** +22 novos (chitchat, memória/overwrite, demo, chat-renderer jsdom) — **121 verdes** (`npm test`), build limpo.
- **Deploy + reforço do gate (16/08):** o usuário reportou que "ola, tudo bem?" ainda gerava MVP — o app testado rodava o **build antigo** (Fase 8 nunca tinha sido deployada). Corrigido o gate S32 para aceitar **combinações** ("ola, tudo bem?", "bom dia, como vai?", "obrigada!") via regex sobre a string normalizada (1–3 tokens de chitchat); **`firebase deploy --only hosting`** publicado (build `app-CGBPrId0.js`). 121 verdes.
- **Fix deploy (16/08):** primeiro deploy real após a Fase 8 falhou com `7 PERMISSION_DENIED: secretmanager.versions.access` no `githubDeployProxy`. Causa: **IAM do secret `GITHUB_OWNER_PAT` estava vazio** (sem bindings) — a SA `600754439954-compute@developer.gserviceaccount.com` não podia ler. Corrigido: `gcloud secrets add-iam-policy-binding` com `roles/secretmanager.secretAccessor` para a SA da Function. Bônus: system prompt agora proíbe `via.placeholder.com`/`placehold.co`/`picsum.photos` (bloqueados por CSP `img-src 'self' data: blob:` no preview) — deve usar SVG inline/data URI; hosting redeployado.
- **Fix deploy #2 (16/08):** o PAT do secret era **fine-grained sem permissão de criar repos** (`403 Resource not accessible`) — trocado por **classic PAT `ghp_` (escopo `repo`)** verificado antes de gravar (`diag-pat.cjs` cria e deleta um repo de teste). Em seguida, repo recém-criado era **vazio** e a API `createBlob` falhava com `409 Git Repository is empty` — o `githubDeployProxy` agora **semeia um commit inicial vazio** (`createTree([])` → commit → updateRef) antes de escrever os arquivos, e usa `defaultBranch` no `createPagesSite`. Function redeployada.
- **Fix deploy #3 (16/08):** mesmo com o seed, a **Git Data API inteira** (inclusive `createTree([])`) retorna `409 Git Repository is empty` em repos sem NENHUM commit. Reescrevido o `githubDeployProxy` para usar a **Contents API** (`createOrUpdateFileContents`, base64 + sha de arquivo existente) — ela cria o commit inicial automaticamente e também atualiza arquivos. Validado por **E2E real** (`diag-e2e.cjs`: cria repo → escreve 3 arquivos → ativa Pages → deleta repo, tudo OK). Function redeployada.
- **Fix dashboard (16/08):** `listProjects` exigia índice composto (`ownerId ASC + createdAt DESC`) que não existia → "Erro ao listar projetos: The query requires an index". Removido o `orderBy` do Firestore; ordenação por `createdAt` agora é **no cliente** (lista pequena). Sem necessidade de criar índice no console. 121 verdes, hosting redeployado.

### Sessão de 16/08 — S36 — Dashboard vira gestor de projetos (locais + publicados)

- **Objetivo do usuário:** a tela do dashboard deve ser um **gestor de projetos** — mostrar os projetos que ele já fez (locais **e** publicados) e deixá-lo escolher: **continuar** um projeto, **começar do zero**, **editar o nome** ou **excluir** (exclusão **só local**, nunca apagar do GitHub o que já foi publicado).
- **Modelo de dados (local):** novos `projects` (`&id, name, createdAt, lastModified, deployed, url, fileCount`) e `project_files` (`&[projectId+path], projectId, path, content, mimeType`) no VFS/Dexie — `vfs-service.js` agora com `version(2)` (tabelas anteriores preservadas; `metadata` continua `&key, value`).
- **`src/js/core/project-service.js` (novo):** snapshot nomeado do workspace por projeto com `newProject` (limpa workspace + cria + ativa), `createFromWorkspace` (deploy sem projeto ativo — snapshot sem limpar), `saveProjectSnapshot`, `openProject` (restaura snapshot, **salva o projeto ativo anterior** antes de trocar), `renameProject`, `deleteProject` (**só local — nunca toca o GitHub**), `markDeployed`, `clearWorkspace`, `get/setActiveProjectId`, `slugify` (normaliza acentos/espaços). O workspace nunca é tocado pela exclusão (arquivos continuam).
- **Deploy integrado (`app.js`):** após `addProject` no Firestore, grava o snapshot do projeto ativo (ou cria um via `createFromWorkspace`) e `markDeployed(id, url)` — o card local ganha badge "🚀 publicado" com link. `resetWorkspace` limpa também o projeto ativo (deploy seguinte cria projeto novo).
- **Dashboard (`auth-views.js` + `app.html`):** duas seções — **"Projetos locais"** (`#dashboard-local-projects`, ações Continuar/Renomear/Excluir) e **"Publicados no GitHub"** (`#dashboard-projects`, ações Abrir/Renomear rótulo/Remover da lista — o repo no GitHub fica intacto). Botão **"Novo projeto"** pede nome, limpa o workspace e entra na IDE. `onOpenProject(id)` do `app.js` restaura o snapshot e abre a IDE com árvore/chat recarregados.
- **CSS:** `.dash-section-title`, `.project-card-head`, `.project-badge` (badge "🚀 publicado"), `.project-meta`, `.project-action-primary`.
- **Testes:** +17 novos — `project-service.test.js` (snapshot/continuar/renomear/excluir-local/markDeployed/createFromWorkspace/troca de ativo) + gestor no `auth-views.test.js` (cards locais + publicados, Continuar→`onOpenProject`, Novo projeto→`newProject`+`onEnterIde`, exclusão só local). **138 verdes** (`npm test`), build limpo.

### Sessão de 16/08 — S36b — Toast de deploy persistente + confirmação de que a URL fica salva

- **Feedback do usuário:** após deploy, o toast "construindo/sucesso" **sumia rápido** (duração padrão 3,5s) e o console mostrava `Failed to load resource: 404` no endereço do MVP — o usuário perguntou se a URL poderia **ficar salva** para clicar e abrir no navegador.
- **Diagnóstico:**
  - O `404` no console é **esperado e inofensivo**: `waitForPagesLive` (S24) faz `HEAD` a cada 5s no endereço enquanto o GitHub Pages ainda está compilando — o recurso só existe após o build. O site estava no ar (o usuário confirmou).
  - A URL **já ficava salva em dois lugares**: Firestore (`dbService.addProject`) → seção "Publicados no GitHub" do dashboard (card clicável) e no projeto local via `markDeployed` → badge "🚀 publicado" com link. O problema era o usuário não ter tempo de ver o link antes do toast sumir.
- **Fix (`notify.js` + `app.js`):** `notify.toast` agora aceita **`duration: 0` = persistente** (só fecha pelo botão). No deploy: o toast "O GitHub está construindo…" é persistente e **fechado explicitamente** (`buildingToast.close()`) quando o Pages fica online; o toast de sucesso passou a ser **"MVP publicado! Ficou salvo no dashboard."** com botão **"Abrir"** (também persistente) — o usuário tem tempo de clicar sem pressa.
- **Testes:** +3 novos — `src/js/ui/notify.test.js` (jsdom + fake timers): toast padrão some na duration, `duration:0` permanece na tela (até 120s), botão fecha e dispara `onClick`. **141 verdes** (`npm test`), build limpo, hosting redeployado.

### Sessão de 16/08 — Auditoria do Chat → Fase 8 (S31–S35) planejada

- **Auditoria executada (conversa real):** o usuário pediu um site de currículo no chat e o app respondeu com 5 problemas que destruíram a experiência (e o projeto gerado):
  - **E1/E2:** o bubble renderizava o **JSON cru** da tool call (e as tags HTML do currículo "sumiam" por serem parseadas como HTML) — `app.js` usava `buf` bruto da stream em vez de `result.message`.
  - **E3:** um simples "oi" disparava criação de `index.html`/`style.css`/`script.js` (sem gate de intenção).
  - **E4:** follow-ups ("me de os arquivos", "me de o localhost") **sobrescreveram o currículo** com MVP genérico — o `chatHistory` nunca é injetado no LLM (`agent-manager.js` envia só system+user atual) e não há tratamento para intenção de visualização.
  - **E5:** o demo/MVP genérico saía **malformado** (JSON com aspas não escapadas, `<script>` dentro de `<button>`) — `demoSend`/`SYSTEM_PROMPT` concatena JSON à mão e o prompt contém exemplo completo que o modelo copia (few-shot leakage).
- **Planejado:** **Fase 8 — S31–S35** criada abaixo na ordem de impacto (leitura → intenção → memória → robustez), cada uma com tarefas, critérios de aceite e testes junto do código.
- **Status:** Fase 8 **concluída em 16/08** (sprints em ✅ abaixo) — 121 testes verdes.

### Sessão de 16/08 — S24–S30 (Fase 6/7 completas) + diagnóstico

- **S24 — Deploy & IDE ✅:** `waitForPagesLive` (HEAD a cada 5s até 5min) antes do toast de sucesso; `setDeploying` (spinner + xp-bar no `#deploy-btn`, evita duplo clique); `exportProjectAsZip` (JSZip, VFS sem `.git`) no Git pane; `checkPendingPush` + badge ao voltar online.
- **S25 — PWA & Offline ✅:** `requestStoragePersist()` no boot; `checkStoragePressure` (>90% aviso); badge offline no header (`online`/`offline`).
- **S26 — Segurança ✅:** `renderPdfJs` (pdfjs-dist) para PDFs >1MB (canvas, não iframe); upload >10MB bloqueado; **rate limit dinâmico** no `gitCorsProxy` (owners 200 req/min vs 50) — deployado.
- **S27 — Retrofit Fundação ✅:** tokens `--pixel-*`, `.pixel-border`, `.pixel-btn`, `.pixel-icon` (layout.md §2.1/§4.1/§11).
- **S28 — Componentes Core ✅:** activity bar (menu RPG, `pulse-pixel`), bottom sheet (border-top accent, tabs pixel), editor CodeMirror 16-bit (`tok-*`), tabs pixel, explorer drawer (border-right accent).
- **S29 — Interações & VFX ✅:** `notify.achievement` (toast dourado) + `notify.particles` (canvas) — acionados em deploy/aceitar diff; CSS `.ui-achievement`/`.ui-particles`.
- **S30 — Polish ✅:** xp-bar de deploy no header; efeito CRT (duplo toque no logo); ícones pixel SVG em toda a plataforma.
- **Diagnóstico final:** ver `docs/AUDIT.md` (análise completa) — 97 testes verdes, build limpo, deploy ao vivo verificado.

### Sessão de 16/08 — S20–S23 (Fase 6: correções da auditoria) concluídas

- **S20 — Auth Resiliente (J1) ✅:** `sendPasswordReset` + link "Esqueci minha senha" no login; `sendEmailVerification` + badge "Email não verificado" no dashboard; `friendlyAuthError` centralizado com `user-token-expired`/`user-disabled`/`network-request-failed`.
- **S21 — APIs & Failover UX (J2) ✅:** mensagem clara "Todas as suas chaves LLM falharam…" em vez de erro genérico; **botão "Testar" por linha** no Settings (`agentManager.testConnection` com prompt "Hi" — valida 200/401/403/429/5xx/timeout); edição de metadata preserva o ciphertext (já desde S14).
- **S22 — Geração & Contexto (J3) ✅:** `getOpenFilesContext(16KB)` com priorização (ativo > sujo > `.json` > demais) — não trunca o mais importante no meio; botão **"Continuar geração"** no chat quando `truncated`; **custo aproximado** (`~N tokens`) no rodapé da resposta; **aviso de binário** na geração (.png/.pdf → "use upload").
- **S23 — Diff & Revisão (J4) ✅:** `DiffViewer.withMeta` classifica **create/delete/binary** com banners ("NOVO ARQUIVO", "ARQUIVO SERÁ EXCLUÍDO", "diff não disponível para binários"); **conflito de edição simultânea** — `vfs:changed update` em arquivo dirty abre confirm (manter local / usar IA).
- **Testes: 95 verdes** (85 → 95: auth-service, editor contexto, diff-viewer create/delete/binary).

### Sessão de 16/08 — Landing page no ar + MPA (landing / + app /app)

- **Landing page implementada em `caim.web.app`** (raiz) — proposta "CAIM Landing Page 16-bit (Proposta Honesta)" aprovada e executada: 11 seções (Hero, Problema, Solução, Como funciona, Features, Stack, Para quem é, Para quem NÃO é, FAQ honesto, CTA, Footer com badge de transparência).
- **MPA no Vite:** `index.html` = landing pública · `app.html` = IDE (SPA antigo). `rollupOptions.input` com os dois entradas. PWA `start_url: /app`, `scope: /`, `navigateFallback: /app.html` com allowlist `/^\/app/`.
- **Firebase rewrites:** `/app` e `/app/**` → `app.html`; `**` → `index.html` (landing). Verificado ao vivo: `/` = landing (HTTP 200), `/app` = IDE (HTTP 200).
- **Assets:** `src/css/landing.css` + `src/js/landing.js` (menu mobile, typewriter no terminal, reveal no scroll, partículas no hero, easter eggs CRT + Konami).
- **Copy 100% honesta** conforme a proposta (zero afirmações não verificáveis): bundle real 156KB gzip, chaves próprias, offline-first, stack auditável.
- **Testes: 81 verdes** · build limpo (54 entradas precache).

### Sessão de 16/08 — Docs reorganizados + Fase 7 (S27–S30) Retrofit 16-bit

- **Docs movidos para `docs/`:** `implementation.md`, `context.md` e `PROJECT_STRUCTURE.md` saíram da raiz para `docs/` (organização); caminhos relativos corrigidos em todos os `.md` (referências `docs/diagrams/...` → `diagrams/...` e `implementation.md` → `../implementation.md` nos diagramas).
- **Novo `docs/layout.md`** (design system 16-bit aprovado) → **Fase 7 (S27–S30):**
  - **S27** — Fundação: fontes pixel (Press Start 2P/VT323/Silkscreen), tokens `--pixel-*`, CSS reset, `.pixel-border`/`.pixel-btn`.
  - **S28** — Componentes core: activity bar (menu RPG), bottom sheet (dialog box), editor CodeMirror 16-bit + tabs, explorer (inventário).
  - **S29** — Interações: partículas, toasts de conquista, microinterações (rocket/save-flash/streaming-cursor), diff (batalha), chat (terminal).
  - **S30** — Polish: ícones pixel SVG, efeito CRT, xp-bar, bundle < 15KB CSS, device real.
- **Natureza:** sprints visuais — não dependem das correções de negócio (Fase 6) nem bloqueiam o Go Live.

### Sessão de 16/08 — Auditoria cruzada J0–J7 × Workflows → Fase 6 (S20–S26)

- **Auditoria executada** (cruzando `journey.md` × `workflows.md`) identificou gaps de produção em 7 áreas. **Pontos já resolvidos no código** (auditoria estava desatualizada): limite de 1MB no `tool-executor`/VFS já existe; botão Deploy já existe no header; firestore.rules já permitem `create` por owner (`request.auth.uid == uid`).
- **Gaps reais catalogados** e transformados em **Fase 6 — S20–S26**: S20 auth resiliente (senha/email/token expirado), S21 APIs (failover UX/validar chave/editar), S22 geração (contexto 16KB/continue-truncation/custo), S23 diff (create/delete/rename/conflito), S24 deploy (polling Pages/export ZIP/push pendente/rollback), S25 offline (storage pressure/persist/estado offline), S26 segurança (pdf.js/limite upload/rate limit dinâmico).
- **Nota técnica:** BackgroundSync não é suportado no iOS Safari — mitigado por polling de Pages + aviso de rede (documentado em S25).

### Sessão de 16/08 — S15–S19 (homologação ponta-a-ponta): testes + deploy final

- **S15 (J3/J4) — Geração & Revisão ✅ automático:** testes de `agent-manager` para **streaming + thinking (`reasoning_content`)** e **truncamento** (resposta cortada detectada via `detectTruncation`), **contexto** (arquivos abertos injetados no system prompt), **AbortError** (Parar). Testes de `diff-viewer` para **blocos aceitar/rejeitar** (incluindo múltiplos blocos) e `isMinifiedFile`.
- **Fix S5:** `applyBlockAccept`/`applyBlockReject` perdiam o **newline final** (arquivos POSIX); `buildBlocks` agora normaliza CRLF e garante newline antes do `diff` (senão `'b'` vs `'b\n'` contam como linha diferente).
- **S16 (J5/J6) — Deploy & IDE ✅ automático:** testes de `file-tree` (explorer: árvore, `.git` oculto, abrir no editor, expandir/recolher, preview 👁 e menu ⋯, XSS no nome). Git offline já coberto (`git-service.test.js`). Viewer/explorer cobertos.
- **S18 (S11) — Segurança ✅ automático + redeploy:** testes de `viewer` para **XSS** (markdown sanitizado, CSV escapado, HTML em iframe sandbox, xlsx/docx com DOMPurify, texto via textContent). Path traversal já coberto. **`gitCorsProxy` blindado DEPLOYADO** (host-allowlist + rate limit 50 req/min) — verificado ao vivo: GitHub → 200, host externo → 403.
- **S19 (Go Live) — Deploy final ✅:** Hosting redeployado em **https://caim.web.app** com **CSP + security headers ao vivo** (Content-Security-Policy, nosniff, no-referrer, X-Frame-Options) + Functions redeployadas (Node 20, 2nd Gen). Bundle core eager **156,53 KB gzip** (< 400 KB ✅), precache 48 entradas, SW `generateSW` + StaleWhileRevalidate para google-fonts.
- **Testes: 79 verdes** (51 → 79, +28 nesta rodada).
- **Pendências manuais (device real):** instalar PWA no iPhone, cadastro/login reais, `seed-admin` (role owner), `GITHUB_OWNER_PAT` no Secret Manager, chaves LLM reais, regras Firestore com 2 contas, Lighthouse ≥ 90 em dispositivo, iPhones modo avião, App Check (`appCheckSiteKey`).
- **Nota (pós-Go-Live):** runtime das Functions **Node 20 deprecado** (decomissiona em 2026-10-30) — upgrade para Node 22 + firebase-functions 7 planejado.

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
- **Identidade visual:** logo `logo_caim.svg` (16-bit) aplicado em favicon, icons PWA, apple-touch-icon, splash screens e header.
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
- **Jornada do Cliente** — `diagrams/journey.md` com J0–J7 (auth, APIs, geração, diff, deploy, IDE, offline) + **Fase 5: sprints de homologação S13–S19** testando cada workflow na ordem cronológica.

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
| S13 | Homologação — Fundação & Auth          | 5    | J1: PWA + VFS + auth-gate + rules + seed owner   | 🔄 Parcial (device real ⏳) |
| S14 | Homologação — APIs de LLM              | 5    | J2: 3 chaves, prioridade, failover, cifragem     | 🔄 Parcial (device real ⏳) |
| S15 | Homologação — Geração & Revisão        | 5    | J3/J4: chat→agente→arquivos→diff                 | 🔄 Parcial (device real ⏳) |
| S16 | Homologação — Deploy & IDE             | 5    | J5/J6: publicar MVP + explorer/editor/viewer/git | 🔄 Parcial (device real ⏳) |
| S17 | Homologação — PWA & Performance        | 5    | J7: modo avião, bundle, atualização              | 🔄 Parcial (device real ⏳) |
| S18 | Homologação — Segurança                | 5    | App Check, XSS, memória, firestore.rules         | 🔄 Parcial (XSS/path/proxy ✅) |
| S19 | Go Live Final 🚀                       | 5    | Lighthouse, iPhones reais, deploy final          | 🔄 Parcial (deploy ✅) |
| S20 | Correção — Auth Resiliente (J1)        | 6    | Recuperar senha, email, token expirado, seed     | ✅ Done |
| S21 | Correção — APIs & Failover UX (J2)     | 6    | Validar chave, mensagens claras, editar chave    | ✅ Done |
| S22 | Correção — Geração & Contexto (J3)     | 6    | Contexto 16KB, continue-truncation, custo        | ✅ Done |
| S23 | Correção — Diff & Revisão (J4)         | 6    | Diff create/delete/rename, conflito de edição    | ✅ Done |
| S24 | Correção — Deploy & IDE (J5/J6)        | 6    | Polling Pages, export ZIP, push pendente         | ✅ Done |
| S25 | Correção — PWA & Offline (J7)          | 6    | Storage pressure, estado offline, eviction       | ✅ Done |
| S26 | Correção — Segurança & Viewer (S18)    | 6    | pdf.js, tamanho VFS, rate limit dinâmico         | ✅ Done |
| S27 | Retrofit 16-bit — Fundação (layout.md) | 7    | Fontes pixel, tokens CSS, `.pixel-border`/btn    | ✅ Done |
| S28 | Retrofit 16-bit — Componentes Core     | 7    | Activity bar, bottom sheet, editor, explorer     | ✅ Done |
| S29 | Retrofit 16-bit — Interações & VFX     | 7    | Partículas, microinterações, toasts, diff, chat  | ✅ Done |
| S30 | Retrofit 16-bit — Polish & Go Live     | 7    | Ícones pixel, CRT, bundle, device real           | ✅ Done   |
| S31 | Correção — Chat legível                | 8    | Bubble com `message` + chips, nunca JSON cru     | ✅ Concluído |
| S32 | Correção — Gate de intenção (chitchat) | 8    | "oi" não gera arquivos                           | ✅ Concluído |
| S33 | Correção — Memória conversacional      | 8    | Histórico + estado do VFS no contexto            | ✅ Concluído |
| S34 | Correção — Intenção "ver o site"       | 8    | localhost → Preview/Deploy                       | ✅ Concluído |
| S35 | Correção — Geração robusta (demo)      | 8    | JSON.stringify + system prompt só esquema        | ✅ Concluído |
| S36 | Gestor de projetos (dashboard)         | 8    | Projetos locais + publicados: continuar/renomear/excluir (só local) | ✅ Concluído |
| S36b | Toast de deploy persistente           | 8    | `notify.toast` com `duration:0`; URL salva no dashboard e no projeto local | ✅ Concluído |
| S37 | Ícones por tipo de arquivo             | 9    | Explorer com ícones SVG por extensão + cores AA                   | ✅ Concluído |
| S38 | Busca fuzzy & Find/Replace global      | 9    | Ctrl+P (go-to-file) + busca/substituição multi-arquivo            | ✅ Concluído |
| S39 | Editor avançado                        | 9    | Snippets (toolbar ⚡ + ⌘Space + custom), tema claro/fonte no Settings, prefs em `metadata` | 🟢 Em andamento (snippets+tema feitos; atalhos custom e multi-cursor pendentes) |
| S40 | Templates de projeto & Dashboard UX    | 9    | Templates (HTML/React/Python), duplicar, pin/favoritos, busca e tags | ✅ Feito |
| S41 | Import/Export & Lixeira                | 9    | Projeto em `.zip` completo + lixeira com restauração              | ✅ Feito |
| S42 | Autonomia controlada & Planos          | 9    | Slider de permissões, planos de execução, undo de tool calls      | ✅ Feito |
| S43 | Multi-agente & Novos drivers           | 9    | Kilo/Claude Code, sub-agentes paralelos, prompt templates         | 🔜 Planejado |
| S44 | Chat multimodal & Voz                  | 9    | Anexar imagem/PDF ao prompt + TTS das respostas                   | 🔜 Planejado |
| S45 | Memória por projeto & RAG local        | 9    | Memória persistente por projeto + "pergunte ao seu codebase"      | 🔜 Planejado |
| S46 | Git avançado                           | 9    | Clone/pull, branches, diff entre commits, conflitos visuais       | 🔜 Planejado |
| S47 | Deploy contínuo & CI                   | 9    | Preview channels, re-deploy automático, GitHub Actions            | 🔜 Planejado |
| S48 | Preview de apps & Terminal embutido    | 9    | Sandbox iframe com localStorage isolado + console interativo      | 🔜 Planejado |
| S49 | Cloud Sync multi-device                | 9    | RxDB/Firestore: trocar de device sem perder contexto              | 🔜 Planejado |
| S50 | Colaboração em tempo real              | 9    | Presença, cursores compartilhados, chat ao vivo (WebRTC)          | 🔜 Planejado |
| S51 | Onboarding, modo convidado & i18n      | 9    | Guia de primeiro projeto, demo sem login, PT/EN/ES, feedback      | 🔜 Planejado |
| S52 | Diagnóstico & Notificações             | 9    | Health check do app, analytics local, teste automático de chaves, push | 🔜 Planejado |
| S53 | Segurança & Infra                      | 9    | MFA, backup criptografado, Node 22 nas Functions, CI de testes    | 🔜 Planejado |

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

### S3.5 — File Viewer (Visualizador) ✅ Done

**Objetivo:** Pré-visualizar qualquer arquivo do VFS sem abrir no editor — o equivalente ao "Preview" do VS Code.

- [x] Criar `src/js/ui/viewer.js` com renderers: Markdown (`marked` + `DOMPurify`), imagem, HTML (iframe sandbox), PDF (iframe blob), CSV (tabela), DOCX (`mammoth`), XLSX (`xlsx`/SheetJS), PPTX (texto extraído via `jszip`).
- [x] Aba "Preview" no app shell + 4º `tab-link` no tabbar (`#tab-preview`). *(No layout IDE da S4.5, o preview vira o pane `preview` do bottom sheet.)*
- [x] Botão de Upload no Explorer (`#upload-btn`).
- [x] Extensão do mime map no VFS (`resolveMime`) + suporte a binários via data URL.
- [x] Botão "olho" (preview) por arquivo no `file-tree.js` (`onPreviewFile`).
- [x] Botão "Abrir no editor" no viewer (`#viewer-open-editor`).
- [x] Wiring no `app.js`: upload (`FileReader` → data URL/texto) e abertura do viewer. *(Merged com a S4.5 — o viewer renderiza no pane `preview` do bottom sheet.)*
- [x] CSS dos renderers (markdown, tabelas, iframes) em `main.css`.
- [x] Validação: build + fluxo no dispositivo. *(sanitização XSS coberta por teste — 16/08)*

**Critérios de Aceite:**
- [x] Markdown/imagem/HTML/PDF/CSV renderizam no dispositivo.
- [x] DOCX/XLSX/PPTX renderizam via lazy-load (sem pesar o bundle core).
- [x] Upload de arquivo local persiste no VFS e abre no Visualizador.
- [x] Botões e mensagens em PT-BR.

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

> Fluxos mapeados na **jornada do cliente** em `diagrams/journey.md` (J1–J7). Cada sprint de homologação testa um grupo de workflows **na ordem cronológica das sprints já entregues** (S0→S12). Sprint só é "done" com todos os cenários verdes em **device real + modo avião**.

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

- [x] **Chat real (LIVE):** prompt → streaming no chat; resposta em markdown sanitizado; arquivos criados no VFS e abertos no editor. *(streaming/contexto/truncamento cobertos por teste — 16/08)*
- [x] **Pensar:** toggle ativo mostra `reasoning_content` em bloco colapsável. *(teste streaming + thinking — 16/08)*
- [x] **Parar:** interromper a geração → mensagem "_geração interrompida_". *(teste AbortError — 16/08)*
- [x] **Contexto:** com 2 arquivos abertos, pedir alteração citando-os → agente usa o conteúdo. *(teste system prompt — 16/08)*
- [ ] **Histórico:** recarregar a página → chat recarrega as últimas mensagens. *(device real)*
- [x] **Diff:** editar um arquivo → pane Diff lista; aceitar/rejeitar bloco reflete no VFS e no editor; `.min.js`/`.map` ignorados. *(testes buildBlocks/applyBlockAccept/Reject/isMinifiedFile + fix newline — 16/08)*
- [x] **Truncamento (S15-critical):** resposta cortada no meio de `<write_to_file>` ou de JSON → arquivo parcial salvo + aviso "Resposta truncada" no chat. *(Parser tolerante + `detectTruncation` — coberto por testes, 16/08.)*

**Critérios de Aceite:** sem XSS (injetar markdown malicioso → sanitizado); nenhum console error durante streaming/abort.

### S16 — Homologação de Deploy & IDE (J5/J6)

**Cobre:** S9 (deploy) · S3 (explorer) · S3.5 (viewer) · S4 (editor) · S2 (git).

- [ ] **Deploy ponta-a-ponta:** gerar MVP → revisar diff → clicar **Deploy** → `githubDeployProxy` cria repo na conta do Owner → Pages ativo → toast com URL → projeto salvo no dashboard. *(requer `GITHUB_OWNER_PAT` + device real)*
- [x] **Explorer:** abrir/visualizar/renomear/excluir via menu ⋯; upload de arquivo local. *(testes file-tree — 16/08)*
- [x] **Viewer:** preview de md/img/html/pdf/csv/docx/xlsx/pptx (upload de amostras). *(testes viewer + XSS — 16/08)*
- [ ] **Editor:** tabs, autosave 800ms, toolbar flutuante iOS, cursor/scroll preservados. *(device real)*
- [x] **Git offline:** init → status → stage → commit → log sem rede. *(testes git-service — 16/08)*
- [ ] **Novo projeto:** `resetWorkspace` limpa arquivos e abas após confirmação. *(device real)*

**Critérios de Aceite:** URL do Pages abre em 1–5 min; histórico do MVP aparece no dashboard; deploy falha sem login com mensagem clara.

### S17 — Homologação de PWA & Performance (J7)

**Cobre:** S10 (bundle/SW).

- [x] **Modo avião:** primeiro acesso online → depois abrir offline: app + editor + preview funcionam. *(SW `generateSW` + precache 48 entradas; validação em device real pendente)*
- [ ] **Atualização:** publicar nova versão → toast "Nova versão disponível" → atualizar sem perder dados. *(device real)*
- [x] **Fonte pixel:** Press Start 2P carrega online e cacheia para offline (StaleWhileRevalidate). *(config workbox + load assíncrono — verificado)*
- [x] **Bundle:** `npm run build` → core eager < 400KB gzip (hoje ~156KB) + lazy chunks separados (xlsx/mammoth/isomorphic-git/marked/DOMPurify/firebase). *(156,53 KB gzip — 16/08)*

**Critérios de Aceite:** Lighthouse Performance ≥ 85 no dispositivo; nenhum asset 404 em modo avião.

### S18 — Homologação de Segurança (S11)

- [ ] **App Check:** preencher `appCheckSiteKey` no `firebase-config.js` → requisições protegidas. *(pendente — ativar no console)*
- [x] **XSS:** chat com markdown com `<img onerror>`, `<script>` → sanitizado (DOMPurify); preview HTML em iframe sandbox. *(testes viewer + markdown — 16/08)*
- [ ] **Memory:** alternar 50× entre arquivos grandes no editor → RAM estável no Safari. *(device real)*
- [x] **Acessibilidade:** ARIA labels presentes; navegação por teclado no desktop. *(16 aria-labels em index.html)*
- [x] **Path traversal:** tool executor rejeita `..`, `/abs`, `.git/`. *(testes verdes — incl. `listDir` e `.git` sem barra, 16/08)*
- [x] **Proxy CORS blindado:** `gitCorsProxy` com host-allowlist (só GitHub) + rate limit 50 req/min por uid/IP. *(aplicado em code + **DEPLOYADO** 16/08 — GitHub 200, host externo 403)*

**Critérios de Aceite:** auditoria sem falhas críticas; Lighthouse Best Practices 100 (já verificado).

### S19 — Go Live Final 🚀

- [x] Redeploy final de Hosting + Functions. *(16/08 — caim.web.app + functions 2nd Gen)*
- [ ] Lighthouse ≥ 90 (Performance/PWA/Best Practices) em dispositivo real. *(device real)*
- [ ] Fluxo completo em 2 iPhones reais (Safari, 4G e modo avião). *(device real)*
- [ ] Feedback do cliente (jornada J0→J7) sem bloqueios. *(manual)*
- [ ] README com instruções de instalação e captura da jornada. *(pendente)*

---

## Fase 6 — Correções da Auditoria (S20–S26)

> Auditoria cruzada `journey.md` (J0–J7) × `workflows.md` (Mermaid) executada em **16/08/2026** identificou gaps de produção em auth, APIs, geração, diff, deploy, offline e segurança. Cada sprint corrige um grupo de workflows na ordem cronológica da jornada. **Regra:** cada sprint entrega testes junto do código (regra global).

### S20 — Correção: Auth Resiliente (J1) 🔴 CRÍTICO

**Cobre:** `auth-service.js` · `auth-views.js` · `firestore.rules`.

- [x] **Recuperação de senha:** link "Esqueci minha senha" na tela de login → `authService.sendPasswordReset(email)` (`sendPasswordResetEmail` do Firebase Auth) → toast "Enviamos um link para seu email".
- [x] **Email verification:** `authService.isEmailVerified()` exibida no dashboard (badge "Email não verificado" + reenviar link).
- [x] **Token expirado/desativado:** `onAuthError` handler — `auth/user-token-expired` → diálogo "Sessão expirada, entre novamente"; `auth/user-disabled` → diálogo claro de conta desativada (hoje: loop silencioso de auth-gate).
- [x] **Bootstrap do seed:** garantir que `users/{uid}` possa ser criado mesmo antes do `seed-admin` rodar (regra de `create` já permite `request.auth.uid == uid` — validar em teste de rules).
- [x] Testes: `auth-service.test.js` (reset/verification), `auth-views.test.js` (link + diálogos).

**Critérios de Aceite:** usuário recupera senha sem intervenção manual; conta desativada não entra em loop; zero erros não tratados no fluxo de auth.

### S21 — Correção: APIs & Failover UX (J2) 🟠 ALTO

**Cobre:** `agent-manager.js` · `auth-views.js` (Settings).

- [x] **Falha total das chaves:** mensagem específica "Todas as suas chaves LLM falharam. Verifique saldos, permissões e o estado de cada chave em Configurações." em vez de erro de rede genérico.
- [x] **Editar chave existente:** permitir sobrescrever `baseUrl`/`model`/`priority` de uma chave salva sem apagar e recriar (o campo de chave continua vazio ao reabrir; edição de metadata preserva o ciphertext).
- [x] **Validar chave ao salvar:** botão "Testar" por linha → `testConnection()` com prompt mínimo (`{"messages":[{"role":"user","content":"Hi"}]}`) antes de persistir; mostra "Chave válida" ou o erro da API.
- [ ] **Rate limit dinâmico no proxy** (S26 também toca): owners com maior cota — ver S26.

**Critérios de Aceite:** erro claro quando todas as chaves falham; chave inválida detectada no save; metadata editável sem perder a chave.

### S22 — Correção: Geração & Contexto (J3) 🔴 CRÍTICO

**Cobre:** `agent-manager.js` · `editor.js` · `tool-executor.js` · chat UI.

- [x] **Contexto dinâmico (16KB):** `getOpenFilesContext(maxBytes = 16384)` com priorização — 1) arquivo ativo, 2) arquivos sujos, 3) `.json` de config, 4) demais abertos; corta do menos relevante em vez de truncar o 4º arquivo no meio.
- [x] **Continue from truncation:** após `detectTruncation`, oferecer botão "Continuar geração" no chat que reenvia `{"prompt": "continue o arquivo X de onde parou: …últimos 500 chars…"}` mantendo o contexto dos arquivos já criados.
- [x] **Custo visível:** estimativa de tokens usados (entrada+saída) exibida no rodapé do chat após cada resposta (`max_tokens` não requerido; estimativa por caracteres/4).
- [x] **Binários na geração:** documentar limitação (tool `write_file` é texto) e exibir aviso no chat se a IA tentar criar `.png`/`.pdf` ("arquivo binário não suportado na geração — use upload").

**Critérios de Aceite:** 4 arquivos pequenos entram no contexto sem cortar o mais importante; truncamento tem continuidade em 1 toque; custo aproximado visível.

### S23 — Correção: Diff & Revisão (J4) 🟠 ALTO

**Cobre:** `diff-viewer.js` · `editor.js` · `tool-executor.js`.

- [x] **Diff de create/delete:** `buildBlocks(old, new, oldPath, newPath)` — arquivo sem `old` → bloco `create`; sem `new` → bloco `delete` (mostra "arquivo será excluído"); rename (`oldPath !== newPath`) → bloco `rename` com destaque.
- [x] **Arquivo binário no diff:** bloquear diff de `.png`/`.pdf`/etc com aviso "diff não disponível para binários — aceitar/rejeitar por arquivo inteiro".
- [x] **Conflito de edição simultânea:** se a IA gravar `vfs:changed` num arquivo que o usuário está editando (dirty), não sobrescrever silenciosamente — marcar conflito e pedir escolha (manter local / usar IA).
- [ ] **Bloqueio de execução:** tool `delete_file` que remove arquivo aberto no editor → confirmar no diff antes (já existe confirmação no explorer; estender para o fluxo de agentes).

**Critérios de Aceite:** delete/rename visíveis no diff antes do commit; binário não quebra o viewer; nenhuma edição do usuário sobrescrita sem aviso.

### S24 — Correção: Deploy & IDE (J5/J6) 🟠 ALTO

**Cobre:** `app.js` (deploy) · `functions/src/index.js` · `git-panel.js` · editor/explorer.

- [ ] **Polling do GitHub Pages:** após o deploy, `waitForPagesLive(url, 300s)` com HEAD a cada 5s — mostra "O GitHub está construindo… (aguarde até 5min)" e só então o toast de sucesso com botão Abrir.
- [ ] **Estado de deploy no header:** spinner/badge "Publicando…" no `#deploy-btn` durante a operação (evita duplo clique).
- [ ] **Exportar ZIP:** botão "Exportar" no Git pane → `exportProjectAsZip()` (JSZip) baixa o projeto (VFS sem `.git`).
- [ ] **Push pendente:** ao voltar online (`window.addEventListener('online')`), se há commits locais sem `origin` → badge "push pendente" no Git pane + toast.
- [ ] **Rollback:** salvar o estado do VFS (`vfs:changed` snapshot) antes de cada deploy → histórico de deploys com "republicar versão anterior". *(Escopo: guardar snapshot por deploy no Firestore.)*

**Critérios de Aceite:** toast de sucesso só quando o Pages responder 200; deploy não duplica ao tocar 2×; ZIP exporta o projeto; push pendente visível após reconnect.

### S25 — Correção: PWA & Offline (J7) 🟠 ALTO

**Cobre:** `app.js` · `vfs-service.js` · SW (`vite.config.js`).

- [ ] **Storage pressure:** ao abrir a IDE, `navigator.storage.estimate()` → se `usage/quota > 0.9`, aviso "Seu dispositivo está sem espaço — faça commit e push para não perder código".
- [ ] **Estado Offline no header:** ícone de avião quando `navigator.onLine === false` (via `online`/`offline` events) + aviso quando um deploy é tentado offline.
- [ ] **`persist()` da Storage API:** pedir `navigator.storage.persist()` no bootstrap para reduzir risco de eviction do IndexedDB no Safari (quando disponível; degrada silencioso).
- [ ] **Snapshot pré-deploy (sinergia S24):** garantir que o VFS grava antes do deploy (flush de autosaves pendentes via `editor.saveActive()`).
- [ ] Documentar limitação: **BackgroundSync** não é suportado no iOS Safari — mitigado pelo polling de Pages (S24) + aviso de rede.

**Critérios de Aceite:** aviso de storage quando o dispositivo está >90%; badge offline visível; `persist()` requisitado sem erro.

### S26 — Correção: Segurança & Viewer (S18) 🟠 ALTO

**Cobre:** `viewer.js` · `vfs-service.js` · `functions/src/index.js`.

- [ ] **PDF via pdf.js:** substituir iframe-blob por `pdf.js` lazy-load para PDFs > 1MB (evita travamento do Safari por memória); PDFs pequenos continuam em iframe.
- [ ] **Limite de tamanho no VFS para upload:** upload com arquivo > 10MB → erro amigável antes de gravar (hoje o limite de 1MB vale para escrita; uploads de imagem/PDF podem passar por data URL).
- [ ] **Rate limit dinâmico no proxy:** `gitCorsProxy` com cota por `uid` — owner (via `users/{uid}.role`) com 200 req/min, demais 50 req/min (hoje fixo 50).
- [ ] **Auditoria final de segurança:** conferir CSP (sem `eval`), DOMPurify em todos os renderers, e ARIA labels — checklist S18.

**Critérios de Aceite:** PDF grande não trava o Safari; upload >10MB bloqueado com mensagem; owner não esbarra no rate limit; auditoria S18 sem falhas.

---

## Fase 7 — Retrofit 16-bit (S27–S30)

> Design system aprovado em **`docs/layout.md`** (2026-08-16): estética **Retro-Futurismo 16-bit** — a identidade atual (#0f172a Dark Slate + #2dd4bf Teal/Cyan) mantida, expandida com paleta SNES/Genesis e componentes gamificados. Implementação **faseada** conforme Seção 8.1 do `layout.md`. **Regras globais:** pixel perfeito (múltiplos de 4px), animações só `transform`/`opacity`, fontes fora do caminho crítico, contraste WCAG AA, testes junto do código.

### S27 — Retrofit 16-bit: Fundação (layout.md §3, §11.1, §2.1) 🟠 ALTO

**Cobre:** `index.html` · `main.css` · `vite.config.js` (SW/fonts).

- [ ] **Fontes pixeladas:** carregar `Press Start 2P`, `VT323` e `Silkscreen` fora do caminho crítico (preconnect + stylesheet assíncrono em `app.js`, como já feito para Press Start 2P); fallback `system-ui` sem flicker.
- [ ] **Tokens CSS 16-bit:** variáveis `--pixel-*` (success/warning/danger/info/purple/gold/border/shadow/grid) no `:root` + regras de aplicação (cards `--bg-secondary` + borda pixel 2px; botões primários accent; hover `brightness(1.15)`; press `translateY(2px)`).
- [ ] **CSS Reset 16-bit:** `box-sizing: border-box`, `image-rendering: pixelated` em ícones/imagens, `-webkit-font-smoothing: none`, `user-select` correto (UI bloqueado, editor/chat texto).
- [ ] **Utilities:** `.pixel-border` (box-shadow inset), `.pixel-btn` + variantes (primary/danger/success/ghost/deploy), `.pixel-icon` (16/24/32/48px com `shape-rendering: crispEdges`).
- [ ] **Bundle/performance:** garantir que as 3 fontes não inflam o caminho crítico (lazy) e que o CSS fique < 15KB gzip alvo do layout.md.

**Critérios de Aceite:** fontes pixeladas ativas em Display/Body/Label; paleta 16-bit disponível; utilitários reutilizáveis; sem regressão de LCP/FCP; testes verdes.

### S28 — Retrofit 16-bit: Componentes Core (layout.md §4.2–4.5) 🟠 ALTO

**Cobre:** `main.css` · `index.html` · `app.js` (classes preservadas).

- [ ] **Activity Bar (menu de RPG):** 48px, `--bg-secondary` + borda direita pixel, botões 40px com pixel border (inset), hover `translateY(-2px)`, active `translateY(2px)`, `pulse-pixel` no item ativo.
- [ ] **Bottom Sheet (caixa de diálogo):** `border-top: 4px solid accent`, handle estilo "puxador RPG" (com `::before/::after`), tabs pixel (`--font-pixel` uppercase), scrollbar pixelada (track/thumb).
- [ ] **Editor (tema CodeMirror 16-bit):** `--font-code` no `.cm-editor`, gutters `--font-pixel`, activeLine/seleção teal, **syntax highlighting 16-bit** (`.tok-*`: keyword roxo, string verde, number ouro, function azul, typeName laranja).
- [ ] **Editor tabs:** `--font-pixel`, `border-right` pixel, tab ativa com `border-bottom` accent, dirty com `●` `--pixel-warning`.
- [ ] **Explorer Drawer (inventário):** `border-right: 4px solid accent`, header pixel, `.tree-item` com `--font-pixel` e marcadores `▶/▼/◆` (pasta aberta/fechada/arquivo), botão 👁 com hover.
- [ ] **Regressão:** verificar que as classes reais do DOM batem com as do layout.md (`activity-bar`/`.ab-item`, `bottom-sheet`/`.sheet-*`, `editor-tabs`/`editor-tab`, `file-tree`/`tree-item` — mapear e renomear se preciso).

**Critérios de Aceite:** 4 componentes refatorados visualmente; nenhuma funcionalidade quebrada (drawer/sheet/editor intactos); testes de UI/regressão verdes.

### S29 — Retrofit 16-bit: Interações & VFX (layout.md §4.7–4.9, §5.1–5.2) 🟠 ALTO

**Cobre:** `main.css` · `ui/notify.js` (toasts) · `ui/diff-viewer.js` · chat UI.

- [ ] **Sistema de partículas** (`particle-system.js`): canvas 2D overlay (pointer-events none), `emit(x, y, type)` com paletas confetti/success/error/deploy — chamado em: deploy, commit, aceitar/rejeitar diff, salvamento.
- [ ] **Toasts de conquista:** `.pixel-toast` (gold border, slide-in + rotate) com título/mensagem; variantes success/error — integrar ao `notify.js` como `notify.achievement({title, message, xp, icon})`.
- [ ] **Microinterações:** deploy `:active::after` foguete (`rocket-launch`), save flash (`editor-save-flash`), streaming cursor (`chat-bubble.streaming` com `blink-cursor`), achievement bounce.
- [ ] **Diff Viewer (tela de batalha):** `.diff-block` com border pixel, header pixel, linhas added/removed (verde/vermelho com `line-through`), `.diff-actions` com botões aceitar/rejeitar pixel.
- [ ] **Chat (terminal RPG):** bubbles pixel (`chat-bubble` com box-shadow inset), user à direita (accent), AI à esquerda (tertiary), thinking dots animados, input pixel.

**Critérios de Aceite:** partículas leves (canvas único, sem thrasher); toasts com borda gold; diff/chat legíveis (contraste AA); animações só transform/opacity; testes verdes.

### S30 — Retrofit 16-bit: Polish & Go Live (layout.md §6, §5.3, §8.2–8.4) 🟡 MÉDIO

**Cobre:** ícones SVG · `main.css` · bundle · device real.

- [ ] **Ícones pixel art:** substituir os SVGs Lucide por versões 16-bit do `layout.md` §6.2 (Explorer=baú, Chat=speech bubble, Settings=engrenagem, Deploy=foguete, Preview=olho, Menu=3 pixels, Aceitar=check, Rejeitar=X) com `shape-rendering: crispEdges`.
- [ ] **Efeito CRT opcional:** toggle em Settings (`body.crt-effect` com scanlines + vignette) — off por padrão.
- [ ] **Barra de progresso XP/deploy:** `.xp-bar` + `.xp-bar-fill` com shine (deploy/polling de Pages).
- [ ] **Mockups validados:** conferir contra §9 (header com ícones, status bar "LV.42 · 1337 XP", sheet tabs [💬][⚔][👁][🎮]).
- [ ] **Otimização de bundle:** remover fontes não usadas, lazy-load Lottie/partículas se necessário; CSS < 15KB gzip.
- [ ] **Device real:** testar fontes/partículas/animações no iPhone (Safari, safe-areas, teclado flutuante, performance).

**Critérios de Aceite:** visual 16-bit consistente em todas as telas; bundle sem regressão; zero jitter no iPhone; Lighthouse ≥ 85; testes verdes.

---

## Fase 8 — Correções da Auditoria do Chat (S31–S36b)

> Auditoria de uma conversa real (16/08) em que o usuário pediu um site de currículo no chat. O fluxo de geração apresentou **5 erros** que tornam o chat ilegível e destrutivo: o bubble exibe o JSON cru da tool call; o HTML do currículo "some" no bubble (parse acidental como HTML); um simples "oi" dispara criação de 3 arquivos; follow-ups ("me de os arquivos", "me de o localhost") regeneram/sobrescrevem arquivos por falta de memória; e o demo/MVP genérico sai malformado (JSON inválido, tags quebradas). Cada sprint corrige um grupo **na ordem de impacto no usuário** (leitura → intenção → memória → robustez). **Regra:** testes junto do código (regra global).

### S31 — Correção: Chat legível — renderizar `message` + chips, nunca o JSON cru (Erros 1 e 2) 🔴 CRÍTICO

**Cobre:** `app.js` (render do bubble) · `agent-manager.js` (retorno de `message`/`files`).

- [x] **Renderizar só o resumo + chips:** no `sendMessage`, usar o campo `message` extraído pelo driver como texto principal do bubble (sanitizado com `marked` + `DOMPurify`), em vez de injetar o `buf` bruto da stream.
- [x] **Chips de arquivo gerados:** após o texto, renderizar um chip por arquivo criado (`[📄 index.html]`) com ações **Abrir** (editor) e **👁** (preview) — nunca o conteúdo do arquivo no bubble.
- [x] **JSON cru só em `<details>` de debug:** o payload completo da tool call (se ainda for desejado) vai em `<details>` renderizado via `textContent` (nunca `innerHTML`), evitando XSS e o "sumiço" das tags.
- [x] **Fallback quando não há `message`:** se o driver não extrair `message`, mostrar "✅ Arquivos gerados." + chips.
- [x] **Testes:** `chat-renderer.test.js` (jsdom) — `buildFinalText` usa o `message` (nunca o raw); chips Abrir/Preview; `<details>` de debug via `textContent` (zero `<script>` executável).

**Critérios de Aceite:** o bubble mostra apenas a explicação + chips; o JSON/HTML cru nunca vira innerHTML do bubble; o chip abre o arquivo real gravado no VFS.

### S32 — Correção: Gate de intenção — chitchat não gera arquivos (Erro 3) 🟠 ALTO

**Cobre:** `agent-manager.js` (antes do dispatch do prompt) · `app.js`.

- [x] **Detectar saudações/agradecimentos:** `^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|obrigado|valeu|ok|tudo bem)[\s!.,?]*$` → responder textualmente ("Olá! 👋 Me diga o que você quer construir.") **sem** chamar o LLM nem executar tools.
- [x] **Manter o gate nos dois modos:** funciona em `DEMO` e em `LIVE` (evita gastar tokens e sobrescrever arquivos).
- [x] **Fallback seguro:** se o gate errar (falso positivo raro), a resposta é inofensiva (texto puro, zero tools).
- [x] **Testes:** `agent-manager.test.js` — "oi", "obrigado" não chamam o provider nem criam arquivos; um prompt real ("crie um site") não é bloqueado.

**Critérios de Aceite:** cumprimento responde com texto e não toca o VFS; prompts de construção passam pelo gate sem alteração.

### S33 — Correção: Memória conversacional — histórico + estado do VFS no contexto (Erro 4, parte 1) 🔴 CRÍTICO

**Cobre:** `agent-manager.js` (`buildSystemPrompt`) · `app.js` (passar `chatHistory`).

- [x] **Injetar histórico recente no system prompt:** `buildSystemPrompt(contextFiles, history)` inclui as últimas ~6 mensagens (`user`/`assistant`) — resolve o "me de os arquivos" logo após criar o currículo.
- [x] **Injetar o estado do VFS:** `vfs.listDir('')` + lista de paths raiz no contexto, para o modelo saber que `index.html`/`style.css`/`script.js` já existem (e não regenerar MVP genérico).
- [x] **Guard contra sobrescrita:** no `sendPrompt`, avisar quando um `write_file` sobrescreve um arquivo pré-existente (path já existente no VFS antes da geração) — exibir como nota no resultado (o Diff já cobre a revisão).
- [x] **Testes:** `agent-manager.test.js` — system prompt contém o histórico e a listagem do VFS; tool `write_file` de path pré-existente retorna aviso de overwrite.

**Critérios de Aceite:** follow-up "me de os arquivos" recebe resposta coerente com o que foi criado; nova geração não pisa em arquivos existentes sem que o usuário perceba.

### S34 — Correção: Intenção "ver o site" — localhost → Preview/Deploy (Erro 4, parte 2) 🟡 MÉDIO

**Cobre:** `app.js` (handler de intenção) · `viewer`/`showPane`.

- [x] **Detectar intenção de visualização:** regex `localhost|preview|ver o site|abrir o site|rodar|mostrar` no prompt → abrir `showPane('preview')` + `viewer.openFile('index.html')` (ou o primeiro `.html` do VFS).
- [x] **Explicar a ausência de localhost:** resposta textual amigável ("O CAIM não usa localhost 🙃 — abri o **Preview** do index.html no pane 👁. Para publicar, use 🚀 Deploy.") sem chamar o LLM.
- [x] **Fallback:** se não existir `index.html`, listar arquivos e abrir o primeiro arquivo renderizável; se não houver nada, orientar a criar um projeto.
- [x] **Testes:** `chat-renderer.test.js` (jsdom) — "me de o localhost" abre o pane preview do index.html sem chamar o provider.

**Critérios de Aceite:** pedido de "ver/rodar o site" abre o Preview e responde sem regenerar arquivos; mensagem clara de que não há localhost.

### S35 — Correção: Geração robusta — demo `JSON.stringify` + system prompt só com esquema (Erro 5) 🟠 ALTO

**Cobre:** `agent-manager.js` (`demoSend`/`SYSTEM_PROMPT`) · `app.js` (rótulo demo).

- [x] **System prompt sem exemplo completo:** trocar o JSON de exemplo do `SYSTEM_PROMPT` por **apenas o esquema** ("responda SOMENTE no formato: `{"message": string, "files": [{"path": "nome.ext", "content": "texto"}]}`. Nunca repita exemplos; siga exatamente o pedido.") — elimina o few-shot leakage que fazia o modelo copiar o MVP do botão.
- [x] **Demo via `JSON.stringify`:** `demoSend` monta o payload com `JSON.stringify({ message, files })` (nunca concatenação manual de aspas) com template HTML **válido** (DOCTYPE, `<head>`, `<body>`, tags fechadas).
- [x] **Rótulo `[MODO DEMO]`:** prefixar `message` com `[MODO DEMO]` para o usuário saber que é stub local (não geração real).
- [x] **JSON nunca quebrado:** garantir que `demoSend` retorne objeto (não string) — o driver/executor já trata; corrigir qualquer ponto que emita JSON inválido.
- [x] **Testes:** `agent-manager.test.js` — system prompt NÃO contém arquivo de exemplo; `demoSend` produz JSON parseável e `write_file` grava HTML bem-formado com DOCTYPE; message com rótulo `[MODO DEMO]`.

**Critérios de Aceite:** modelo não copia o exemplo (gera o que foi pedido); demo gera JSON válido e HTML completo; modo demo claramente identificado na resposta.

### S36 — Gestor de projetos no dashboard (locais + publicados) 🔵 NOVO RECURSO

**Cobre:** `src/js/core/vfs-service.js` (Dexie v2) · `src/js/core/project-service.js` (novo) · `src/js/ui/auth-views.js` · `app.html` · `src/js/app.js` (deploy integrado) · `main.css`.

**Contexto:** o dashboard só listava MVPs publicados (Firestore). O usuário pediu que a tela fosse um **gestor de projetos**: ver os projetos que já fez (**locais e publicados**) e escolher **continuar**, **começar do zero**, **editar o nome** ou **excluir** — com exclusão **só local** (nunca apagar do GitHub o que já foi publicado).

- [x] **Modelo de dados local (Dexie v2):** tabelas `projects` (`&id, name, createdAt, lastModified, deployed, url, fileCount`) e `project_files` (`&[projectId+path], projectId, path, content, mimeType`) — `vfs-service.js` agora com `db.version(2)` (schema anterior preservado; `metadata` continua `&key, value`).
- [x] **`project-service.js` (novo):** snapshot nomeado do workspace por projeto — `newProject` (limpa workspace + cria + ativa), `createFromWorkspace` (deploy sem projeto ativo: snapshot sem limpar), `saveProjectSnapshot`, `openProject` (restaura snapshot e **salva o projeto ativo anterior** antes de trocar), `renameProject`, `deleteProject` (**só local — nunca toca o GitHub**), `markDeployed`, `clearWorkspace`, `get/setActiveProjectId` (via `metadata`), `slugify` (normaliza acentos/espaços). A exclusão nunca toca o workspace atual.
- [x] **Dashboard em duas seções:** **"Projetos locais"** (`#dashboard-local-projects`, ações Continuar/Renomear/Excluir) + **"Publicados no GitHub"** (`#dashboard-projects`, ações Abrir/Renomear rótulo/Remover da lista — repo no GitHub intacto). Botão **"Novo projeto"** pede nome, limpa o workspace e entra na IDE.
- [x] **Deploy integrado:** após `addProject` no Firestore, grava o snapshot do projeto ativo (ou cria via `createFromWorkspace`) e `markDeployed(id, url)` → badge "🚀 publicado" com link no card local. `resetWorkspace` limpa também o projeto ativo (deploy seguinte cria projeto novo).
- [x] **`app.js`:** `onOpenProject(id)` restaura o snapshot no workspace e abre a IDE com árvore/chat recarregados.
- [x] **CSS:** `.dash-section-title`, `.project-card-head`, `.project-badge`, `.project-meta`, `.project-action-primary`.
- [x] **Testes:** `project-service.test.js` (snapshot/continuar/renomear/excluir-local/markDeployed/createFromWorkspace/troca de ativo/clearWorkspace preserva projetos/slugify) + `auth-views.test.js` (cards locais e publicados, Continuar→`onOpenProject`, Novo projeto→`newProject`+`onEnterIde`, exclusão só local com confirmação).

**Critérios de Aceite:** dashboard mostra locais + publicados; continuar restaura os arquivos no workspace; renomear/excluir só afetam o registro local; botão "Novo projeto" leva à IDE limpa.

### S36b — Toast de deploy persistente + URL salva para o usuário 🔵 UX FIX

**Cobre:** `src/js/ui/notify.js` (duração) · `src/js/app.js` (deploy) · `src/js/ui/notify.test.js` (novo).

**Contexto:** após o deploy, o toast "construindo/sucesso" **sumia em 3,5s** e o console mostrava `Failed to load resource: 404` no endereço do MVP. O usuário pediu que a URL ficasse salva para clicar e abrir no navegador.

- [x] **Diagnóstico do 404:** o `404` no console é **esperado e inofensivo** — `waitForPagesLive` (S24) faz `HEAD` a cada 5s enquanto o GitHub Pages compila; o recurso só existe depois do build. O site estava no ar.
- [x] **URL já salva em 2 lugares:** Firestore (`addProject`) → card clicável em "Publicados no GitHub" e projeto local via `markDeployed` → badge "🚀 publicado" com link. O problema era o toast sumir antes do usuário clicar.
- [x] **`notify.toast` com `duration: 0` = persistente:** só fecha pelo botão (não agenda `setTimeout`).
- [x] **Fluxo de deploy:** toast "construindo" persistente e fechado explicitamente (`buildingToast.close()`) quando o Pages fica online; sucesso agora é **"MVP publicado! Ficou salvo no dashboard."** com botão **"Abrir"** persistente.
- [x] **Testes:** `notify.test.js` (jsdom + fake timers) — toast padrão some na duration; `duration:0` permanece (120s+); botão fecha e dispara `onClick`.

**Critérios de Aceite:** o usuário tem tempo de clicar em "Abrir" (toast não some sozinho); mensagem informa que a URL ficou salva no dashboard; sem novos 404s causados pelo app (o do `HEAD` de build é esperado).

---

## Fase 9 — Roadmap pós-Go-Live: Produtividade, Poder & Colaboração (S37–S53)

> Brainstorm completo de features (18/08/2026) transformado em sprints **na ordem cronológica de execução**: começa pelo polimento imediato de UX (ícones, busca, editor), passa por produtividade de projeto (templates/import/export), evolução do agente (autonomia, multimodal, memória, RAG), Git/Deploy avançado, preview de aplicações, e termina em multi-device/colaboração e infra/segurança. **Regras globais:** cada sprint entrega testes junto do código (regra global); nada depende de backend novo que não seja coberto pelas Functions existentes (ou por nova Function com testes). As pendências de **device real** das Fases 5/8 permanecem pré-requisito de validação, não de build.

### S37 — Ícones por tipo de arquivo no Explorer 🟢 BAIXO

**Cobre:** `src/js/ui/file-icons.js` (novo) · `src/js/ui/file-tree.js` · `main.css`.

- [x] **Módulo `file-icons.js`:** mapa extensão → `{svg, cls}` (html/css/js/ts/jsx-tsx/json/md/img/pdf/doc/xls/ppt/zip/txt/py) + dotfiles (`.gitignore`→git, `.env`/`.npmrc`→config) + fallback genérico; SVGs lucide-stroke (contorno `opacity .45` + glyph colorido), mesmo estilo visual do explorer.
- [x] **Wiring:** `fileNode` usa `getFileIcon(file.name)` → classe `ft-icon-*` no span (substitui o ícone único).
- [x] **Cores AA:** `.ft-icon-html/.css/.js/...` no `main.css` (paleta 16-bit, contraste sobre o OLED).
- [x] **Testes:** `file-tree.test.js` — ícone específico por extensão e fallback para desconhecidos. **142 verdes**, build limpo.

**Critérios de Aceite:** cada tipo de arquivo tem ícone distinto e colorido; extensão desconhecida usa o genérico; XSS do nome intacto; bundle sem regressão.

### S38 — Busca fuzzy (go-to-file) & Find/Replace global 🟡 MÉDIO

**Cobre:** `src/js/ui/search-panel.js` (novo) · `src/js/ui/editor.js` · `src/js/ui/file-tree.js` · `src/js/core/vfs-service.js` · pane Search da activity bar.

- [x] **Go-to-file fuzzy:** campo de busca no drawer de busca (activity bar 🔍) que filtra paths do VFS com score (`exact > basename startsWith > basename contains > path contains > subsequência`) e navegação por Enter.
- [x] **Abrir resultado:** clique/Enter abre no editor (recolhe o sheet e fecha o drawer); placeholder "Nenhum arquivo encontrado".
- [x] **Find & Replace global:** modo "Encontrar" busca termo no conteúdo de todos os arquivos de texto (ignora `.git/`, binários, data URLs) → resultados agrupados por arquivo com linha/coluna → "Substituir todos" com confirmação (`notify.confirm`).
- [x] **Testes:** `search-panel.test.js` (jsdom + fake-indexeddb) — score/ordenação, `isTextPath`, `findMatches` (linha/coluna/case/cap), `findInFiles`/`replaceInFiles` no VFS real (emite `vfs:changed`), UI (hit abre editor, find agrupa por arquivo). **156 verdes**, build limpo.

**Critérios de Aceite:** achar arquivo entre dezenas em <1s no celular; substituição global é atômica e reversível pelo Diff (S5).

### S39 — Editor avançado (snippets, atalhos, tema, multi-cursor) 🟡 MÉDIO

**Cobre:** `src/js/ui/editor.js` · `auth-views.js` (Settings) · `main.css`.

- [x] **Snippets:** lista global + por linguagem (ex.: `!html`, `fn`, `for`) inserida pela toolbar flutuante iOS (botão ⚡) e por atalho de teclado externo (**Ctrl/⌘+Space** expande a palavra antes do cursor); **customizáveis no editor** (picker "＋ Novo snippet" → prompt de gatilho+conteúdo) e persistidos em `metadata` (`editor-prefs`). (`src/js/core/snippets.js` + `src/js/core/editor-prefs.js`.)
- [ ] **Atalhos customizáveis:** mapeamento tecla→ação (Ctrl+S salvar, Ctrl+Enter abrir chat, Tab indent) editável no Settings.
- [x] **Tema do editor:** seleção de esquemas de cor (**16-bit** padrão / **Claro**) + tamanho de fonte (12–20) + fonte (**mono/pixel**) no Settings — sem recarregar (reconfigure de compartments do CodeMirror). (`loadEditorPrefs`/`saveEditorPrefs` em `editor-prefs.js`; `applyPrefs` em `editor.js`; bloco "Editor" no `#settings-list`.)
- [ ] **Multi-cursor:** suporte a múltiplos seletores via teclado externo + **undo multi-pass** já nativo do CM6 validado no mobile.
- [x] **Testes:** `editor-prefs.test.js` (defaults/persistência/merge), `snippets.test.js` (findSnippet por lang/prefixo `!`/custom, langFromPath, wordBeforeCursor), `editor.test.js` (expansão, insertSnippet+dirty, applyPrefs, savePrefs) — **175 verdes**. `setup.js` ganhou polyfill de `Range#getClientRects` p/ o drawSelection no jsdom.

**Critérios de Aceite:** snippets inserem texto correto na posição do cursor; troca de tema/fonte não destrói tabs nem cursor; atalhos não conflitam com o teclado iOS.

### S40 — Templates de projeto & Dashboard UX 🟡 MÉDIO ✅

**Cobre:** `src/js/core/project-service.js` · `src/js/ui/auth-views.js` · `app.html` · `main.css`.

- [x] **Templates de projeto:** catálogo `PROJECT_TEMPLATES` (HTML/CSS/JS puro, React via CDN, Python, Markdown doc, Currículo 16-bit), exportado do `project-service`; "Novo projeto" abre action sheet com "Em branco" + cada template (nome + descrição via `notify.actions` com `title`/`subtext`); `newProjectFromTemplate(name, id)` limpa o workspace, grava os arquivos do template e faz snapshot.
- [x] **Duplicar projeto:** `duplicateProject(id)` → snapshot copiado com nome "Cópia de X" (id único se já existir "cópia de"); nunca toca o original nem o workspace.
- [x] **Pin/favoritos:** `pinned` no registro `projects` (v3 do VFS) → card fixado no topo do dashboard; `togglePin(id)`.
- [x] **Busca + tags + ordenação:** `#dashboard-search` filtra por nome **ou tag** (case-insensitive), `#dashboard-sort` ordena por recência/nome no cliente; `setTags(id, tags)` normaliza (minúsculas, sem duplicadas, máx. 8).
- [x] **Testes:** `project-service.test.js` (templates/duplicate/pin/tags) + `auth-views.test.js` (busca/ordenação/pin do dashboard).

**Critérios de Aceite:** ✅ criar projeto a partir de template grava snapshot válido; ✅ duplicar não toca o original; ✅ dashboard filtra/ordena sem erro e sem índice composto.

### S41 — Import/Export de projeto & Lixeira 🟡 MÉDIO ✅

**Cobre:** `src/js/core/project-service.js` · `src/js/ui/auth-views.js` · `vfs-service.js` (v3) · `main.css`.

- [x] **Exportar projeto completo em `.zip`:** `exportProjectZip(projectId)` (JSZip, sem `.git`/`.env`) — reusa o padrão do S24, agora por projeto; baixa `Projeto.zip`.
- [x] **Importar `.zip`:** `importProjectZip(file, name)` descompacta para `project_files` (valida paths com `sanitizeZipPath`, limite 1MB/arquivo e 20MB total, mime resolvido) → novo projeto local com nome do arquivo; nunca toca o workspace atual.
- [x] **Lixeira:** tabela `trashed` (v3 do VFS); `trashProject(id)` move (não apaga) e desmarca o ativo; "Lixeira" no dashboard (`#dashboard-trash-btn` → `toggleTrashView`) com **Restaurar** (`restoreProject`) e **Apagar definitivamente** (`purgeProject`), além de **Esvaziar lixeira** (`emptyTrash`) — tudo só local, nunca GitHub.
- [x] **Testes:** `project-service.test.js` (zip round-trip com `jszip`/`fake-indexeddb`, paths perigosos, limites, trash/restore/purge/empty) + `auth-views.test.js` (UI da lixeira).

**Critérios de Aceite:** ✅ export/import preserva conteúdo e mime; ✅ zip malicioso (path traversal) nunca sai do VFS; ✅ lixeira restaura sem tocar o workspace atual.

### S42 — Autonomia controlada & Planos de execução 🟠 ALTO ✅

**Cobre:** `src/js/agents/agent-manager.js` · `src/js/agents/tool-executor.js` · `app.js` · `app.html` · `main.css`.

- [x] **Slider de permissões:** por projeto (`metadata` chave `agent-permission:<id>`) — `PERMISSION = { ask, review, auto }`; `ask` (responde com plano sem executar), `review` (executa e mostra no Diff, padrão atual), `auto` (executa sem pedir). Toggle `.perm-toggle` no header do chat (`syncPermButtons`).
- [x] **Planos de execução:** quando `ask`, o agente devolve `{ plan: { message, tools, filesList } }`; checklist renderizado no chat (`renderPlanChecklist` + chips) com **"Aprovar tudo"** (`executePlan(plan)`) e **"Aprovar passo"** (`executePlan(plan, { only })`).
- [x] **Undo de tool calls:** `before/after` por arquivo tocado (rodada acumulada em `undoStack`, resetada via `beginUndo()`); **"Reverter alteração da IA"** (`undoLastPlan`) restaura o estado anterior byte a byte ou remove arquivos novos; `vfs:changed` com modo AUTO aplica sem diálogo de conflito.
- [x] **Testes:** `agent-manager.test.js` — gate `ask` bloqueia tool sem aprovação; `auto`/`review` executam inline; `executePlan` tudo/passo; `undo` restaura conteúdo; permissão persistida em metadata.

**Critérios de Aceite:** ✅ nenhuma tool roda sem a permissão escolhida; ✅ reverter restaura byte a byte; ✅ plano aprovável em 1 toque; ✅ nada disso quebra o fluxo `review` atual.

### S43 — Multi-agente & Novos drivers 🟠 ALTO

**Cobre:** `src/js/agents/agent-manager.js` · `src/js/agents/drivers/*.js` · `chat-renderer.js`.

- [ ] **Novo driver Kilo/Claude Code:** parser de tool calls (estilo Anthropic) no padrão `base-driver.js` — `setDriver('kilo'|'opencode'|'cline')` selecionável no Settings.
- [ ] **Sub-agentes paralelos:** orquestrador divide um pedido em tarefas (ex.: "refatore X enquanto revisa Y") e executa em sequência no VFS (mesmo thread — sem Web Worker ainda), com resultados agregados no chat.
- [ ] **Prompt templates & histórico:** salvos em `metadata`, inseríveis por atalho no chat (ex.: "gerar README", "explicar código"); histórico de prompts favoritos com reenvio em 1 toque.
- [ ] **Testes:** `drivers.test.js` (parse Kilo), `agent-manager.test.js` (sequenciamento de sub-agentes, templates).

**Critérios de Aceite:** driver Kilo parseia tool calls reais; sub-agentes não pisam nos mesmos arquivos ao mesmo tempo; template insere prompt válido.

### S44 — Chat multimodal & Voz 🟠 ALTO

**Cobre:** `app.js` (chat) · `viewer.js`/upload · `agent-manager.js` · VFS.

- [ ] **Anexos no prompt:** botão clip no chat → anexa imagem/PDF/arquivo do VFS ou upload local; conteúdo convertido para o formato que o driver aceita (imagem em data URL/base64 no payload quando o provider suporta; senão descrição textual).
- [ ] **Gate de anexo:** aviso claro quando o provider ativo não suporta visão ("anexei o arquivo como referência de contexto").
- [ ] **TTS das respostas:** botão 🔊 no bubble → `speechSynthesis` (Web Speech, offline quando o sistema tem voz baixada); respeita o foco e safe-area.
- [ ] **Testes:** `chat-renderer.test.js` (chip de anexo, botão 🔊 não quebra o bubble) + `agent-manager.test.js` (payload com anexo).

**Critérios de Aceite:** anexar screenshot/PDF e pedir "corrija isso" envia contexto sem quebrar streaming; TTS não trava o render; zero XSS no caminho do anexo.

### S45 — Memória por projeto & RAG local 🟠 ALTO

**Cobre:** `src/js/core/project-service.js` · `src/js/agents/agent-manager.js` · VFS (`metadata`).

- [ ] **Memória persistente por projeto:** resumo do estado (arquivos, decisões, última tarefa) salvo no snapshot (`project_files`/`metadata`) e reinjetado no system prompt ao reabrir — "continue de onde paramos".
- [ ] **RAG local:** `buildCodeIndex()` indexa arquivos de texto (nome, paths, palavras-chave) em `metadata`; intent "pergunte ao codebase" → recupera os N trechos mais relevantes (score por termo) e injeta como contexto.
- [ ] **GC de memória:** cap de contexto (limite de tokens) com poda dos trechos menos recentes/relevantes.
- [ ] **Testes:** `project-service.test.js` (memória salva/restaurada) + `agent-manager.test.js` (índice + recuperação).

**Critérios de Aceite:** reabrir um projeto mantém o contexto da conversa anterior; "explique meu código" responde com base nos arquivos reais; memória cabe no limite de tokens.

### S46 — Git avançado (clone/pull, branches, diff entre commits) 🟠 ALTO

**Cobre:** `src/js/git/git-service.js` · `functions/src/index.js` (`gitCorsProxy`) · `src/js/ui/git-panel.js` · `diff-viewer.js`.

- [ ] **Clone/pull de repo existente:** endpoint `gitCorsProxy` já aceita clone via isomorphic-git; UI para colar URL → `clone` para o VFS como projeto local (com `--depth 1` para mobile).
- [ ] **Branches:** `branch`/`checkout`/`merge` no Git pane (lista + criar + trocar + badge da branch atual).
- [ ] **Diff entre commits:** `log` → selecionar 2 commits → diff completo entre eles no pane `diff` (read-only).
- [ ] **Resolução de conflitos:** `merge` com conflito → lista de arquivos em conflito com marcadores `<<<<<<<` editáveis no editor + "Resolver" (aceitar ours/theirs/editar).
- [ ] **Testes:** `git-service.test.js` (offline: branch/checkout/merge sem conflito, diff entre commits) — conflitos ficam para teste manual/E2E.

**Critérios de Aceite:** clonar repo público funciona no celular; merge sem conflito aplica corretamente; diff entre commits renderiza no pane; conflito sinalizado e editável.

### S47 — Deploy contínuo & CI (preview channels, GitHub Actions) 🟡 MÉDIO

**Cobre:** `functions/src/index.js` (`githubDeployProxy`) · `app.js` (deploy) · `vite.config.js`.

- [ ] **Preview channels:** cada deploy gera **dois** links — o Pages final e um `preview` (branch temporária) para checar antes de publicar; reusar `waitForPagesLive` para ambos.
- [ ] **Re-deploy automático:** botão "Republicar" no card publicado (mesmo repo, novas mudanças) via `githubDeployProxy` + `markDeployed` atualiza URL/timestamp.
- [ ] **GitHub Actions como CI:** template `.github/workflows` embutido no repo criado (build `npm run build` + `npm test`) com status exibido no card publicado.
- [ ] **Testes:** `functions` — unit do proxy (payload → contents API) com mocks; `app.js` — fluxo republicar no jsdom (mocks de fetch).

**Critérios de Aceite:** republicar não cria repo novo (atualiza o mesmo); preview channel responde antes do promote; status do CI aparece no dashboard sem erro.

### S48 — Preview de aplicações completas & Terminal embutido 🟡 MÉDIO

**Cobre:** `src/js/ui/viewer.js` · `app.js` (pane preview) · `main.css`.

- [ ] **Sandbox completo de app:** preview HTML com **iframe `sandbox`** + `localStorage`/`sessionStorage` isolados por projeto (prefixo no VFS) e console capturado (`console.log` do iframe via `postMessage`) exibido num painel.
- [ ] **Terminal/console interativo:** no pane preview, aba "Console" que roda **JS do projeto no browser** (blob/Worker sandboxado com acesso só ao VFS via API exposta) — sem `eval` no escopo do app (CSP preservado).
- [ ] **Device emulation:** presets de viewport (iPhone SE/15, Android, desktop) para o preview.
- [ ] **Testes:** `viewer.test.js` (jsdom) — `postMessage` de console é escapado/seguro; sandbox attributes presentes; console não injeta HTML.

**Critérios de Aceite:** app de exemplo roda com estado isolado; console captura logs sem XSS; emulação de viewport não quebra o layout do preview.

### S49 — Cloud Sync multi-device (RxDB) 🟠 ALTO

**Cobre:** `src/js/core/vfs-service.js` · `src/js/core/project-service.js` · `src/js/db/db-service.js` · `firestore.rules`.

- [ ] **Sync de projetos entre devices:** replicação RxDB (ou Dexie sync) `project_files` ↔ Firestore/Storage por projeto — trocar de device mantém arquivos, memória e histórico.
- [ ] **Conflito de sync:** `lastModified` mais recente vence; divergência real é marcada como conflito (reuso do diff para resolver).
- [ ] **Offline-first:** fila de operações locais + reconciliação ao voltar online (badge "sync pendente" no dashboard).
- [ ] **Privacidade:** opt-in por projeto (local-only por padrão — regra de ouro do `context.md`); chaves LLM continuam cifradas e nunca sincronizadas em claro.
- [ ] **Testes:** `project-service.test.js` (serialização/replicação de snapshot, resolução por timestamp) + `db-service.test.js` (mocks).

**Critérios de Aceite:** editar no device A reflete no B após reconnect; offline não perde edição; opt-in claro; regras do Firestore impedem ler projeto de outro dono.

### S50 — Colaboração em tempo real (presença, cursores, chat) 🟠 ALTO

**Cobre:** `firestore.rules`/`firestore.indexes.json` · `db-service.js` · `editor.js` · chat UI.

- [ ] **Presença & convite:** compartilhar link/QR de um projeto (role `viewer`/`editor` por convite) → lista de "quem está online" no header.
- [ ] **Cursores compartilhados:** broadcast de posição de cursor no editor (throttle ~100ms) via Firestore (`presence/{projectId}/{uid}`), com cor por usuário.
- [ ] **Chat ao vivo:** mensagens de sessão (não confundir com o chat do agente) separadas por projeto; notificação suave (toast).
- [ ] **Guard de edição:** trava otimista por arquivo (um editor por vez) + merge de edições não conflitantes ao liberar.
- [ ] **Testes:** `db-service.test.js` (presença CRUD) + `editor.test.js` (cursor remoto não move o cursor local indevidamente).

**Critérios de Aceite:** 2 usuários editam o mesmo projeto sem corromper o VFS; cursor remoto é visível mas não rouba o foco; convite respeita as regras de ownership.

### S51 — Onboarding, modo convidado & i18n 🟡 MÉDIO

**Cobre:** `src/js/ui/auth-views.js` · `app.js` · `main.css` · `app.html`.

- [ ] **Onboarding guiado:** 3 passos (criar projeto → gerar site no chat → publicar) com dicas contextuais; dismissível e salvo em `metadata`.
- [ ] **Modo convidado/demo:** projeto de exemplo carregado sem login (dados locais; banner "Modo demonstração"); upgrade pede cadastro.
- [ ] **i18n PT/EN/ES:** dicionário em módulo `ui/i18n.js` + `data-lang`; strings do app (auth/dashboard/settings/chat/explorer) migradas; padrão `pt-BR`.
- [ ] **Feedback & changelog:** botão "Feedback" (mailto/toast) + `CHANGELOG` renderizado no dashboard.
- [ ] **Testes:** `auth-views.test.js` (convidado→cadastro, troca de idioma) + `i18n.test.js` (chaves completas entre idiomas).

**Critérios de Aceite:** visitante entende o app em 1min; demo não grava nada no Firestore; troca de idioma reflete sem reload; strings PT completas.

### S52 — Diagnóstico & Notificações 🟡 MÉDIO

**Cobre:** `app.js` · `auth-views.js` (Settings) · `firebase-config.js` · SW.

- [ ] **Health check do app:** tela de diagnóstico — status do Firebase Auth/Firestore, chaves LLM (botão "testar todas"), storage (quota), SW (versão/registro), rede; exporta log para copiar.
- [ ] **Teste automático de chaves:** rodar `testConnection` em todas as chaves salvas com um único botão, marcando cada provider com ✓/✗ e motivo (401/429/timeout/saldo).
- [ ] **Analytics local (privado):** contagem de uso (mensagens, tokens estimados, deploys, projetos) em `metadata`, exibida no dashboard sem telemetria externa.
- [ ] **Notificações push:** deploy concluído e resposta longa do agente (Web Push via service worker; opt-in no Settings).
- [ ] **Testes:** `auth-views.test.js` (health/total test) + `notify.test.js` (toast de push simulado).

**Critérios de Aceite:** diagnóstico mostra estado real de cada serviço; testar todas as chaves não bloqueia a UI; analytics só local; push respeita opt-in e safe-area.

### S53 — Segurança & Infra (MFA, backup cifrado, Node 22, CI) 🟠 ALTO

**Cobre:** `functions/` (Node 22) · `auth-service.js` · `security-service.js` · `project-service.js` · `.github/workflows`.

- [ ] **MFA & recuperação:** suporte a 2FA no login (TOTP do Firebase Auth) + código de recuperação; mensagens claras de token expirado (reuso S20).
- [ ] **Backup criptografado:** exportar `.zip` de projeto **cifrado com senha** (Web Crypto AES-GCM) — importar pede a senha (nunca armazena).
- [ ] **Upgrade das Functions para Node 22:** runtime + `firebase-functions` v7 (Node 20 decomissiona em 2026-10-30); redeploy + testes das proxies (`gitCorsProxy`, `githubDeployProxy`).
- [ ] **CI de testes:** `.github/workflows/test.yml` rodando `npm test` + `npm run build` a cada push; badge no README.
- [ ] **Auditoria final:** CVE scan de dependências, checklist S18 (CSP sem eval, DOMPurify em todos os renderers, ARIA), revisão das rules do Firestore (2 contas).
- [ ] **Testes:** `security-service.test.js` (backup cifrado round-trip, senha errada falha) + CI verde no repo.

**Critérios de Aceite:** 2FA e backup cifrado funcionam em device real; Functions em Node 22 sem erros; CI roda testes+build; auditoria sem falhas críticas.

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
- **S13–S19 (Homologação) seguem a ordem cronológica** de S0→S12, testando os workflows da jornada (J1–J7) — ver `diagrams/journey.md`.
- **S20–S26 (Fase 6 — Correções da Auditoria)** seguem a ordem cronológica da jornada (J1→J7) e podem rodar em paralelo às pendências de device real da Fase 5. Dependências: S20 (auth) e S21 (APIs) são pré-requisitos de S22 (geração real); S24 depende de S22/S23 (deploy usa geração+diff); S25 depende de S24 (deploy/offline); S26 é independente (segurança/viewer).
- **S27–S30 (Fase 7 — Retrofit 16-bit)** seguem a ordem cronológica após S26 e dependem do `docs/layout.md` (design aprovado). Ordem interna: S27 (fundação/fontes/tokens) → S28 (componentes core) → S29 (interações/VFX) → S30 (polish/bundle/device). São **puramente visuais** — não dependem das correções de negócio (S20–S26) nem bloqueiam o Go Live; podem rodar em paralelo às pendências de device real da Fase 5.
- **S31–S35 (Fase 8 — Correções da Auditoria do Chat)** seguem a **ordem de impacto no usuário** (leitura → intenção → memória → robustez). Dependências: **S31** (chat legível) é pré-requisito de **S32–S34** (a resposta textual/gate só faz sentido se o bubble renderiza `message`); **S33** depende de **S31** (histórico exibido de forma legível); **S34** depende de **S33** (intenção "ver o site" exige saber o que já existe no VFS); **S35** é independente (robustez do demo/system prompt) e pode rodar em paralelo. Nenhuma depende das Fases 6/7 — pode começar imediatamente.
- **S36 (Gestor de projetos) depende de S1** (usa o VFS/Dexie para snapshots e o schema `version(2)`) **e da infra SaaS do auth-gate/dashboard** (lista publicada vem do Firestore). **S36b (toast persistente) depende do deploy/S24** (o toast de sucesso só faz sentido com o fluxo de publicação) **e do S36** (mensagem "salvo no dashboard"). Ambas são pós-Fase 8 e não bloqueiam o Go Live em device real.
- **Fase 9 (S37–S53)** segue a **ordem cronológica de construção**: S37 (ícones) e S38 (busca) são polimento de UX imediato; S39 (editor) depende do S4 e do S38 (busca no editor); S40/S41 (templates/dashboard/import-export/lixeira) dependem do S36 (project-service) e do S24 (export ZIP); S42 (autonomia/planos/undo) depende do S6/S7 (agent-manager) e do S23 (diff/conflito); S43 (drivers/multi-agente) depende do S6; S44 (multimodal/TTS) depende do S7 e do S3.5 (viewer/anexos); S45 (memória/RAG) depende do S33 (memória conversacional) e do S36 (snapshots por projeto); S46 (git avançado) depende do S2 (git offline) e do S5 (diff); S47 (deploy contínuo/CI) depende do S24 (deploy) e do S46; S48 (preview de apps/terminal) depende do S3.5 (viewer/sandbox) e do S10 (CSP sem eval); S49 (cloud sync) depende do S36 e do S25 (offline); S50 (colaboração) depende do S49 (multi-device); S51 (onboarding/i18n) e S52 (diagnóstico/push) são transversais (podem rodar em paralelo às demais); S53 (segurança/infra) é a última (upgrade Node 22 + CI + auditoria) e depende das pendências da Fase 5. **Nenhuma Fase 9 bloqueia o Go Live** — são roadmap pós-lançamento.

---

## Estratégia de Testes

| Camada        | Ferramenta | Escopo                                                                 | Status (16/08) |
| ------------- | ---------- | ---------------------------------------------------------------------- | -------------- |
| **Unitários** | Vitest     | Drivers (parsing), VFS (CRUD/path), git-service (comandos), security.  | ✅ 212 verdes (18/08) |
| **Integração**| Vitest + jsdom | VFS ↔ Git, Drivers ↔ Tool Executor, diff ↔ aceitar/rejeitar, explorer, viewer XSS, failover/Settings, streaming/thinking/abort/contexto, **gate chitchat/memória/overwrite/demo (S32/S33/S35)**, **chat-renderer (S31/S34)**, **gestor de projetos (S36: project-service + dashboard)**, **notify toast persistente (S36b)**, **ícones por extensão (S37: file-tree)**, **busca fuzzy + find/replace (S38: search-panel)**, **snippets + prefs do editor (S39: editor-prefs/snippets/editor)**, **templates/duplicar/pin/tags do dashboard (S40)**, **zip round-trip + lixeira (S41: project-service)**, **autonomia ask/review/auto + planos + undo (S42: agent-manager)**. | ✅ 212 verdes |
| **E2E**       | Playwright | 3 fluxos principais: chat→tools, file CRUD, git workflow completo.     | ⏳ planejado   |
| **Mobile**    | Testes manuais | iPhones reais (Safari), modo avião, safe-areas, teclado flutuante. | ⏳ device real |

> Os fluxos documentados em `diagrams/workflows.md` (ciclo do agente, navegação, preview, git, layout) têm cobertura automatizada apontada em cada diagrama (ver também a matriz em `diagrams/journey.md`).

> **Regra:** cada sprint entrega seus testes junto do código. Sprint só é "done" com testes verdes.

---

## Estrutura de Pastas Alvo

```text
src/
├── css/
│   └── main.css                 # Design tokens + overrides F7 + layout IDE (S4.5) + 16-bit (Fase 7)
├── js/
│   ├── app.js                   # Bootstrap + layout controller + wiring IDE/deploy/chat + PWA update
│   ├── core/
│   │   ├── vfs-service.js       # VFS sobre Dexie (S1) — CRUD, path protection, data URLs, mime map; v3 (S36/S40/S41): projects (pinned/tags) + project_files + trashed
│   │   ├── project-service.js   # Gestor de projetos locais (S36/S40/S41) — snapshots, templates, duplicar, pin/tags, zip export/import, lixeira
│   │   ├── editor-prefs.js      # Prefs do editor: tema/fonte/snippets em metadata (S39)
│   │   ├── snippets.js          # Snippets de código por linguagem + findSnippet (S39)
│   │   └── event-emitter.js     # Pub/Sub de estado (S1)
│   ├── agents/
│   │   ├── agent-manager.js     # Orquestrador de agentes: gate chitchat, memória, demo, failover + autonomia ask/review/auto, planos e undo (S6–S8/S32–S35/S42)
│   │   ├── tool-executor.js     # Executor de tools sandboxed (path traversal)
│   │   └── drivers/             # Drivers JSON/XML + streaming + truncamento
│   ├── auth/
│   │   └── auth-service.js      # Firebase Auth: login/cadastro/senha/email/verificação (S20)
│   ├── db/
│   │   └── db-service.js        # Firestore: perfil, llm_keys, projetos publicados (S13–S23)
│   ├── firebase/
│   │   └── firebase-config.js   # Init Firebase + URLs das Functions
│   ├── git/
│   │   ├── git-service.js       # is isomorphic-git + VFS adapter (S2)
│   │   └── vfs-fs.js            # Adapter lightning-fs para o VFS
│   ├── security/
│   │   └── security-service.js  # AES-GCM: PATs (master key) + chave determinística por UID (llm_keys)
│   └── ui/
│       ├── notify.js            # Mini-UI de sistema: toast (duration:0 persistente), dialog, actions (S10/S36b)
│       ├── file-icons.js        # Ícones por tipo de arquivo no explorer (S37)
│       ├── search-panel.js      # Busca fuzzy + find/replace global (S38)
│       ├── file-tree.js         # Explorer: árvore recursiva (S3)
│       ├── editor.js            # CodeMirror 6: tabs, autosave, linguagens (S4)
│       ├── viewer.js            # Visualizador de arquivos (S3.5/S18 — sanitização XSS)
│       ├── diff-viewer.js       # Diff por blocos aceitar/rejeitar (S5/S23)
│       ├── chat-renderer.js     # Bubble legível + chips + intenção "ver o site" (S31/S34)
│       ├── auth-views.js        # Telas auth/dashboard/settings — gestor de projetos (S36)
│       └── git-panel.js         # Painel Git (init/stage/commit/ZIP/deploy)
├── test/
│   └── setup.js                 # fake-indexeddb + resetIndexedDB()
docs/
└── diagrams/
    ├── workflows.md             # Workflows de usuário em Mermaid (15/08)
    └── journey.md               # Jornada do cliente (J1–J7) + matriz de homologação (15/08)
public/
└── assets/                      # copiado de assets/ via scripts/copy-assets.mjs (predev/prebuild)
```

> **Testes unitários/JSdom:** cada módulo tem seu `*.test.js` ao lado (ex.: `vfs-service.test.js`, `project-service.test.js`, `auth-views.test.js`, `chat-renderer.test.js`, `notify.test.js`) — regra global "testes junto do código".

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