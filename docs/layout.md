
# CAIM — Arquitetura de Layout 16-bit (Pixel Art)

> Documento mestre de design system e arquitetura visual do CAIM. Define a estética **16-bit retrô gamificada** mantendo a paleta de cores atual (#0f172a Dark Slate + #2dd4bf Teal/Cyan) e toda a arquitetura de layout IDE (S4.5).
> **Última atualização:** 2026-08-16
> **Status:** Aprovado para implementação na **Sprint S20 (Retrofit 16-bit)**

---

## 1. Filosofia de Design

O CAIM adota uma estética **"Retro-Futurismo 16-bit"**: a precisão técnica de uma IDE moderna vestida com a alma dos consoles SNES/Genesis dos anos 90. Cada interação deve parecer uma conquista de videogame (conquistas desbloqueadas, barras de XP, diálogos estilo RPG, VFX de partículas pixeladas).

### 1.1 Princípios

- **Pixel Perfeito:** cada elemento visual respeita a grade de pixels (múltiplos de 4px). Nada de anti-aliasing em ícones pixel art.
- **Animações Diegéticas:** cada feedback de UI conta uma história (salvar = som de moeda, erro = hit de boss, deploy = foguete pixelado).
- **Hierarquia por Contraste:** elementos importantes pulsam, secundários ficam em tons pastéis do tema.
- **Performance First:** todas as animações usam `transform` e `opacity` — zero layout thrashing.

---

## 2. Paleta de Cores 16-bit

### 2.1 Cores Primárias (Base CAIM)

A paleta mantém a identidade atual, expandida com variações 16-bit:

```css
:root {
  /* === CORE CAIM (mantidas) === */
  --bg-primary: #0f172a;        /* Dark Slate - background principal */
  --bg-secondary: #1e293b;      /* Slate 800 - painéis/cards */
  --bg-tertiary: #334155;       /* Slate 700 - headers/bordas */
  --accent: #2dd4bf;            /* Teal/Cyan - acentos e ações */
  --accent-dark: #14b8a6;       /* Teal 500 - hover/press */
  --text-primary: #f1f5f9;      /* Slate 100 - texto principal */
  --text-secondary: #94a3b8;    /* Slate 400 - texto secundário */
  
  /* === EXTENSÕES 16-BIT === */
  --pixel-success: #4ade80;     /* Verde "ganhou vida" */
  --pixel-warning: #fbbf24;     /* Amarelo "cuidado, HP baixo" */
  --pixel-danger: #f87171;      /* Vermelho "tomou dano" */
  --pixel-info: #60a5fa;        /* Azul "item mágico" */
  --pixel-purple: #c084fc;      /* Roxo "raridade épica" */
  --pixel-gold: #fde047;        /* Dourado "conquista desbloqueada" */
  
  /* === NEUTROS PIXEL === */
  --pixel-border: #475569;      /* Bordas pixel art */
  --pixel-shadow: #020617;      /* Sombra dura (sem blur) */
  --pixel-grid: rgba(45, 212, 191, 0.05); /* Grid de fundo */
}
```

### 2.2 Paleta Extendida (Inspiração SNES/Genesis)

Baseada em paletas de consoles 16-bit clássicos [[80]], [[85]]:

| Nome                     | Hex         | Uso                                |
| ------------------------ | ----------- | ---------------------------------- |
| **Midnight Slate** | `#0f172a` | Fundo principal (espaço cósmico) |
| **Cyber Teal**     | `#2dd4bf` | Ação primária, magia, mana      |
| **Neon Pink**      | `#ec4899` | Erro crítico, boss fight          |
| **Solar Gold**     | `#fde047` | Conquistas, XP ganho, sucesso      |
| **Forest Green**   | `#22c55e` | HP, progresso positivo             |
| **Lava Orange**    | `#fb923c` | Aviso, deploy em andamento         |
| **Mystic Purple**  | `#a855f7` | Itens raros, features premium      |
| **Ice Blue**       | `#38bdf8` | Informação, links, foco          |

### 2.3 Regras de Aplicação

- **Fundo:** Sempre `--bg-primary` com grid pixel sutil (`background-image: linear-gradient` em múltiplos de 8px).
- **Cards/Painéis:** `--bg-secondary` com borda pixel de 2px em `--pixel-border`.
- **Botões Primários:** Fundo `--accent`, texto `--bg-primary`, borda interna de 1px clara (highlight pixel).
- **Estados de Hover:** Aumentar brilho em 15% (`filter: brightness(1.15)`), nunca mudar de cor.
- **Estados de Press:** Shift de 2px para baixo (`transform: translateY(2px)`), sombra some (feedback tátil).

---

## 3. Tipografia 16-bit

### 3.1 Stack de Fontes

```css
:root {
  /* Display (títulos, conquistas, botões) */
  --font-display: 'Press Start 2P', 'VT323', monospace;
  
  /* Código (editor, diffs, logs) */
  --font-code: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  
  /* Corpo (chat, tooltips, pequenos textos) */
  --font-body: 'VT323', 'Silkscreen', 'Courier New', monospace;
  
  /* Pixel UI (labels, menus) */
  --font-pixel: 'Silkscreen', 'Dogica', 'Press Start 2P', monospace;
}
```

### 3.2 Hierarquia Tipográfica

| Uso                         | Fonte          | Tamanho | Letter-spacing | Exemplo                     |
| --------------------------- | -------------- | ------- | -------------- | --------------------------- |
| **H1 — Conquistas**  | Press Start 2P | 24px    | 0.05em         | "🏆 NOVO MVP DESBLOQUEADO!" |
| **H2 — Títulos**    | Press Start 2P | 16px    | 0.05em         | "Configurações"           |
| **H3 — Subtítulos** | VT323          | 18px    | 0              | "APIs de LLM"               |
| **Body — Chat**      | VT323          | 16px    | 0              | "Crie um MVP de landing..." |
| **Label — Botões**  | Silkscreen     | 12px    | 0.1em          | "[ DEPLOY ]"                |
| **Code — Editor**    | JetBrains Mono | 14px    | -0.02em        | `const x = 42;`           |
| **Micro — Status**   | Press Start 2P | 8px     | 0.1em          | "LV.42 · 1337 XP"          |

### 3.3 Regras de Uso

- **Press Start 2P** apenas em tamanhos múltiplos de 8px (8, 16, 24, 32) para preservar a integridade do bitmap [[44]].
- **VT323** para textos longos (chat, diálogos) — é pixelada mas legível em tamanhos pequenos.
- **Silkscreen** para labels de botões e menus — ultra compacta e nítida.
- **JetBrains Mono** apenas no CodeMirror (preserva a legibilidade de código real).

### 3.4 Carregamento Otimizado

```html
<!-- No index.html — fora do caminho crítico -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Silkscreen&display=swap" rel="stylesheet">
```

**Fallback:** Enquanto as fontes carregam, usar `system-ui` sem flicker.

---

## 4. Arquitetura de Componentes 16-bit

### 4.1 Princípios de Construção

Todos os componentes seguem a técnica de **"pixel border" via box-shadow** (sem imagens PNG) [[61]], [[72]]:

```css
.pixel-border {
  --border-size: 2px;
  --border-color: var(--pixel-border);
  --shadow-color: var(--pixel-shadow);
  
  box-shadow:
    /* Border interno (highlight) */
    inset calc(var(--border-size) * -1) calc(var(--border-size) * -1) 0 0 rgba(255,255,255,0.1),
    /* Border externo */
    inset var(--border-size) var(--border-size) 0 0 var(--border-color),
    /* Sombra dura (sem blur) */
    0 4px 0 0 var(--shadow-color);
  
  image-rendering: pixelated; /* Mantém pixels nítidos */
}
```

### 4.2 Activity Bar (16-bit Edition)

O Activity Bar lateral (48px) ganha aparência de **menu de RPG**:

```css
.activity-bar {
  width: 48px;
  background: var(--bg-secondary);
  border-right: 2px solid var(--pixel-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
}

.activity-btn {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  background: var(--bg-tertiary);
  border: none;
  position: relative;
  image-rendering: pixelated;
  transition: transform 0.1s;
  cursor: pointer;
  
  /* Pixel border via box-shadow */
  box-shadow:
    inset -2px -2px 0 0 rgba(0,0,0,0.5),
    inset 2px 2px 0 0 rgba(255,255,255,0.1);
}

.activity-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.2);
}

.activity-btn:active {
  transform: translateY(2px);
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.5);
}

.activity-btn.active {
  background: var(--accent);
  animation: pulse-pixel 1.5s infinite;
}

@keyframes pulse-pixel {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}

/* Ícones pixel art via SVG inline (não PNG!) */
.activity-btn svg {
  width: 24px;
  height: 24px;
  shape-rendering: crispEdges; /* SVGs pixel-perfect */
}
```

### 4.3 Bottom Sheet (Dialog Box RPG)

O Bottom Sheet vira uma **"caixa de diálogo de RPG clássica"**:

```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 44px; /* recolhido */
  background: var(--bg-secondary);
  border-top: 4px solid var(--accent);
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-sheet.expanded {
  height: 80vh;
  max-height: calc(100vh - 100px);
}

/* Handle arrastável estilo "puxador de menu RPG" */
.sheet-handle {
  width: 48px;
  height: 8px;
  background: var(--accent);
  margin: 8px auto;
  position: relative;
}

.sheet-handle::before,
.sheet-handle::after {
  content: '';
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--accent);
  top: 50%;
  transform: translateY(-50%);
}

.sheet-handle::before { left: -16px; }
.sheet-handle::after { right: -16px; }

/* Tabs do sheet (Chat/Diff/Preview/Git) */
.sheet-tabs {
  display: flex;
  border-bottom: 2px solid var(--pixel-border);
  background: var(--bg-tertiary);
}

.sheet-tab {
  flex: 1;
  padding: 8px 4px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font-pixel);
  font-size: 11px;
  border: none;
  border-bottom: 3px solid transparent;
  cursor: pointer;
  text-transform: uppercase;
}

.sheet-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  background: var(--bg-secondary);
}

/* Conteúdo do sheet com "scroll pixelado" */
.sheet-pane {
  overflow-y: auto;
  padding: 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--accent) var(--bg-tertiary);
}

.sheet-pane::-webkit-scrollbar {
  width: 8px;
}

.sheet-pane::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-left: 2px solid var(--pixel-border);
}

.sheet-pane::-webkit-scrollbar-thumb {
  background: var(--accent);
  border: 1px solid var(--pixel-border);
}
```

### 4.4 Editor Central (IDE Pixel)

O CodeMirror 6 ganha tema customizado 16-bit:

```css
/* Tema CAIM 16-bit para CodeMirror */
.cm-editor {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-code);
  font-size: 14px;
  border-left: 2px solid var(--pixel-border);
}

.cm-gutters {
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-right: 2px solid var(--pixel-border);
  font-family: var(--font-pixel);
  font-size: 10px;
}

.cm-activeLine {
  background: rgba(45, 212, 191, 0.1);
}

.cm-selectionBackground {
  background: rgba(45, 212, 191, 0.3) !important;
}

/* Syntax highlighting 16-bit */
.tok-keyword { color: #c084fc; } /* Roxo mágico */
.tok-string { color: #4ade80; }  /* Verde poção */
.tok-number { color: #fbbf24; }  /* Amarelo ouro */
.tok-comment { color: #94a3b8; font-style: italic; }
.tok-function { color: #60a5fa; } /* Azul gelo */
.tok-variableName { color: #f1f5f9; }
.tok-typeName { color: #fb923c; } /* Laranja lava */

/* Tabs do editor */
.editor-tabs {
  display: flex;
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--pixel-border);
  overflow-x: auto;
  scrollbar-width: none;
}

.editor-tab {
  padding: 6px 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border-right: 2px solid var(--pixel-border);
  font-family: var(--font-pixel);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.editor-tab.active {
  background: var(--bg-primary);
  color: var(--accent);
  border-bottom: 2px solid var(--accent);
  margin-bottom: -2px;
}

.editor-tab.dirty::after {
  content: '●';
  color: var(--pixel-warning);
  font-size: 14px;
}
```

### 4.5 Explorer Drawer (Inventário RPG)

O Explorer vira um **"inventário de herói"**:

```css
.explorer-drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 78vw;
  max-width: 320px;
  background: var(--bg-secondary);
  border-right: 4px solid var(--accent);
  transform: translateX(-100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.explorer-drawer.open {
  transform: translateX(0);
}

.drawer-header {
  padding: 16px;
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--pixel-border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.drawer-title {
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--accent);
  flex: 1;
}

/* Árvore de arquivos */
.file-tree {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-family: var(--font-pixel);
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: 0;
}

.tree-item:hover {
  background: var(--bg-tertiary);
}

.tree-item.folder::before {
  content: '▶';
  color: var(--accent);
  font-size: 10px;
}

.tree-item.folder.open::before {
  content: '▼';
}

.tree-item.file::before {
  content: '◆';
  color: var(--pixel-gold);
  font-size: 10px;
}

/* Botão de preview (olho) */
.tree-preview-btn {
  opacity: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 4px;
  font-family: var(--font-pixel);
}

.tree-item:hover .tree-preview-btn {
  opacity: 1;
}

.tree-preview-btn:hover {
  color: var(--accent);
}
```

### 4.6 Botões 16-bit

Botões com aparência de **botões de console SNES**:

```css
.pixel-btn {
  font-family: var(--font-pixel);
  font-size: 12px;
  padding: 8px 16px;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  position: relative;
  transition: transform 0.05s;
  image-rendering: pixelated;
  
  /* Pixel border 3D */
  box-shadow:
    inset -2px -2px 0 0 rgba(0,0,0,0.4),
    inset 2px 2px 0 0 rgba(255,255,255,0.2),
    0 4px 0 0 var(--pixel-shadow);
}

.pixel-btn:active {
  transform: translateY(4px);
  box-shadow:
    inset 2px 2px 0 0 rgba(0,0,0,0.4),
    inset -2px -2px 0 0 rgba(255,255,255,0.2);
}

/* Variantes */
.pixel-btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
}

.pixel-btn-danger {
  background: var(--pixel-danger);
  color: var(--text-primary);
}

.pixel-btn-success {
  background: var(--pixel-success);
  color: var(--bg-primary);
}

.pixel-btn-ghost {
  background: transparent;
  color: var(--text-primary);
  border: 2px solid var(--pixel-border);
  box-shadow: none;
}

.pixel-btn-ghost:hover {
  background: var(--bg-tertiary);
}

/* Botão especial de Deploy (foguete) */
.pixel-btn-deploy {
  background: linear-gradient(135deg, var(--accent), var(--pixel-purple));
  color: var(--bg-primary);
  animation: glow-pulse 2s infinite;
}

@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px rgba(45, 212, 191, 0.4); }
  50% { box-shadow: 0 0 16px rgba(45, 212, 191, 0.8); }
}
```

### 4.7 Toasts e Notificações (Conquistas)

Toasts viram **"conquistas desbloqueadas"** estilo Xbox/Steam:

```css
.pixel-toast {
  position: fixed;
  top: 80px;
  right: 16px;
  background: var(--bg-secondary);
  border: 3px solid var(--pixel-gold);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  animation: toast-entrance 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 9999;
  max-width: 300px;
  
  box-shadow:
    inset -2px -2px 0 0 rgba(0,0,0,0.3),
    inset 2px 2px 0 0 rgba(255,255,255,0.1),
    0 8px 0 0 var(--pixel-shadow);
}

@keyframes toast-entrance {
  0% {
    transform: translateX(400px) rotate(5deg);
    opacity: 0;
  }
  60% {
    transform: translateX(-10px) rotate(-2deg);
  }
  100% {
    transform: translateX(0) rotate(0);
    opacity: 1;
  }
}

.pixel-toast-title {
  font-family: var(--font-display);
  font-size: 10px;
  color: var(--pixel-gold);
  margin-bottom: 4px;
}

.pixel-toast-message {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text-primary);
}

/* Variantes */
.pixel-toast-success { border-color: var(--pixel-success); }
.pixel-toast-success .pixel-toast-title { color: var(--pixel-success); }

.pixel-toast-error { border-color: var(--pixel-danger); }
.pixel-toast-error .pixel-toast-title { color: var(--pixel-danger); }
```

### 4.8 Diff Viewer (Tela de Batalha)

O Diff Viewer ganha aparência de **"tela de batalha RPG"**:

```css
.diff-block {
  margin: 8px 0;
  border: 2px solid var(--pixel-border);
  background: var(--bg-primary);
}

.diff-header {
  background: var(--bg-tertiary);
  padding: 6px 12px;
  font-family: var(--font-pixel);
  font-size: 11px;
  color: var(--text-primary);
  border-bottom: 2px solid var(--pixel-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.diff-line {
  padding: 2px 12px;
  font-family: var(--font-code);
  font-size: 13px;
  border-left: 4px solid transparent;
}

.diff-line.added {
  background: rgba(74, 222, 128, 0.15);
  border-left-color: var(--pixel-success);
  color: var(--pixel-success);
}

.diff-line.removed {
  background: rgba(248, 113, 113, 0.15);
  border-left-color: var(--pixel-danger);
  color: var(--pixel-danger);
  text-decoration: line-through;
}

.diff-line.unchanged {
  color: var(--text-secondary);
}

/* Botões de Aceitar/Rejeitar */
.diff-actions {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border-top: 2px solid var(--pixel-border);
}

.diff-accept {
  flex: 1;
  background: var(--pixel-success);
  color: var(--bg-primary);
}

.diff-reject {
  flex: 1;
  background: var(--pixel-danger);
  color: var(--text-primary);
}
```

### 4.9 Chat UI (Terminal de RPG)

O chat ganha aparência de **"terminal de RPG com typing animation"**:

```css
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.chat-message {
  margin-bottom: 12px;
  animation: message-appear 0.3s ease-out;
}

@keyframes message-appear {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chat-message.user {
  text-align: right;
}

.chat-message.user .chat-bubble {
  background: var(--accent);
  color: var(--bg-primary);
  margin-left: auto;
  max-width: 80%;
}

.chat-message.ai .chat-bubble {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  max-width: 85%;
}

.chat-bubble {
  display: inline-block;
  padding: 8px 12px;
  border: 2px solid var(--pixel-border);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.4;
  text-align: left;
  
  box-shadow:
    inset -2px -2px 0 0 rgba(0,0,0,0.2),
    inset 2px 2px 0 0 rgba(255,255,255,0.1);
}

/* Thinking indicator (estilo "loading...") */
.chat-thinking {
  display: inline-flex;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 2px solid var(--pixel-border);
}

.chat-thinking-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  animation: thinking-bounce 1.4s infinite;
}

.chat-thinking-dot:nth-child(2) { animation-delay: 0.2s; }
.chat-thinking-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes thinking-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* Input do chat */
.chat-input-wrapper {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-top: 2px solid var(--pixel-border);
}

.chat-input {
  flex: 1;
  background: var(--bg-secondary);
  border: 2px solid var(--pixel-border);
  color: var(--text-primary);
  font-family: var(--font-body);
  font-size: 14px;
  padding: 8px 12px;
  outline: none;
}

.chat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.2);
}

.chat-send-btn {
  background: var(--accent);
  color: var(--bg-primary);
  border: none;
  padding: 8px 16px;
  font-family: var(--font-pixel);
  font-size: 12px;
  cursor: pointer;
}
```

### 4.10 Dialogs e Modals (Pergaminhos)

Dialogs viram **"pergaminhos mágicos"**:

```css
.pixel-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(2px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: backdrop-appear 0.2s;
}

@keyframes backdrop-appear {
  from { opacity: 0; }
  to { opacity: 1; }
}

.pixel-modal {
  background: var(--bg-secondary);
  border: 4px solid var(--accent);
  max-width: 320px;
  width: 90%;
  padding: 0;
  animation: modal-appear 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  box-shadow:
    inset -4px -4px 0 0 rgba(0,0,0,0.4),
    inset 4px 4px 0 0 rgba(255,255,255,0.1),
    0 16px 0 0 var(--pixel-shadow);
}

@keyframes modal-appear {
  0% {
    transform: scale(0.8) rotate(-5deg);
    opacity: 0;
  }
  60% {
    transform: scale(1.05) rotate(2deg);
  }
  100% {
    transform: scale(1) rotate(0);
    opacity: 1;
  }
}

.pixel-modal-header {
  background: var(--accent);
  color: var(--bg-primary);
  padding: 12px 16px;
  font-family: var(--font-display);
  font-size: 12px;
  text-align: center;
  text-transform: uppercase;
}

.pixel-modal-body {
  padding: 16px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.5;
}

.pixel-modal-footer {
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  border-top: 2px solid var(--pixel-border);
}

.pixel-modal-footer .pixel-btn {
  flex: 1;
}
```

### 4.11 Viewer (Visualizador de Arquivos)

O Viewer ganha moldura de **"quadro de artefato"**:

```css
.viewer-pane {
  background: var(--bg-primary);
  padding: 16px;
  overflow: auto;
}

.viewer-frame {
  background: var(--bg-secondary);
  border: 4px solid var(--pixel-border);
  padding: 16px;
  min-height: 200px;
  
  box-shadow:
    inset -4px -4px 0 0 rgba(0,0,0,0.3),
    inset 4px 4px 0 0 rgba(255,255,255,0.1);
}

/* Preview de Markdown */
.viewer-markdown h1,
.viewer-markdown h2,
.viewer-markdown h3 {
  font-family: var(--font-display);
  color: var(--accent);
  margin-top: 16px;
  margin-bottom: 8px;
}

.viewer-markdown h1 { font-size: 16px; }
.viewer-markdown h2 { font-size: 14px; }
.viewer-markdown h3 { font-size: 12px; }

.viewer-markdown p {
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 8px;
}

.viewer-markdown code {
  background: var(--bg-tertiary);
  color: var(--pixel-warning);
  padding: 2px 6px;
  font-family: var(--font-code);
  font-size: 13px;
  border: 1px solid var(--pixel-border);
}

.viewer-markdown pre {
  background: var(--bg-tertiary);
  border: 2px solid var(--pixel-border);
  padding: 12px;
  overflow-x: auto;
  font-family: var(--font-code);
  font-size: 13px;
}

.viewer-markdown a {
  color: var(--pixel-info);
  text-decoration: underline;
}

/* Preview de imagem */
.viewer-image {
  max-width: 100%;
  image-rendering: pixelated; /* Preserva pixel art */
  border: 2px solid var(--pixel-border);
}

/* Preview de CSV/XLSX (tabelas) */
.viewer-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-pixel);
  font-size: 11px;
}

.viewer-table th,
.viewer-table td {
  border: 2px solid var(--pixel-border);
  padding: 6px 8px;
  text-align: left;
}

.viewer-table th {
  background: var(--bg-tertiary);
  color: var(--accent);
  font-weight: normal;
}

.viewer-table tr:nth-child(even) td {
  background: var(--bg-secondary);
}

.viewer-table tr:hover td {
  background: var(--bg-tertiary);
}
```

---

## 5. Animações e Microinterações 16-bit

### 5.1 VFX de Partículas (Sistema de Recompensa)

Sistema leve de partículas pixeladas para feedback:

```javascript
// particle-system.js — Canvas 2D overlay
export class ParticleSystem {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = `
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9998;
      image-rendering: pixelated;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.body.appendChild(this.canvas);
    this.animate();
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  emit(x, y, type = 'confetti') {
    const count = type === 'confetti' ? 20 : 8;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 1) * 8,
        color: this.randomColor(type),
        life: 60,
        size: 4 + Math.floor(Math.random() * 4),
        gravity: 0.3
      });
    }
  }
  
  randomColor(type) {
    const colors = {
      confetti: ['#fde047', '#ec4899', '#2dd4bf', '#c084fc'],
      success: ['#4ade80', '#2dd4bf'],
      error: ['#f87171', '#fb923c'],
      deploy: ['#fde047', '#fb923c', '#f87171']
    };
    const palette = colors[type] || colors.confetti;
    return palette[Math.floor(Math.random() * palette.length)];
  }
  
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
    this.particles = this.particles.filter(p => p.life > 0);
  
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;
    
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
  
    requestAnimationFrame(() => this.animate());
  }
}

