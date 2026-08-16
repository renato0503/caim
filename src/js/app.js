import '../css/main.css';
import { registerSW } from 'virtual:pwa-register';
import { vfs } from './core/vfs-service.js';
import { FileTree } from './ui/file-tree.js';
import { CodeEditor } from './ui/editor.js';
import { FileViewer } from './ui/viewer.js';
import { DiffViewer, applyBlockAccept, applyBlockReject, isMinifiedFile } from './ui/diff-viewer.js';
import { GitPanel } from './ui/git-panel.js';
import { AuthViews } from './ui/auth-views.js';
import { notify } from './ui/notify.js';
import { agentManager, AGENT_MODE } from './agents/agent-manager.js';
import { authService } from './auth/auth-service.js';
import { dbService } from './db/db-service.js';
import { deployFunctionUrl } from './firebase/firebase-config.js';

const appEl = document.getElementById('app');
const $chatMessages = document.getElementById('chat-messages');
const $chatInput = document.getElementById('chat-input');
const $sendBtn = document.getElementById('send-btn');
const $newFileBtn = document.getElementById('newfile-btn');
const $settingsBtn = document.getElementById('settings-btn');
const $menuBtn = document.getElementById('menu-btn');
const $uploadBtn = document.getElementById('upload-btn');
const $closeDrawerBtn = document.getElementById('close-drawer-btn');
const $deployBtn = document.getElementById('deploy-btn');

// ============================================================
// Layout controller (S4.5)
// ============================================================

const sheet = document.getElementById('bottom-sheet');
const drawer = document.getElementById('explorer-drawer');
const backdrop = document.getElementById('drawer-backdrop');
const handle = document.getElementById('bs-handle');

const SHEET_COLLAPSED = 44;
const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight;
const sheetMax = () => Math.floor(viewportHeight() * 0.8);
const sheetDefault = () => Math.floor(viewportHeight() * 0.55);

function setSheetHeight(px) {
  sheet.style.height = `${Math.min(Math.max(px, SHEET_COLLAPSED), sheetMax())}px`;
}

function expandSheet() {
  setSheetHeight(Math.max(sheet.offsetHeight, sheetDefault()));
  sheet.classList.add('expanded');
}

function collapseSheet() {
  setSheetHeight(SHEET_COLLAPSED);
  sheet.classList.remove('expanded');
}

function showPane(name) {
  document.querySelectorAll('.bs-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === name));
  document.querySelectorAll('.bs-tab').forEach((t) => t.classList.toggle('bs-active', t.dataset.pane === name));
  if (name === 'diff') refreshDiff();
  if (name === 'git') gitPanel.refresh();
  expandSheet();
}

function openDrawer() {
  drawer.classList.add('open');
  backdrop.classList.add('show');
}

function closeDrawer() {
  drawer.classList.remove('open');
  backdrop.classList.remove('show');
}

// Atualiza a altura do app para o visualViewport (teclado iOS abre/fecha).
// Throttle via requestAnimationFrame: evita "jitter"/layout thrash quando o
// teclado virtual dispara resize+scroll em rajada (padrão viewport-truth).
let rafPending = false;
function syncViewport() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    appEl.style.height = `${viewportHeight()}px`;
    if (sheet.classList.contains('expanded')) {
      setSheetHeight(Math.min(sheet.offsetHeight, sheetMax()));
    }
  });
}
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewport);
  window.visualViewport.addEventListener('scroll', syncViewport);
}

// Activity bar
function setActivity(name) {
  document.querySelectorAll('.ab-item').forEach((b) => b.classList.toggle('ab-active', b.dataset.activity === name));
}
document.querySelectorAll('.ab-item').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const act = btn.dataset.activity;
    if (act === 'chat') {
      setActivity('chat');
      if (sheet.classList.contains('expanded')) collapseSheet();
      else showPane('chat');
    } else if (act === 'explorer') {
      if (drawer.classList.contains('open')) closeDrawer();
      else { setActivity('explorer'); openDrawer(); }
    } else if (act === 'settings') {
      if (!authViews?.user) return;
      try {
        await authViews.loadSettings();
        authViews.show('settings');
      } catch (err) {
        notify.toast(`Erro ao carregar Configurações: ${err.message}`, { position: 'center' });
      }
    }
  });
});

$menuBtn.addEventListener('click', openDrawer);
$closeDrawerBtn.addEventListener('click', closeDrawer);
backdrop.addEventListener('click', closeDrawer);

