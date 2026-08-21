import '../css/main.css';
import { registerSW } from 'virtual:pwa-register';
import { vfs } from './core/vfs-service.js';
import { FileTree } from './ui/file-tree.js';
import { SearchPanel } from './ui/search-panel.js';
import { CodeEditor } from './ui/editor.js';
import { FileViewer } from './ui/viewer.js';
import { DiffViewer, applyBlockAccept, applyBlockReject, isMinifiedFile } from './ui/diff-viewer.js';
import { GitPanel } from './ui/git-panel.js';
import { AuthViews } from './ui/auth-views.js';
import { notify } from './ui/notify.js';
import { agentManager, AGENT_MODE, PERMISSION } from './agents/agent-manager.js';
import { detectViewIntent, handleViewIntent, buildFinalText, fileChips, debugRawDetails } from './ui/chat-renderer.js';
import { authService } from './auth/auth-service.js';
import { dbService } from './db/db-service.js';
import { projectService } from './core/project-service.js';
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
const searchDrawer = document.getElementById('search-drawer');
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
  searchDrawer?.classList.remove('open');
  backdrop.classList.remove('show');
}

// S38: drawer de busca (go-to-file + find & replace)
function openSearchDrawer() {
  drawer.classList.remove('open');
  searchDrawer?.classList.add('open');
  backdrop.classList.add('show');
  searchPanel?.refreshPaths();
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
    } else if (act === 'search') {
      if (searchDrawer?.classList.contains('open')) closeDrawer();
      else { setActivity('search'); openSearchDrawer(); }
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

// S38: busca fuzzy (go-to-file) + find & replace global
const searchPanel = new SearchPanel({
  container: document.getElementById('search-panel'),
  notify,
  onOpenFile: (path) => {
    editor.openFile(path);
    collapseSheet();
    closeDrawer();
  },
  onClose: closeDrawer,
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
    notify.particles.emit(window.innerWidth / 2, window.innerHeight / 2, 'success');
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
  onExportZip: () => exportProjectAsZip(),
  onDeployed: (url) => {
    // o deployProject já emite o toast de status (construindo → sucesso)
  },
});

// S24: aviso de "push pendente" ao voltar online (commits locais sem remote)
// — integrado no GitPanel.refresh (método nativo).
window.addEventListener('online', () => {
  gitPanel.refresh();
  notify.toast('Conexão restabelecida.', { position: 'center' });
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

// S42 — toggle de autonomia do agente (perguntar/revisar/auto), por projeto.
const $permToggle = document.getElementById('perm-toggle');
function syncPermButtons() {
  const perm = agentManager.getPermission();
  $permToggle?.querySelectorAll('.perm-btn').forEach((b) => {
    b.classList.toggle('perm-active', b.dataset.perm === perm);
  });
}
$permToggle?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.perm-btn');
  if (!btn) return;
  const mode = btn.dataset.perm;
  try {
    await agentManager.setPermissionForProject(agentManager.activeProjectId, mode);
    syncPermButtons();
    notify.toast(
      mode === 'ask' ? 'Agente agora PERGUNTA antes de cada alteração.'
      : mode === 'auto' ? 'Agente executa em AUTO (sem pedir confirmação).'
      : 'Agente executa e mostra no Diff para REVISÃO.',
      { position: 'center' }
    );
  } catch (err) {
    notify.toast(`Erro: ${err.message}`, { position: 'center' });
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
  // S42: em modo `auto`, aplica direto (sem diálogo).
  if (type === 'update' && editor.isDirty(path)) {
    if (agentManager.getPermission() === PERMISSION.AUTO) {
      editor.openFile(path, { force: true });
      return;
    }
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
  notify.prompt('', 'Novo arquivo', async (value) => {
    const name = (value || '').trim();
    if (!name) return;
    try {
      const { created } = await vfs.writeFile(name, '// CAIM\n');
      notify.toast(created ? `Criado: ${name}` : `Atualizado: ${name}`);
      // O vfs:changed (create) já abre o arquivo; chamar openFile aqui
      // novamente geraria 2 abas (race async). Só garante o foco se ainda
      // não estiver aberto.
      if (!editor.isOpen(name)) {
        await editor.openFile(name, { force: true });
      }
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
      // S26: limite de upload de 10MB (evita travar o Safari com arquivos gigantes)
      if (file.size > 10 * 1024 * 1024) {
        notify.toast(`"${file.name}" tem mais de 10MB — upload bloqueado.`, { position: 'center' });
        continue;
      }
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

// ============================================================
// S31/S34 — Renderização do chat e intenção de visualização
// (detectViewIntent / handleViewIntent / buildFinalText / fileChips /
//  debugRawDetails) vivem em ui/chat-renderer.js (testável).
// ============================================================

// ============================================================
// S42 — Planos de execução (modo "Perguntar") e undo de tool calls
// ============================================================

// Executa um resultado de tools e renderiza no chat (chips + revert + diff).
async function applyExecutionResult(bubble, result) {
  bubble.appendChild(
    fileChips(result.files || [], {
      onOpen: (path) => {
        try {
          editor.openFile(path);
          collapseSheet();
        } catch (err) {
          notify.toast(err.message);
        }
      },
      onPreview: (path) => {
        try {
          viewer.openFile(path);
          showPane('preview');
          closeDrawer();
        } catch (err) {
          notify.toast(err.message);
        }
      },
    })
  );
  // S42: em modo `auto`, aceita o diff imediatamente (sem revisão pendente).
  if (agentManager.getPermission() === PERMISSION.AUTO) {
    for (const path of result.files || []) {
      try {
        if (editor.isOpen(path)) await editor.save(path);
      } catch (err) {
        // arquivo não aberto — segue
      }
    }
  }
  if ((result.files || []).length) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'plan-undo-btn';
    undoBtn.textContent = '↩ Reverter alteração da IA';
    undoBtn.addEventListener('click', async () => {
      undoBtn.disabled = true;
      undoBtn.textContent = 'Revertendo…';
      try {
        const restored = await agentManager.undoLastPlan();
        for (const path of result.files || []) {
          if (editor.isOpen(path)) await editor.openFile(path, { force: true });
        }
        await tree.render();
        refreshDiff();
        notify.toast(`Alterações revertidas: ${restored.length} arquivo(s)`, { position: 'center' });
      } catch (err) {
        notify.toast(`Erro ao reverter: ${err.message}`, { position: 'center' });
      }
    });
    bubble.appendChild(undoBtn);
  }
}

// Renderiza o checklist do plano com "Aprovar passo" e "Aprovar tudo".
function renderPlanChecklist(bubble, plan) {
  const wrap = document.createElement('div');
  wrap.className = 'plan-check';
  const title = document.createElement('div');
  title.className = 'plan-title';
  title.textContent = `Plano de ${(plan.tools || []).length} passo(s) — aprovar antes de executar:`;
  wrap.appendChild(title);
  const rows = [];
  (plan.tools || []).forEach((t, i) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'plan-step';
    const what = t.tool === 'write_file' ? 'criar/editar' : t.tool;
    row.textContent = `${i + 1}. ${what} ${t.args?.path || ''}`;
    row.addEventListener('click', async () => {
      row.disabled = true;
      await runPlanStep(plan, i, row);
    });
    rows.push(row);
    wrap.appendChild(row);
  });
  const approveAll = document.createElement('button');
  approveAll.type = 'button';
  approveAll.className = 'plan-approve-all';
  approveAll.textContent = '✔ Aprovar tudo';
  approveAll.addEventListener('click', async () => {
    approveAll.disabled = true;
    rows.forEach((r) => (r.disabled = true));
    await runPlanAll(plan);
  });
  wrap.appendChild(approveAll);
  bubble.appendChild(wrap);
}

async function runPlanStep(plan, i, row) {
  try {
    const res = await agentManager.executePlan(plan, { only: i });
    row.classList.add('plan-done');
    row.textContent = `${i + 1}. ✔ executado`;
    notify.toast(`Passo ${i + 1} executado — revise no Diff.`, { position: 'center' });
    const stillPending = document.querySelectorAll('.plan-check .plan-step:not(.plan-done)').length;
    if (stillPending === 0) {
      await applyExecutionResult(row.closest('.message-bubble'), res);
      refreshDiff();
    }
  } catch (err) {
    notify.toast(`Erro no passo: ${err.message}`, { position: 'center' });
    row.disabled = false;
  }
}

async function runPlanAll(plan) {
  try {
    const res = await agentManager.executePlan(plan);
    const bubble = document.querySelector('.plan-check')?.closest('.message-bubble');
    if (bubble) await applyExecutionResult(bubble, res);
    refreshDiff();
    notify.toast('Plano executado — revise no Diff.', { position: 'center' });
  } catch (err) {
    notify.toast(`Erro ao executar o plano: ${err.message}`, { position: 'center' });
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
    // S33: passa o histórico recente + lista de arquivos do VFS como contexto.
    const filesList = (await vfs.listDir('')).files.map((f) => f.path);
    // S34: intenção de "ver o site" → abre o Preview, não regenera arquivos.
    if (detectViewIntent(text)) {
      finalText = await handleViewIntent(text, filesList, {
        onPreview: (path) => {
          viewer.openFile(path);
          showPane('preview');
          closeDrawer();
        },
      });
      renderMarkdownTo(textEl, finalText);
    } else {
      const result = await agentManager.sendPrompt({
        text,
        uid: authViews?.user?.uid || null,
        signal: currentAbort.signal,
        history: chatHistory.slice(-8),
        filesList,
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
      // S31: texto principal = message extraído (nunca o JSON cru do stream).
      finalText = buildFinalText(result, text);
      textEl.textContent = '';
      renderMarkdownTo(textEl, finalText);
      const bubble = reply.querySelector('.message-bubble');
      // S42: modo `ask` → checklist de aprovação; senão → chips + undo + diff.
      if (result.plan) {
        renderPlanChecklist(bubble, result.plan);
      } else {
        await applyExecutionResult(bubble, result);
      }
      // S31: JSON cru (se houver) vai em <details> de debug via textContent.
      if (buf && result.message && !result.truncated) bubble.appendChild(debugRawDetails(buf));
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
        bubble.appendChild(contBtn);
      }
      if (thinkOn && (thinking || result.thinking)) {
        ensureThinkingBox(reply, thinking || result.thinking, true);
      }
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

// ============================================================
// S31 — Renderização do chat (chips, debug JSON e texto final)
// agora vive em ui/chat-renderer.js (ver imports no topo).
// ============================================================

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

// S24: aguarda o GitHub Pages responder 200 (HEAD a cada 5s, até 5min).
async function waitForPagesLive(url, timeout = 300000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      if (res.type === 'opaque' || res.ok) return true;
    } catch (err) {
      // ainda construindo → continua
    }
    if (Date.now() - start >= timeout) return false;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

function setDeploying(busy) {
  const btn = document.getElementById('deploy-btn');
  if (!btn) return;
  btn.classList.toggle('deploying', busy);
  btn.disabled = busy;
  const label = btn.querySelector('span');
  if (label) label.textContent = busy ? 'Publicando…' : 'Deploy';
  // S30: barra de progresso (XP) durante o deploy
  const bar = document.getElementById('deploy-xp');
  const fill = document.getElementById('deploy-xp-fill');
  if (bar && fill) {
    bar.hidden = !busy;
    if (busy) {
      fill.style.transition = 'none';
      fill.style.width = '5%';
      requestAnimationFrame(() => {
        fill.style.transition = 'width 4s ease-out';
        fill.style.width = '90%';
      });
    } else {
      fill.style.width = '100%';
      setTimeout(() => { fill.style.width = '0%'; }, 300);
    }
  }
}

// S24: exporta o projeto como ZIP (JSZip) — VFS sem .git
async function exportProjectAsZip() {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const allFiles = await vfs.listAllFiles();
  let count = 0;
  for (const p of allFiles) {
    if (p.startsWith('.git/')) continue;
    const { content } = await vfs.readFile(p);
    zip.file(p, content);
    count += 1;
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mvp-${slugify(new Date().toISOString().slice(0, 10))}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return count;
}

async function deployProject() {
  if (!authViews?.user || authViews.devMode) {
    notify.toast('Faça login para publicar seu MVP', { position: 'center' });
    throw new Error('Login necessário');
  }
  if (document.getElementById('deploy-btn')?.disabled) return; // evita duplo clique
  setDeploying(true);
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
    // S36: salva o snapshot do projeto ativo (ou cria um novo) e marca como publicado
    try {
      const activeId = await projectService.getActiveProjectId();
      if (activeId) {
        await projectService.saveProjectSnapshot(activeId);
        await projectService.markDeployed(activeId, json.url);
      } else {
        const proj = await projectService.createFromWorkspace(projectName);
        await projectService.markDeployed(proj.id, json.url);
      }
    } catch (err) {
      // falha ao salvar local não impede o deploy
    }
    // S24: espera o Pages ficar online antes do toast de sucesso.
    // Toast persistente (duration:0): não some enquanto o Pages compila.
    const buildingToast = notify.toast('O GitHub está construindo seu MVP… (até 5min)', { position: 'center', duration: 0 });
    const live = await waitForPagesLive(json.url);
    buildingToast.close();
    if (!live) {
      notify.toast(`Deploy enviado, mas o Pages ainda está construindo. ${json.url}`, {
        position: 'center',
        duration: 0,
        button: { text: 'Abrir', onClick: () => window.open(json.url, '_blank') },
      });
      return json.url;
    }
    // Sucesso persistente: o usuário tem tempo de clicar em "Abrir". A URL
    // também fica salva no dashboard (seção "Publicados no GitHub").
    notify.toast(`MVP publicado! Ficou salvo no dashboard.`, {
      position: 'center',
      duration: 0,
      button: { text: 'Abrir', onClick: () => window.open(json.url, '_blank') },
    });
    // S29: conquista + partículas de deploy
    notify.achievement({ title: 'DEPLOY DESBLOQUEADO!', message: json.url });
    notify.particles.emit(window.innerWidth / 2, window.innerHeight / 3, 'deploy');
    return json.url;
  } catch (err) {
    notify.toast(`Deploy falhou: ${err.message}`, { position: 'center' });
    throw err;
  } finally {
    setDeploying(false);
  }
}

// S9: limpa o workspace para começar um novo MVP
async function resetWorkspace() {
  const ok = await confirmDialog('Apagar todos os arquivos (README, src, uploads, .git) e começar um novo MVP?', 'Novo projeto');
  if (!ok) return;
  try {
    await projectService.setActiveProject('');
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

  // S36: abre a IDE já com o workspace do projeto restaurado.
  const openIde = async ({ projectId } = {}) => {
    if (projectId) {
      try {
        await projectService.openProject(projectId);
      } catch (err) {
        notify.toast(`Erro ao carregar projeto: ${err.message}`, { position: 'center' });
      }
    }
    agentManager.mode = authViews.user && !authViews.devMode ? AGENT_MODE.LIVE : AGENT_MODE.DEMO;
    // S42: permissão por projeto (ask/review/auto) persistida em metadata.
    const activeId = projectId || (await projectService.getActiveProjectId());
    agentManager.setActiveProjectId(activeId);
    await agentManager.loadPermission(activeId);
    syncPermButtons();
    authViews.show('ide');
    for (const f of [...editor.openFiles]) await editor.forceRemove(f.path);
    await tree.render();
    $chatMessages.innerHTML = '';
    const history = await loadChatHistory();
    chatHistory = history;
    for (const entry of history) {
      addMessage(entry.text, { type: entry.type === 'user' ? 'user' : 'received' });
    }
    gitPanel.refresh();
  };

  authViews = new AuthViews({
    notify,
    onEnterIde: () => openIde(),
    onOpenProject: async (id) => {
      await openIde({ projectId: id });
      authViews.show('ide');
    },
    onEditorPrefsChange: (prefs) => editor.applyPrefs(prefs),
  });
  await authViews.init();
}

// ============================================================
// S25: PWA & Offline — storage pressure, persist(), badge offline
// ============================================================

// S30: efeito CRT opcional (duplo toque no logo da IDE ativa/desativa)
(function setupCrtToggle() {
  const logo = document.querySelector('.ide-logo');
  if (!logo) return;
  let lastTap = 0;
  logo.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 350) {
      document.body.classList.toggle('crt-effect');
      notify.toast(document.body.classList.contains('crt-effect') ? 'Modo CRT ativado' : 'Modo CRT desativado', { position: 'center' });
    }
    lastTap = now;
  });
  logo.addEventListener('dblclick', () => {
    document.body.classList.toggle('crt-effect');
    notify.toast(document.body.classList.contains('crt-effect') ? 'Modo CRT ativado' : 'Modo CRT desativado', { position: 'center' });
  });
})();

const offlineBadge = document.getElementById('offline-badge');
function updateOfflineBadge() {
  const offline = !navigator.onLine;
  offlineBadge?.classList.toggle('hidden', !offline);
}
window.addEventListener('online', updateOfflineBadge);
window.addEventListener('offline', updateOfflineBadge);

// pede persistência do storage (reduz risco de eviction no iOS Safari)
async function requestStoragePersist() {
  try {
    if (navigator.storage?.persist) {
      const granted = await navigator.storage.persist();
      if (!granted) {
        // apenas informativo — não bloqueia
        console.info('[CAIM] storage não-persistente; commits frequentes recomendados.');
      }
    }
  } catch (err) {
    // API indisponível — degrada silencioso
  }
}

// aviso quando o dispositivo está perto do limite de storage
async function checkStoragePressure() {
  try {
    if (!navigator.storage?.estimate) return;
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    if (quota > 0 && usage / quota > 0.9) {
      notify.toast('Seu dispositivo está sem espaço — faça commit e push para não perder código.', { position: 'center' });
    }
  } catch (err) {
    // degrada silencioso
  }
}

bootstrap()
  .then(() => {
    requestStoragePersist();
    checkStoragePressure();
    updateOfflineBadge();
  })
  .catch((err) => console.error('[CAIM] bootstrap failed', err));

// ============================================================
// PWA update (vite-plugin-pwa)
// ============================================================

const updateSW = registerSW({
  onNeedRefresh() {
    // Sem toast automático: o usuário atualiza pelo botão manual
    // ("Atualizar para a última versão") na IDE.
  },
  onOfflineReady() {
    notify.toast('App pronto para uso offline', { position: 'center' });
  },
});

// Limpa o cache do Service Worker e recarrega a versão mais recente.
async function updateAppToLatest() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch (err) {
    // cache não acessível — segue com o update normal
  }
  updateSW(true);
  setTimeout(() => location.reload(), 250);
}

document.getElementById('app-update-btn')?.addEventListener('click', () => updateAppToLatest());
document.getElementById('settings-update')?.addEventListener('click', () => updateAppToLatest());