// Uso:
// const particles = new ParticleSystem();
// particles.emit(buttonX, buttonY, 'deploy');
```

### 5.2 Microinterações Específicas

#### 5.2.1 Botão de Deploy (Foguete)

```css
.deploy-btn {
  position: relative;
  overflow: hidden;
}

.deploy-btn:active::after {
  content: '🚀';
  position: absolute;
  right: 8px;
  animation: rocket-launch 1s forwards;
}

@keyframes rocket-launch {
  0% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-100px) scale(1.5);
    opacity: 0;
  }
}
```

#### 5.2.2 Salvar no Editor (Moeda)

```css
.editor-save-flash {
  animation: save-flash 0.5s;
}

@keyframes save-flash {
  0%, 100% { background: transparent; }
  50% { background: rgba(253, 224, 71, 0.3); }
}
```

#### 5.2.3 Streaming do Chat (Typewriter)

```css
.chat-bubble.streaming {
  border-right: 3px solid var(--accent);
  animation: blink-cursor 0.7s infinite;
}

@keyframes blink-cursor {
  0%, 50% { border-right-color: var(--accent); }
  51%, 100% { border-right-color: transparent; }
}
```

#### 5.2.4 Conquista Desbloqueada (Achievement)

```css
.achievement-unlocked {
  animation: achievement-bounce 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes achievement-bounce {
  0% { transform: scale(0) rotate(-180deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(10deg); }
  70% { transform: scale(0.9) rotate(-5deg); }
  100% { transform: scale(1) rotate(0); opacity: 1; }
}
```

#### 5.2.5 Barra de Progresso (XP/Deploy)

```css
.xp-bar {
  height: 12px;
  background: var(--bg-tertiary);
  border: 2px solid var(--pixel-border);
  overflow: hidden;
  position: relative;
}

.xp-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--pixel-gold));
  transition: width 0.5s ease-out;
  position: relative;
}

