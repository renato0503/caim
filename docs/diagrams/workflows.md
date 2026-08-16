# CAIM — Workflows de Usuário (Mermaid)

> Diagramas dos fluxos de usuário do CAIM. Nomes reais de funções/componentes do código.
> Legenda: ✅ implementado · S4.5 = layout aprovado · S2 = planejado.

---

## 1. Ciclo do Agente — prompt → arquivo → editor

**Explicação técnica:** o usuário digita o prompt no chat (`#chat-input`) e `app.js:sendMessage` exibe a mensagem, dispara `streamDemoResponse` e chama `agentCreatesFile`, que gera `src/<slug>-N.md` e grava via `vfs.createFile`. O `EventEmitter` emite `vfs:changed` (tipo `create`), e o `CodeEditor.openFile(path, { force: true })` abre a nova aba automaticamente. Com a S4.5, o chat vive no **bottom sheet** e o editor permanece visível — o ciclo inteiro acontece sem troca de tela.

```mermaid
flowchart TD
    %% Ciclo central: o prompt gera um arquivo que aparece no editor
    U[Usuário digita o prompt no Chat] -->|bottom sheet expandido| S[app.js: sendMessage]
    S --> M[addMessage user + received]
    M --> R[streamDemoResponse]
    R -->|streama intro| C[agentCreatesFile]
    C -->|slugify prompt → src/&lt;slug&gt;-N.md| V[vfs.createFile]

    subgraph VFS ["VFS (Dexie)"]
        V --> DB[(IndexedDB: files)]
        DB --> E[EventEmitter: vfs:changed create]
    end

    E --> ED[CodeEditor.openFile force]

    subgraph Editor ["Editor (CodeMirror 6)"]
        ED --> TABS[Aba nova no topo do workspace]
        TABS --> L[languageFor → extensão]
    end

    L --> D{Usuário satisfeito?}
    D -- Não -->|edita e autosave 800ms| D2[markDirty → scheduleSave → vfs.writeFile]
    D2 --> TABS
    D -- Sim --> G[Diff/Commit — S5/S2 ]
```

---

## 2. Navegação de Arquivos — Explorer drawer

**Explicação técnica:** toque em 📁 no **Activity Bar** abre o `explorer-drawer` (classe `.open`, `translateX(-100%) → 0`) com backdrop. Dentro, `FileTree.render` monta a árvore recursiva via `vfs.listDir`. Pasta = `collapsed` Set (expandir/recolher); arquivo = `onOpenFile` (abre no editor e recolhe o sheet); botão 👁 = `onPreviewFile` (abre o viewer no pane `preview`). * Layout S4.5.*

```mermaid
flowchart TD
    %% Navegação via activity bar + drawer
    T[Toque no ícone 📁 do Activity Bar] --> DRA[explorer-drawer.classList.open]
    DRA --> BK[drawer-backdrop.show]
    DRA --> R[FileTree.render]

    subgraph Tree ["FileTree — buildLevel recursivo"]
        R --> DIR[vfs.listDir]
        DIR --> PASTA{Pasta ou arquivo?}
        PASTA -- Pasta --> COL[collapsed toggle → expandDir/remove children]
        PASTA -- Arquivo --> OP[onOpenFile → CodeEditor.openFile]
        PASTA -- Botão 👁 do arquivo --> PV[onPreviewFile → FileViewer.openFile]
    end

    OP --> COL2[collapseSheet → foco no editor]
    PV --> SHOW[showPane preview → expandSheet]

    COL2 --> ED2[Editor ativo no workspace]
    SHOW --> PV2[Preview renderizado no bottom sheet]
```

---

## 3. Pré-visualização de Arquivos — roteador de formatos

**Explicação técnica:** `FileViewer.openFile` lê `vfs.readFile` (conteúdo + mimeType) e delega para o renderer da extensão. Textos/Markdown renderizam direto; binários (imagem, PDF, DOCX, XLSX, PPTX) via **data URL** → `dataUrlToBlob`. DOCX/XLSX/PPTX usam **lazy-load** (`import('mammoth'/'xlsx'/'jszip')`) — só baixam quando esse formato é aberto.