// Voltar ao dashboard a partir da IDE (navStack do AuthViews)
document.getElementById('ide-back-btn').addEventListener('click', () => authViews?.goBack());

// Drag do bottom sheet (touch nativo)
let dragY = 0;
let dragStartH = SHEET_COLLAPSED;
let dragging = false;
handle.addEventListener('touchstart', (e) => {
  dragging = true;
  dragY = e.touches[0].clientY;
  dragStartH = sheet.offsetHeight;
  sheet.style.transition = 'none';
});
handle.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  e.preventDefault();
  setSheetHeight(dragStartH + (dragY - e.touches[0].clientY));
});
const endDrag = () => {
  if (!dragging) return;
  dragging = false;
  sheet.style.transition = '';
  if (sheet.offsetHeight <= viewportHeight() * 0.3) collapseSheet();
  else expandSheet();
};
handle.addEventListener('touchend', endDrag);
handle.addEventListener('touchcancel', endDrag);

// ============================================================
// Componentes (intactos: CodeEditor / FileTree / FileViewer)
// ============================================================

const editor = new CodeEditor({
  container: document.getElementById('editor-container'),
  tabsEl: document.getElementById('editor-tabs'),
  statusEl: document.getElementById('editor-status'),
});

const viewer = new FileViewer({
  container: document.getElementById('viewer-content'),
  titleEl: document.getElementById('viewer-title'),
  onOpenInEditor: (path) => {
    editor.openFile(path);
    collapseSheet();
  },
});

const tree = new FileTree({
  container: document.getElementById('file-tree'),
  onOpenFile: (path) => {
    editor.openFile(path);
    collapseSheet();
    closeDrawer();
  },
  onPreviewFile: (path) => {
    viewer.openFile(path);
    showPane('preview');
    closeDrawer();
  },
  onFileActions: (file) => showFileActions(file),
});

// ============================================================
// Ações de arquivo (S3: abrir/visualizar/renomear/excluir)
// ============================================================

function showFileActions(file) {
  notify.actions({
    buttons: [
      { text: 'Abrir no editor', onClick: () => editor.openFile(file.path) },
      { text: 'Visualizar', onClick: () => { viewer.openFile(file.path); showPane('preview'); } },
      {
        text: 'Renomear',
        onClick: async () => {
          const base = vfs.constructor.basename(file.path);
          const parent = vfs.constructor.parentDir(file.path);
          const value = await promptDialog('Novo nome', base);
          if (!value || value === base) return;
          const newPath = parent ? `${parent}/${value}` : value;
          try {
            await vfs.renameFile(file.path, newPath);
            notify.toast(`Renomeado para ${newPath}`);
          } catch (err) {
            notify.toast(err.message);
          }
        },
      },
      {
        text: 'Excluir',
        color: 'red',
        onClick: async () => {
          const confirmed = await confirmDialog(`Excluir ${file.path}?`, 'Excluir arquivo');
          if (!confirmed) return;
          try {
            await vfs.deleteFile(file.path);
            await editor.forceRemove(file.path);
            notify.toast(`Excluído: ${file.path}`);
          } catch (err) {
            notify.toast(err.message);
          }
        },
      },
    ],
  });
}

function promptDialog(title, initial = '') {
  return new Promise((resolve) => {
    notify.prompt(initial, title, (value) => resolve((value || '').trim() || null), () => resolve(null));
  });
}

function confirmDialog(text, title = 'Confirmar') {
  return new Promise((resolve) => {
    notify.confirm(text, title, () => resolve(true), () => resolve(false));
  });
}

// ============================================================
// Diff Viewer (S5)
// ============================================================

function refreshDiff() {
  const diffs = editor.getDiffCandidates().filter((f) => !isMinifiedFile(f.path));
  diffViewer.setFiles(diffs);
}

const diffViewer = new DiffViewer({
  container: document.getElementById('diff-container'),
  onAcceptBlock: async (path, idx) => {
    const f = editor.getDiffCandidates().find((c) => c.path === path);
    if (!f) return;
    await editor.applyContent(path, applyBlockAccept(f.oldContent, f.newContent, idx), { saved: true });
    refreshDiff();
  },
  onRejectBlock: async (path, idx) => {
    const f = editor.getDiffCandidates().find((c) => c.path === path);
    if (!f) return;
    await editor.applyContent(path, applyBlockReject(f.oldContent, f.newContent, idx), { saved: false });
    refreshDiff();
  },
  onAcceptAll: async (path) => {
    await editor.save(path);
    refreshDiff();
  },
  onRejectAll: async (path) => {
    await editor.revert(path);
    refreshDiff();
  },
});