.xp-bar-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.3) 50%,
    transparent 100%
  );
  animation: shine 2s infinite;
}

@keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

### 5.3 Scanlines e CRT Effect (Opcional)

Efeito de **monitor CRT antigo** (pode ser toggle em Settings):

```css
body.crt-effect::after {
  content: '';
  position: fixed;
  inset: 0;
  background: 
    repeating-linear-gradient(
      0deg,
      rgba(0,0,0,0.15) 0px,
      rgba(0,0,0,0.15) 1px,
      transparent 1px,
      transparent 3px
    );
  pointer-events: none;
  z-index: 9997;
}

body.crt-effect::before {
  content: '';
  position: fixed;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 60%,
    rgba(0,0,0,0.4) 100%
  );
  pointer-events: none;
  z-index: 9996;
}
```

---

## 6. Ícones Pixel Art (SVG Crisp)

Todos os ícones devem ser SVGs com `shape-rendering: crispEdges` e tamanho múltiplo de 8px.

### 6.1 Biblioteca Recomendada

**Pxlkit** (GitHub: joangeldelarosa/pxlkit) [[1]], [[4]]:

- 226+ ícones pixel art organizados em 7 pacotes temáticos
- 111 componentes React (referência visual, não instalar — reimplementar em Vanilla JS)
- Suporta toggle entre estética 8-bit e flat linear
- Pacotes: `@pxlkit/ui`, `@pxlkit/gamification` (51 ícones), `@pxlkit/social` (43 ícones)