```mermaid
flowchart TD
    %% Roteamento do viewer por tipo de arquivo
    P[FileViewer.openFile] --> R[vfs.readFile path]
    R --> EXT{Extensão / mimeType}

    EXT -- .md / text/markdown --> MD[renderMarkdown]
    MD --> M1[marked.parse → DOMPurify.sanitize]

    EXT -- image/* --> IMG[renderImage img.src=dataURL]

    EXT -- .html/.htm --> HTML[renderHtml iframe sandbox allow-scripts]

    EXT -- .pdf --> PDF[renderPdf dataUrlToBlob → iframe blob]

    EXT -- .csv --> CSV[parseCsvLine → tabela HTML]

    EXT -- .docx --> DOCX[renderDocx lazy import mammoth → HTML]
    EXT -- .xlsx/.xls --> XLSX[renderXlsx lazy import xlsx sheet_to_html]
    EXT -- .pptx --> PPTX[renderPptx lazy import jszip → texto dos slides]

    EXT -- text/* --> TXT[renderText pre]
    EXT -- outros --> UN[renderUnsupported + download]

    M1 --> OUT[container #viewer-content no pane preview]
    IMG --> OUT
    HTML --> OUT
    PDF --> OUT
    CSV --> OUT
    DOCX --> OUT
    XLSX --> OUT
    PPTX --> OUT
    TXT --> OUT
    UN --> OUT
```

---

## 4. Sequência — chat → VFS → editor (fluxo temporal)

**Explicação técnica:** visão cronológica do ciclo do agente. O streaming (demo) roda no chat do bottom sheet enquanto o arquivo é criado no VFS e aberto no editor — com a S4.5, **nenhuma dessas etapas troca de tela**.

```mermaid
sequenceDiagram
    participant U as Usuário (iOS)
    participant C as Chat UI (bottom sheet)
    participant A as Agent demo (app.js)
    participant V as VFS (Dexie)
    participant E as CodeMirror Editor

    U->>C: digita prompt + envia
    C->>A: sendMessage(text)
    A-->>C: streamDemoResponse (intro)
    A->>V: createFile('src/<slug>-N.md', content)
    V-->>A: ok
    V-->>E: evento vfs:changed (create)
    E->>E: openFile(path, {force:true})
    E-->>U: nova aba + conteúdo visível
    A-->>C: "Arquivo criado em src/…"
    C-->>U: confirmação no chat
```

---

## 5. Git (futuro — S2) 

**Explicação técnica:** fluxo planejado no pane `git` do bottom sheet. `git-service.js` (isomorphic-git + lightning-fs) roda `init/add/commit/log` offline; `push` decriptografa o PAT (Web Crypto) apenas na hora da rede via proxy CORS.

```mermaid
flowchart LR
    %% Workflow git planejado (S2)
    G[Toque em Git no bottom sheet] --> S[git-service.status]
    S --> A1[git add arquivos]
    A1 --> CM[git commit]
    CM --> LG[git log]

    CM --> PS{Precisa publicar?}
    PS -- Sim --> PUSH[git push]
    PUSH --> TK[SecurityService: decripta PAT AES-GCM]
    PUSH --> CORS[Proxy CORS → GitHub API]
    PS -- Não --> F[Fim — tudo offline]
```

---

## 6. Layout IDE — estados da tela (S4.5) 

**Explicação técnica:** a tela nunca "troca de página". Activity Bar alterna entre drawer (Explorer) e panes do bottom sheet (Chat/Diff/Preview/Git); o editor central permanece montado o tempo todo. Altura do sheet: `48px` recolhido ↔ `80% do visualViewport` expandido.

```mermaid
stateDiagram-v2
    [*] --> Colapsado: App inicia

    Colapsado --> Explorer: 📁 activity bar
    Colapsado --> Chat: 💬 activity bar
    Explorer --> Colapsado: backdrop / ☰
    Chat --> Colapsado: toque no editor
    Colapsado --> Preview: 👁 em arquivo
    Preview --> Colapsado: toque no editor

    state Chat {
        [*] --> ChatAberto: showPane('chat')
        ChatAberto --> ChatDigitando: foca #chat-input (visualViewport)
        ChatDigitando --> ChatAberto: teclado fecha
    }
    Chat --> Diff: aba Diff (S5)
    Diff --> Git: aba Git (S2)
```

---

> **Exportação:** diagramas renderizáveis nativamente no GitHub e no VS Code (bloco ` ```mermaid `). Revisar em: `https://mermaid.live/`.