// ============================================================
// Git Panel (S2)
// ============================================================

const gitPanel = new GitPanel({
  container: document.getElementById('git-panel'),
  notify,
  onDeploy: () => deployProject(),
  onResetWorkspace: resetWorkspace,
  onDeployed: (url) => {
    notify.toast(`MVP publicado! O GitHub está construindo. ${url}`, { position: 'center' });
  },
});

// Foco no editor recolhe o bottom sheet (editor sempre em primeiro plano)
document.getElementById('editor-container').addEventListener('focusin', () => {
  if (sheet.classList.contains('expanded')) collapseSheet();
});

document.getElementById('viewer-open-editor').addEventListener('click', () => {
  if (viewer.currentPath) {
    editor.openFile(viewer.currentPath);
    collapseSheet();
  }
});

// ============================================================
// VFS events
// ============================================================

let fileCounter = 0;

vfs.events.on('vfs:changed', ({ type, path }) => {
  if (path.startsWith('.git/')) return;
  if (type === 'create' && !path.endsWith('/')) {
    editor.openFile(path, { force: true });
  }
  // S23/J4: conflito de edição — a IA atualizou um arquivo que o usuário
  // está editando (dirty). Não sobrescrever silenciosamente; pedir escolha.
  if (type === 'update' && editor.isDirty(path)) {
    notify.confirm(
      `O agente modificou "${path}" enquanto você o editava.\n\nDeseja manter suas alterações locais?`,
      'Conflito de edição',
      () => editor.markStale(path),        // manter local: marca stale para reabrir depois
      () => editor.openFile(path, { force: true }) // usar IA: recarrega o arquivo
    );
  }
});

// ============================================================
// Novo arquivo / upload / settings
// ============================================================

$newFileBtn.addEventListener('click', () => {
  notify.prompt('Caminho do arquivo (ex.: src/novo.js)', 'Novo arquivo', async (value) => {
    const name = (value || '').trim();
    if (!name) return;
    try {
      const { created } = await vfs.writeFile(name, '// CAIM\n');
      notify.toast(created ? `Criado: ${name}` : `Atualizado: ${name}`);
      await editor.openFile(name, { force: true });
    } catch (err) {
      notify.toast(err.message);
    }
  });
});

$settingsBtn.addEventListener('click', async () => {
  if (!authViews?.user) return;
  try {
    await authViews.loadSettings();
    authViews.show('settings');
  } catch (err) {
    notify.toast(`Erro ao carregar Configurações: ${err.message}`, { position: 'center' });
  }
});

// Upload de arquivos locais → VFS (texto ou data URL) → preview
const TEXT_EXT = ['.md', '.markdown', '.txt', '.js', '.mjs', '.ts', '.tsx', '.jsx', '.json', '.css', '.html', '.htm', '.csv', '.py', '.xml', '.yaml', '.yml', '.svg'];
function isTextFile(file) {
  if (file.type.startsWith('text/')) return true;
  const ext = vfs.constructor.extname(file.name).toLowerCase();
  return TEXT_EXT.includes(ext);
}

function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (isTextFile(file)) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

$uploadBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.addEventListener('change', async () => {
    const files = [...(input.files || [])];
    for (const file of files) {
      try {
        const content = await readFileContent(file);
        const name = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `uploads/${name}`;
        await vfs.writeFile(path, content);
        notify.toast(`Enviado: ${name}`);
        viewer.openFile(path);
        showPane('preview');
        closeDrawer();
      } catch (err) {
        notify.toast(`Falha ao enviar ${file.name}: ${err.message}`);
      }
    }
  });
  input.click();
});

// ============================================================
// Chat (AgentManager — DEMO | LIVE com failover)
// ============================================================

function addMessage(text, { type = 'received' } = {}) {
  const className = type === 'user' ? 'message-user' : 'message-received';
  const message = document.createElement('div');
  message.className = `message ${className}`;
  message.innerHTML = `
    <div class="message-content">
      <div class="message-bubble">
        <div class="message-text"></div>
      </div>
    </div>
  `;
  message.querySelector('.message-text').textContent = text;
  $chatMessages.appendChild(message);
  $chatMessages.scrollTop = $chatMessages.scrollHeight;
  return message;
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30) || 'mvp';
}