### 6.2 Ícones Críticos do CAIM (Redesenho 16-bit)

| Ícone Atual  | Versão 16-bit          | SVG Path                                                                                                                                                                                                                                                                               |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📁 Explorer   | Chest (baú de tesouro) | `<path d="M4 6h16v12H4z M4 6v-2h16v2" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                                             |
| 💬 Chat       | Speech bubble pixelado  | `<path d="M4 4h16v10H8l-4 4v-4z" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                                                  |
| 🔍 Search     | Lupa pixel              | `<circle cx="10" cy="10" r="6" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/> <path d="M14 14l6 6" stroke="currentColor" stroke-width="2" shape-rendering="crispEdges"/>`                                                                         |
| ⚙️ Settings | Engrenagem pixelada     | `<path d="M12 2l2 4h4l-2 4 2 4h-4l-2 4-2-4H6l2-4-2-4h4z" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                          |
| 🚀 Deploy     | Foguete pixelado        | `<path d="M12 2l4 8-4 4-4-4 4-8z M8 14l-2 8h12l-2-8z" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                             |
| 👁 Preview    | Olho pixelado           | `<ellipse cx="12" cy="12" rx="8" ry="4" stroke="currentColor" stroke-width="2" fill="none" shape-rendering="crispEdges"/> <circle cx="12" cy="12" r="2" fill="currentColor" shape-rendering="crispEdges"/>`                                                                          |
| ⋯ Menu       | Três pixels            | `<rect x="4" y="10" width="4" height="4" fill="currentColor" shape-rendering="crispEdges"/> <rect x="10" y="10" width="4" height="4" fill="currentColor" shape-rendering="crispEdges"/> <rect x="16" y="10" width="4" height="4" fill="currentColor" shape-rendering="crispEdges"/>` |
| ✅ Aceitar    | Check pixelado          | `<path d="M6 12l4 4 8-8" stroke="currentColor" stroke-width="3" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                                                          |
| ❌ Rejeitar   | X pixelado              | `<path d="M6 6l12 12 M18 6l-12 12" stroke="currentColor" stroke-width="3" fill="none" shape-rendering="crispEdges"/>`                                                                                                                                                                |

### 6.3 Regra de Criação de Ícones

```css
.pixel-icon {
  width: 24px;
  height: 24px;
  shape-rendering: crispEdges;
  image-rendering: pixelated;
}

/* Tamanhos permitidos: 16, 24, 32, 48 */
.pixel-icon-sm { width: 16px; height: 16px; }
.pixel-icon-md { width: 24px; height: 24px; }
.pixel-icon-lg { width: 32px; height: 32px; }
.pixel-icon-xl { width: 48px; height: 48px; }
```

---

## 7. Recursos e Bibliotecas de Referência

### 7.1 Repositórios GitHub

#### **Pxlkit** (joangeldelarosa/pxlkit) [[1]], [[4]]

- **O que é:** Monorepo com 226+ ícones pixel art e 111 componentes React retrô
- **Para usar:** Referência visual dos componentes (não instalar — CAIM é Vanilla JS)
- **Pacotes relevantes:**
  - `@pxlkit/ui`: 41 ícones (36 estáticos + 5 animados) para controles de interface [[3]]
  - `@pxlkit/gamification`: 51 ícones para conquistas, VFX e gamificação [[9]]
  - `@pxlkit/social`: 43 ícones (35 estáticos + 8 animados) para mídia social [[7]]
- **Como aplicar:** Extrair os designs dos ícones e reimplementar em SVG inline com `shape-rendering: crispEdges`

#### **Awesome Pixel Art** (Siilwyn/awesome-pixel-art) [[10]], [[12]]

- **O que é:** Lista curada com **tudo** sobre pixel art no universo open-source
- **Seções úteis:**
  - **Ferramentas:** Editores pixel art (Aseprite, Piskel, LibreSprite)
  - **Fontes:** Coleção de fontes pixeladas (Press Start 2P, Dogica, 04b03)
  - **Tutoriais:** Técnicas de shading, anti-aliasing pixelado, animação sprite
  - **Paletas:** Paletas clássicas (NES, SNES, Genesis, PICO-8)
- **Como aplicar:** Referência de design e paleta de cores

#### **Gamedev-list** (Pndy/gamedev-list) [[20]]

- **O que é:** Backup de recursos de desenvolvimento de jogos
- **Seções relevantes:**
  - Fontes pixeladas e mockup generators
  - Ícones retrô e elementos de UI
  - Tutoriais de animação 2D
- **Como aplicar:** Fonte de inspiração para componentes gamificados

### 7.2 Plataformas de Assets

#### **Itch.io (Pixel UI Packs)** [[28]], [[30]], [[33]], [[35]]

- **O que é:** Maior portal de assets pixel art do mundo
- **Tags recomendadas:**
  - `16-bit` + `user-interface` [[28]]
  - `pixel-art` + `buttons`
  - `rpg-gui`
- **Packs populares (gratuitos):**
  - **Free Pixel GUI Sample (Fantasy RPG)**: 24 sprites de painéis, botões, barras [[35]]
  - **Pixel UI Pack (750 assets)**: Coleção massiva de elementos de UI retrô [[41]]
  - **Complete UI Essential Pack**: Spritesheets resizeáveis em múltiplos estilos
- **Como aplicar:** Baixar referências visuais, extrair padrões de design (bordas, sombras, estados), **nunca usar os PNGs diretamente** (performance ruim, não escalável)

#### **OpenGameArt.org** [[37]], [[41]]

- **O que é:** Repositório de recursos gratuitos e de domínio público (CC0)
- **Buscas recomendadas:**
  - "Pixel UI Pack"
  - "16-bit GUI"
  - "RPG interface"
- **Recursos destacados:**
  - **Pixel UI pack (750 assets)**: Painéis, botões, barras em estilo pixel art [[41]]
  - **RPGui HUD**: Pack de elementos HUD para jogos RPG
  - **700+ RPG Icons**: Ícones de ações e itens (referência para tool calls)
- **Licença:** A maioria é CC0 (pode usar comercialmente sem atribuição)

#### **LottieFiles (Pixel Art Animations)** [[52]], [[53]], [[54]]

- **O que é:** Biblioteca de animações vetoriais em formato JSON (Lottie)
- **Buscas recomendadas:**
  - "8-bit" [[52]]
  - "pixel art" [[54]]
  - "retro loading"
  - "achievement unlocked"
- **Como aplicar:** Carregar animações Lottie via biblioteca leve (~30KB) para microinterações complexas:
  - Loading spinners pixelados
  - Conquistas desbloqueadas
  - Feedback de sucesso/erro
- **Biblioteca recomendada:** `lottie-web` (25KB gzip) — lazy-load apenas quando necessário

### 7.3 Frameworks CSS de Referência

#### **NES.css** [[73]], [[75]], [[76]]

- **O que é:** Framework CSS estilo NES (8-bit) de código aberto
- **URL:** https://nostalgic-css.github.io/NES.css/
- **Componentes úteis (referência visual):**
  - Botões estilo console
  - Caixas de diálogo RPG
  - Barras de progresso (HP/MP/XP)
  - Tabelas e formulários pixelados
  - Ícones de personagens (Mario, Pikachu, etc.)
- **Como aplicar:** **Não instalar** (é para React/Vue). Extrair padrões de CSS (bordas, sombras, animações) e reimplementar no `main.css` do CAIM.

#### **Outros Frameworks Retro** [[74]], [[79]]

- **PSOne.css**: Estilo PlayStation 1 (mais moderno, 32-bit)
- **98.css**: Estilo Windows 98 (desktop retrô)
- **XP.css**: Estilo Windows XP
- **7.css**: Estilo Windows 7

### 7.4 Técnicas CSS Essenciais

#### **image-rendering: pixelated** [[59]], [[61]], [[62]], [[65]]

```css
/* Mantém pixels nítidos ao escalar imagens */
img.pixel-art,
.pixel-icon,
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges; /* Firefox fallback */
}
```

#### **Box-Shadow Pixel Art** [[66]], [[68]], [[70]], [[72]]

```css
/* Técnica de criar bordas pixeladas sem imagens */
.pixel-box {
  box-shadow:
    /* Border interno (highlight) */
    inset -2px -2px 0 0 rgba(255,255,255,0.1),
    /* Border externo */
    inset 2px 2px 0 0 var(--pixel-border),
    /* Sombra dura */
    0 4px 0 0 var(--pixel-shadow);
}
```

#### **Pixel Art via CSS Grid** (para ícones complexos)

```css
.pixel-grid-icon {
  display: grid;
  grid-template-columns: repeat(8, 4px);
  grid-template-rows: repeat(8, 4px);
  gap: 0;
}