const $thinkToggle = document.getElementById('think-toggle');
const $chatStop = document.getElementById('chat-stop');
let currentAbort = null;
let chatHistory = [];

async function persistChatHistory() {
  try {
    await vfs.db.metadata.put({ key: 'chatHistory', value: chatHistory.slice(-60) });
  } catch (err) {
    // persistência não é crítica
  }
}

async function loadChatHistory() {
  try {
    const rec = await vfs.db.metadata.get('chatHistory');
    return rec?.value || [];
  } catch (err) {
    return [];
  }
}

async function sendMessage() {
  const text = $chatInput.value.trim();
  if (!text) return;
  $chatInput.value = '';
  autoResize();
  addMessage(text, { type: 'user' });
  chatHistory.push({ type: 'user', text });
  persistChatHistory();
  showPane('chat');

  const reply = addMessage('', { type: 'received' });
  const textEl = reply.querySelector('.message-text');
  const thinkOn = $thinkToggle.checked;
  let buf = '';
  let thinking = '';
  let finalText = '';

  currentAbort = new AbortController();
  $chatStop.classList.remove('hidden');
  agentManager.setContext(editor.getOpenFilesContext());
  try {
    const result = await agentManager.sendPrompt({
      text,
      uid: authViews?.user?.uid || null,
      signal: currentAbort.signal,
      onThinking: thinkOn
        ? (chunk) => {
            thinking += chunk;
            ensureThinkingBox(reply, thinking);
          }
        : undefined,
      onChunk: (chunk) => {
        buf += chunk;
        textEl.textContent = buf;
        $chatMessages.scrollTop = $chatMessages.scrollHeight;
      },
    });
    const truncatedNote = result.truncated ? '\n\n⚠ **Resposta truncada** — o modelo cortou a saída no meio.' : '';
    const binaryNote = result.binaryWarnings?.length ? `\n\n⚠ Binário ignorado na geração: ${result.binaryWarnings.join(', ')}. Use o upload.` : '';
    const costNote = result.approxTokens ? `\n\n*~${result.approxTokens} tokens estimados nesta geração.*` : '';
    const extra = `${truncatedNote}${binaryNote}${result.files?.length ? `\n\nArquivos criados: ${result.files.join(', ')}` : ''}${costNote}`;
    finalText = `${buf || result.message}${extra}`;
    textEl.textContent = '';
    renderMarkdownTo(textEl, finalText);
    // S22: "Continuar geração" quando a resposta foi truncada no meio de um arquivo
    if (result.truncated) {
      const contBtn = document.createElement('button');
      contBtn.className = 'chat-continue-btn';
      contBtn.textContent = 'Continuar geração';
      contBtn.addEventListener('click', () => {
        const lastFile = result.files?.[result.files.length - 1];
        const tail = lastFile ? ` Continue o arquivo ${lastFile} de onde parou.` : '';
        $chatInput.value = `${text}${tail}`;
        autoResize();
        sendMessage();
      });
      const bubble = reply.querySelector('.message-bubble');
      bubble.appendChild(contBtn);
    }
    if (thinkOn && (thinking || result.thinking)) {
      ensureThinkingBox(reply, thinking || result.thinking, true);
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      finalText = `${buf || ''}\n\n_(geração interrompida)_`;
      renderMarkdownTo(textEl, finalText);
    } else {
      finalText = `Erro: ${err.message}`;
      textEl.textContent = finalText;
    }
  } finally {
    currentAbort = null;
    $chatStop.classList.add('hidden');
    if (finalText) {
      chatHistory.push({ type: 'assistant', text: finalText });
      persistChatHistory();
    }
  }
}

function ensureThinkingBox(msgEl, text, done = false) {
  const bubble = msgEl.querySelector('.message-bubble');
  let details = msgEl.querySelector('.thinking');
  if (!details) {
    details = document.createElement('details');
    details.className = 'thinking';
    const summary = document.createElement('summary');
    summary.textContent = 'Pensamento';
    details.appendChild(summary);
    bubble.appendChild(details);
  }
  let body = details.querySelector('.thinking-body');
  if (!body) {
    body = document.createElement('div');
    body.className = 'thinking-body';
    details.appendChild(body);
  }
  body.textContent = text;
  details.open = !done;
}