.pixel-grid-icon .pixel {
  width: 4px;
  height: 4px;
  background: var(--accent);
}
```

---

## 8. Guia de Implementação para o Agente de Código

### 8.1 Ordem de Execução (Sprint S20)

#### **Fase 1 — Fundação (Dia 1-2)**

1. [ ] **Adicionar fontes pixeladas** ao `index.html` (Press Start 2P, VT323, Silkscreen)
2. [ ] **Atualizar variáveis CSS** no `main.css` com a paleta extendida 16-bit
3. [ ] **Criar classe utilitária** `.pixel-border` e `.pixel-btn` base
4. [ ] **Aplicar `image-rendering: pixelated`** globalmente em ícones e imagens

#### **Fase 2 — Componentes Core (Dia 3-5)**

5. [ ] **Refatorar Activity Bar** com estilo RPG menu (Seção 4.2)
6. [ ] **Refatorar Bottom Sheet** com estilo dialog box RPG (Seção 4.3)
7. [ ] **Refatorar Editor** com tema CodeMirror 16-bit (Seção 4.4)
8. [ ] **Refatorar Explorer Drawer** com estilo inventário (Seção 4.5)

#### **Fase 3 — Interações (Dia 6-7)**

9. [ ] **Implementar sistema de partículas** (Seção 5.1)
1. [ ] **Adicionar microinterações** (save-flash, deploy-rocket, streaming-cursor)
1. [ ] **Criar toasts de conquista** (Seção 4.7)
1. [ ] **Refatorar Diff Viewer** com estilo batalha RPG (Seção 4.8)

#### **Fase 4 — Polish (Dia 8-9)**

1. [ ] **Substituir ícones Lucide** por versões pixel art (Seção 6.2)
1. [ ] **Adicionar efeito CRT** opcional em Settings (Seção 5.3)
1. [ ] **Testar em iPhone real** (Safari, safe-areas, teclado flutuante)
1. [ ] **Otimizar bundle** (remover fontes não usadas, lazy-load Lottie se usado)

### 8.2 Checklist de Qualidade

- [ ] **Pixel Perfect:** Todos os elementos respeitam grid de múltiplos de 4px
- [ ] **Performance:** Zero layout thrashing (apenas `transform` e `opacity`)
- [ ] **Acessibilidade:** Contraste WCAG AA mantido (4.5:1 mínimo)
- [ ] **Mobile-First:** Testado em iPhone SE (375px) e iPhone 14 Pro (390px)
- [ ] **Offline:** Fontes carregadas e cacheadas via Service Worker
- [ ] **Bundle Size:** Core CSS < 15KB gzip (adicionar ~8KB para fontes pixeladas)

### 8.3 Comandos de Deploy

```bash
# Desenvolvimento
npm run dev

# Build de produção (validar bundle size)
npm run build

# Deploy
firebase deploy --only hosting
```

### 8.4 Referências Visuais (Inspiração)

**Jogos para estudar:**

- **Celeste**: UI minimalista pixel art, feedback tátil perfeito
- **Stardew Valley**: Inventário e diálogos RPG
- **Undertale**: Sistema de batalha e menus
- **Shovel Knight**: Paleta de cores e animações fluidas
- **Dead Cells**: VFX de partículas e feedback de combate

**Sites/Apps para estudar:**

- **NES.css Demo**: https://nostalgic-css.github.io/NES.css/
- **Pxlkit UI Kit**: https://pxlkit.xyz/ui-kit
- **Retro CSS Frameworks List**: https://github.com/matt-auckland/retro-css

---

## 9. Mockups e Wireframes (Descrição Textual)

### 9.1 Layout IDE Completo (16-bit)

```
┌─────────────────────────────────────────────────────┐
│  🎮 CAIM         [🚀 Deploy] [➕ New] [⚙] [👤]  │  ← Header (48px)
├────┬────────────────────────────────────────────────┤
│ 📁 │ [index.html] [styles.css] [app.js] ●       │  ← Editor Tabs
│ 💬 │ ─────────────────────────────────────────── │
│ 🔍 │ 1 │ <!DOCTYPE html>                         │  ← CodeMirror
│ ⚙️ │ 2 │ <html lang="pt-BR">                     │     (tema 16-bit)
│    │ 3 │ <head>                                  │
│    │ 4 │   <meta charset="UTF-8">                │
│    │ 5 │   <title>MVP Padaria</title>            │
│    │ 6 │   <link rel="stylesheet" href="styles"> │
│    │ 7 │ </head>                                 │
│    │                                             │
│    │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← Status Bar
│    │ LV.42 · 1337 XP · 🟢 Saved · UTF-8         │
├────┴────────────────────────────────────────────────┤
│  ════════════════════════════════════════════════   │  ← Handle
│  [💬 CHAT] [⚔ DIFF] [👁 PREVIEW] [🎮 GIT]       │  ← Sheet Tabs
│ ─────────────────────────────────────────────────── │
│ 🤖 Assistente: "Criei 3 arquivos para sua        │
│   landing page de padaria! Quer revisar as        │
│   alterações?"                                    │
│                                                    │
│ [Digite sua mensagem...] [🚀]                     │  ← Input
└────────────────────────────────────────────────────┘
   ↑
   Drawer (78vw) ao abrir 📁