async function renderMarkdownTo(el, text) {
  try {
    const { marked } = await import('marked');
    const DOMPurify = (await import('dompurify')).default;
    el.innerHTML = DOMPurify.sanitize(marked.parse(text || ''));
  } catch (err) {
    el.textContent = text;
  }
}

$chatStop.addEventListener('click', () => {
  currentAbort?.abort();
});

// ============================================================
// Deploy to Pages (MVP Factory — via Cloud Function)
// ============================================================

async function deployProject() {
  if (!authViews?.user || authViews.devMode) {
    notify.toast('Faça login para publicar seu MVP', { position: 'center' });
    throw new Error('Login necessário');
  }
  try {
    const token = await authService.getIdToken();
    if (!token) throw new Error('Sessão expirada — entre novamente');
    const allFiles = await vfs.listAllFiles();
    const files = [];
    for (const p of allFiles) {
      if (p.startsWith('.git/')) continue;
      const { content } = await vfs.readFile(p);
      files.push({ path: p, content });
    }
    const projectName = `mvp-${slugify(new Date().toISOString().slice(0, 10))}-${Math.random().toString(36).slice(2, 6)}`;
    notify.toast('Publicando MVP no GitHub Pages…', { position: 'center' });
    const res = await fetch(deployFunctionUrl('githubDeployProxy'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ projectName, files, description: 'MVP gerado pelo CAIM' }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || 'Falha no deploy');
    await dbService.addProject(authViews.user.uid, { name: projectName, url: json.url, fileCount: files.length });
    notify.toast(`MVP publicado! ${json.url}`, {
      button: { text: 'Abrir', onClick: () => window.open(json.url, '_blank') },
      position: 'center',
    });
    return json.url;
  } catch (err) {
    notify.toast(`Deploy falhou: ${err.message}`, { position: 'center' });
    throw err;
  }
}

// S9: limpa o workspace para começar um novo MVP
async function resetWorkspace() {
  const ok = await confirmDialog('Apagar todos os arquivos (README, src, uploads, .git) e começar um novo MVP?', 'Novo projeto');
  if (!ok) return;
  try {
    const files = await vfs.listAllFiles();
    for (const p of files) {
      if (p.startsWith('.git/')) continue;
      await vfs.deleteFile(p, { silent: true });
    }
    await vfs.db.directories.clear();
    for (const f of [...editor.openFiles]) await editor.forceRemove(f.path);
    await tree.render();
    notify.toast('Workspace limpo — novo MVP!');
  } catch (err) {
    notify.toast(`Erro ao limpar: ${err.message}`);
  }
}

$deployBtn.addEventListener('click', () => {
  deployProject().catch(() => {});
});

// ============================================================
// Input handling
// ============================================================

function autoResize() {
  $chatInput.style.height = 'auto';
  $chatInput.style.height = `${$chatInput.scrollHeight}px`;
}

$sendBtn.addEventListener('click', sendMessage);
$chatInput.addEventListener('input', autoResize);
$chatInput.addEventListener('focus', () => {
  if (!sheet.classList.contains('expanded')) expandSheet();
});
$chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

// ============================================================
// Bootstrap
// ============================================================

let authViews = null;

// S12: fonte pixel (Press Start 2P) carregada fora do caminho crítico de render.
function loadPixelFont() {
  if (document.fonts?.check?.('12px "Press Start 2P"')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
  document.head.appendChild(link);
}

async function bootstrap() {
  await vfs.ready;
  loadPixelFont();
  await tree.render();
  editor.setStatus('Pronto');

  authViews = new AuthViews({
    notify,
    onEnterIde: async () => {
      agentManager.mode = authViews.user && !authViews.devMode ? AGENT_MODE.LIVE : AGENT_MODE.DEMO;
      authViews.show('ide');
      $chatMessages.innerHTML = '';
      const history = await loadChatHistory();
      chatHistory = history;
      for (const entry of history) {
        addMessage(entry.text, { type: entry.type === 'user' ? 'user' : 'received' });
      }
    },
  });
  await authViews.init();
}

bootstrap().catch((err) => console.error('[CAIM] bootstrap failed', err));

// ============================================================
// PWA update (vite-plugin-pwa)
// ============================================================

const updateSW = registerSW({
  onNeedRefresh() {
    notify.toast('Nova versão disponível', {
      button: {
        text: 'Atualizar',
        onClick() {
          updateSW(true);
        },
      },
      position: 'center',
    });
  },
  onOfflineReady() {
    notify.toast('App pronto para uso offline', { position: 'center' });
  },
});