```

### 9.2 Toast de Conquista

```
┌─────────────────────────────┐
│ 🏆 CONQUISTA DESBLOQUEADA!  │
│                             │
│ "Primeiro Deploy"           │
│ +100 XP                     │
│                             │
│ 🌐 ronaldo.github.io/mvp-1  │
└─────────────────────────────┘
  (slide-in da direita, 4s)
```

### 9.3 Dialog de Confirmação

```
┌─────────────────────────────┐
│ ⚠️ CONFIRMAR EXCLUSÃO       │
│ ─────────────────────────── │
│                             │
│ Tem certeza que deseja      │
│ excluir "styles.css"?       │
│                             │
│ Esta ação não pode ser      │
│ desfeita!                   │
│                             │
│ ─────────────────────────── │
│ [ CANCELAR ]   [ EXCLUIR ] │
└─────────────────────────────┘
```

---

## 10. Roadmap Pós-Implementação (Sprint S20+)

### 10.1 Features Futuras 16-bit

- **Sistema de Conquistas (Achievements):**

  - "Primeiro Commit" — fazer o primeiro commit
  - "Speed Coder" — 100 edições em 1 minuto
  - "Deploy Master" — 10 deploys realizados
  - "Bug Hunter" — rejeitar 5 diffs
  - "Offline Warrior" — usar o app 1h em modo avião
- **Sistema de XP e Níveis:**

  - Ganhar XP por ações (criar arquivo = 10 XP, commit = 50 XP, deploy = 100 XP)
  - Subir de nível desbloqueia temas de cores alternativos
  - Leaderboard global (opcional, Firebase Analytics)
- **Temas de Cores Alternativos (Desbloqueáveis):**

  - **NES Palette**: Paleta clássica de 54 cores do NES
  - **Game Boy Green**: Monocromático verde (#0f380a, #306230, #8bac0f, #9bbc0f)
  - **Virtual Boy Red**: Monocromático vermelho (#000, #800, #f00, #fff)
  - **CGA Palette**: 16 cores clássicas do IBM CGA
- **Efeitos de Som (Opcional):**

  - Som de "moeda" ao salvar
  - Som de "power up" ao aceitar diff
  - Som de "game over" ao rejeitar diff
  - Som de "level up" ao subir de nível
  - **Biblioteca recomendada:** `tone.js` (síntese de áudio 8-bit, ~30KB)

### 10.2 Integrações Futuras

- **LottieFiles Premium:** Animações customizadas para o CAIM
- **Pxlkit Pro:** Ícones animados para conquistas e VFX
- **GitHub Achievements:** Sincronizar conquistas do GitHub com o sistema do CAIM

---

## 11. Apêndice — Código Completo de Referência

### 11.1 CSS Reset 16-bit

```css
/* Adicionar ao início do main.css */
*, *::before, *::after {
  box-sizing: border-box;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: none; /* Pixel-perfect */
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--font-body);
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
  image-rendering: pixelated;
}

/* Desabilitar seleção de texto em UI elements */
.activity-bar,
.sheet-tabs,
.editor-tabs,
.tree-item {
  user-select: none;
  -webkit-user-select: none;
}

/* Permitir seleção no editor e chat */
.cm-editor,
.chat-bubble,
.viewer-markdown {
  user-select: text;
  -webkit-user-select: text;
}
```

### 11.2 HTML Base com Fontes

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#0f172a">
  
  <title>CAIM — Cerra AI Mobile</title>
  
  <!-- Fontes Pixel Art (fora do caminho crítico) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Silkscreen&display=swap" rel="stylesheet">
  
  <!-- CSS Principal -->
  <link rel="stylesheet" href="/src/css/main.css">
  
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json">
  
  <!-- Ícones -->
  <link rel="icon" type="image/png" href="/assets/icons/icon-32.png">
  <link rel="apple-touch-icon" href="/assets/icons/icon-192.png">
</head>
<body>
  <!-- App Shell -->
  <div id="app">
    <!-- Header, Activity Bar, Editor, Bottom Sheet, Drawer -->
  </div>
  
  <!-- Script Principal -->
  <script type="module" src="/src/js/app.js"></script>
</body>
</html>
```

### 11.3 Exemplo de Uso — Criar Toast de Conquista

```javascript
// Em qualquer parte do código
import { showAchievement } from './ui/toast.js';

// Quando o usuário faz o primeiro deploy
showAchievement({
  title: 'Primeiro Deploy!',
  message: 'Seu MVP está no ar 🚀',
  xp: 100,
  icon: '🏆'
});

// Emite partículas
particles.emit(window.innerWidth - 100, 100, 'deploy');
```

---

## 12. Conclusão

Este documento define **completamente** a arquitetura visual 16-bit do CAIM, mantendo a identidade atual (#0f172a + #2dd4bf) enquanto adiciona uma camada gamificada que transforma cada interação em uma experiência memorável.

**Próximos passos:**

1. **Aprovação do documento** pelo Owner (você)
2. **Criação da Sprint S20** no `implementation.md` (Retrofit 16-bit)
3. **Implementação faseada** conforme Seção 8.1
4. **Testes em iPhone real** (Sprint S19 — Go Live Final)

**Recursos totais estimados:**

- **Tempo:** 9 dias (solo dev)
- **Bundle Size Adicional:** ~8KB gzip (fontes) + ~15KB gzip (CSS extendido)
- **Performance:** Zero impacto negativo (apenas `transform` e `opacity` nas animações)

---

*Documento gerado em 2026-08-16. Última atualização: 2026-08-16.*
*Para dúvidas ou ajustes, consultar o Owner antes de modificar a arquitetura.*
