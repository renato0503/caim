import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor } from '@codemirror/view';
import { EditorState, Compartment, Transaction } from '@codemirror/state';
import { history, defaultKeymap, historyKeymap, indentWithTab, undo, redo } from '@codemirror/commands';
import { indentOnInput, bracketMatching } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { vfs } from '../core/vfs-service.js';
import { loadEditorPrefs, saveEditorPrefs, DEFAULT_PREFS } from '../core/editor-prefs.js';
import { findSnippet, wordBeforeCursor, langFromPath } from '../core/snippets.js';

const SAVE_DEBOUNCE = 800;

// S39 — tema claro (EditorView.theme leve) usado quando prefs.theme === 'light'.
const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#ffffff', color: '#0f172a' },
    '.cm-gutters': { backgroundColor: '#f1f5f9', color: '#64748b', borderRight: '1px solid #e2e8f0' },
    '.cm-activeLine': { backgroundColor: 'rgba(13,148,136,0.08)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(13,148,136,0.25)',
    },
  },
  { dark: false }
);

function fontTheme(fontSize, fontFamily) {
  const family =
    fontFamily === 'pixel'
      ? 'var(--font-pixel)'
      : fontFamily === 'mono' || !fontFamily
        ? 'var(--font-code)'
        : fontFamily;
  return EditorView.theme({
    '&': { fontSize: `${Number(fontSize) || 14}px`, fontFamily: family },
  });
}

// S10: setup mínimo (sem autocomplete/lint/search — recorte grande de bundle).
// A toolbar flutuante já cobre parênteses/chaves/tab no iOS.
const MINIMAL_SETUP = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightActiveLine(),
  history(),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
];

async function loadLanguage(path) {
  const ext = vfs.constructor.extname(path);
  switch (ext) {
    case '.js': case '.mjs': case '.jsx': case '.ts': case '.tsx': {
      const m = await import('@codemirror/lang-javascript');
      return m.javascript();
    }
    case '.py': {
      const m = await import('@codemirror/lang-python');
      return m.python();
    }
    case '.html': case '.htm': case '.vue': {
      const m = await import('@codemirror/lang-html');
      return m.html();
    }
    case '.css': case '.scss': case '.less': {
      const m = await import('@codemirror/lang-css');
      return m.css();
    }
    case '.json': {
      const m = await import('@codemirror/lang-json');
      return m.json();
    }
    case '.md': case '.markdown': {
      const m = await import('@codemirror/lang-markdown');
      return m.markdown();
    }
    default:
      return [];
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export class CodeEditor {
  constructor({ container, tabsEl, statusEl }) {
    this.container = container;
    this.tabsEl = tabsEl;
    this.statusEl = statusEl;
    this.openFiles = []; // { path, content, savedContent, selection, scrollTop, dirty }
    this.activePath = null;
    this.langCompartment = new Compartment();
    this.themeCompartment = new Compartment();
    this.fontCompartment = new Compartment();
    this.snippetKeymap = new Compartment();
    this.prefs = { ...DEFAULT_PREFS };
    this.saveTimers = new Map();
    this.saving = new Set();
    this.createView();
    this.setupFloatingToolbar();
    this.initPrefs();
  }

  createView() {
    this.view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          MINIMAL_SETUP,
          oneDark,
          this.langCompartment.of([]),
          this.themeCompartment.of(oneDark),
          this.fontCompartment.of(fontTheme(14, 'mono')),
          this.snippetKeymap.of(
            keymap.of([{ key: 'Mod-Space', run: () => this.expandSnippetAtCursor() }])
          ),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && this.activePath) {
              const programmatic = update.transactions.some(
                (tr) => tr.annotation(Transaction.userEvent) === 'programmatic'
              );
              if (!programmatic) this.markDirty(this.activePath);
            }
          }),
        ],
      }),
      parent: this.container,
    });
  }

  get tab() {
    return this.openFiles.find((f) => f.path === this.activePath);
  }

  async openFile(path, { force = false } = {}) {
    // Guard contra chamadas concorrentes do mesmo path (vfs:changed + handler
    // do botão podem disparar openFile quase juntos → 2 abas duplicadas).
    if (this._opening?.has(path)) {
      await this._opening.get(path);
      if (this.openFiles.find((f) => f.path === path)) {
        this.activePath = path;
        await this.loadActive();
        this.renderTabs();
        return;
      }
    }
    if (!this._opening) this._opening = new Map();
    const pending = this.openFileInner(path, { force });
    this._opening.set(path, pending);
    try {
      await pending;
    } finally {
      this._opening.delete(path);
    }
  }

  async openFileInner(path, { force = false } = {}) {
    let file = this.openFiles.find((f) => f.path === path);
    if (!file) {
      const { content } = await vfs.readFile(path);
      file = { path, content, savedContent: content, selection: null, scrollTop: 0, dirty: false };
      this.openFiles.push(file);
      await this.refreshIfStale(file);
    } else if ((force || !file.dirty) && file.path !== this.activePath) {
      await this.refreshIfStale(file);
    }
    this.activePath = path;
    await this.loadActive();
    this.renderTabs();
    this.setStatus('Pronto');
  }

  isOpen(path) {
    return !!this.openFiles.find((f) => f.path === path);
  }

  async refreshIfStale(file) {
    const { content, lastModified } = await vfs.readFile(file.path);
    if (!file.savedAt || lastModified > file.savedAt) {
      file.content = content;
      file.savedContent = content;
      file.savedAt = lastModified;
      file.dirty = false;
    }
  }

  async loadActive() {
    const file = this.tab;
    if (!file) return;
    const lang = await loadLanguage(file.path);
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: file.content },
      selection: file.selection || undefined,
      effects: this.langCompartment.reconfigure(lang),
      annotations: Transaction.userEvent.of('programmatic'),
    });
    if (file.scrollTop) {
      requestAnimationFrame(() => {
        this.view.scrollDOM.scrollTop = file.scrollTop;
      });
    }
    this.view.focus();
  }

  markDirty(path) {
    const file = this.openFiles.find((f) => f.path === path);
    if (!file) return;
    file.dirty = true;
    file.content = this.view.state.doc.toString();
    file.selection = this.view.state.selection;
    file.scrollTop = this.view.scrollDOM.scrollTop;
    this.renderTabs();
    this.setStatus('Editando...');
    this.scheduleSave(path);
  }

  scheduleSave(path) {
    clearTimeout(this.saveTimers.get(path));
    const timer = setTimeout(() => this.save(path), SAVE_DEBOUNCE);
    this.saveTimers.set(path, timer);
  }

  async save(path) {
    const file = this.openFiles.find((f) => f.path === path);
    if (!file || !file.dirty || this.saving.has(path)) return;
    this.saving.add(path);
    this.setStatus('Salvando...');
    try {
      const result = await vfs.writeFile(path, file.content);
      const { lastModified } = await vfs.readFile(path);
      file.dirty = false;
      file.savedAt = lastModified;
      file.savedContent = file.content;
      this.setStatus(`Salvo (${result.created ? 'criado' : 'atualizado'})`);
    } catch (err) {
      this.setStatus(`Erro ao salvar: ${err.message}`);
    } finally {
      this.saving.delete(path);
      this.renderTabs();
    }
  }

  async saveActive() {
    if (this.activePath) await this.save(this.activePath);
  }

  // S5: aplica um conteúdo vindo do diff (aceito/rejeitado) ao editor + VFS
  async applyContent(path, content, { saved = false } = {}) {
    const file = this.openFiles.find((f) => f.path === path);
    if (!file) return;
    file.content = content;
    if (saved) {
      file.savedContent = content;
      file.dirty = false;
      file.savedAt = Date.now();
      await vfs.writeFile(path, content);
    } else {
      file.dirty = true;
    }
    if (file.path === this.activePath) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: content },
        effects: this.langCompartment.reconfigure(await loadLanguage(file.path)),
        annotations: Transaction.userEvent.of('programmatic'),
      });
    }
    this.renderTabs();
    this.setStatus(saved ? 'Alteração aplicada' : 'Bloco rejeitado');
  }

  // S5: descarta as alterações e volta ao estado salvo
  async revert(path) {
    const file = this.openFiles.find((f) => f.path === path);
    if (!file) return;
    file.content = file.savedContent;
    file.dirty = false;
    file.selection = null;
    if (file.path === this.activePath) {
      this.view.dispatch({
        changes: { from: 0, to: this.view.state.doc.length, insert: file.content },
        effects: this.langCompartment.reconfigure(await loadLanguage(file.path)),
        annotations: Transaction.userEvent.of('programmatic'),
      });
    }
    this.renderTabs();
    this.setStatus('Alterações descartadas');
  }

  // S5: lista de arquivos abertos com mudanças não salvas
  getDiffCandidates() {
    return this.openFiles
      .filter((f) => f.dirty)
      .map((f) => ({ path: f.path, oldContent: f.savedContent, newContent: f.content }));
  }

  // S22: arquivos abertos para injetar como contexto no agente — até 16KB,
  // priorizando: 1) arquivo ativo, 2) sujos, 3) .json de config, 4) demais.
  // Corta do menos relevante em vez de truncar o mais importante no meio.
  getOpenFilesContext(maxBytes = 16384) {
    const score = (f) => {
      let s = 0;
      if (f.path === this.activePath) s += 100;
      if (f.dirty) s += 40;
      if (/\.(json|config|yaml|yml)$/.test(f.path)) s += 15;
      return s;
    };
    const sorted = [...this.openFiles].sort((a, b) => score(b) - score(a));
    const parts = [];
    let total = 0;
    for (const f of sorted) {
      if (!f.path || typeof f.content !== 'string') continue;
      const chunk = f.content.slice(0, 4000);
      if (total + chunk.length > maxBytes) break;
      total += chunk.length;
      parts.push({ path: f.path, content: chunk });
    }
    return parts;
  }

  // S23/J4: o arquivo aberto tem edições não salvas (dirty)?
  isDirty(path) {
    return !!this.openFiles.find((f) => f.path === path)?.dirty;
  }

  // S23/J4: mantém as alterações locais após um vfs:changed externo —
  // marca o arquivo como "stale" para o próximo openFile recarregar do VFS.
  markStale(path) {
    const file = this.openFiles.find((f) => f.path === path);
    if (file) file.savedAt = 0;
  }

  async closeFile(path) {
    const file = this.openFiles.find((f) => f.path === path);
    if (!file) return;
    if (file.dirty) await this.save(path);
    this.openFiles = this.openFiles.filter((f) => f.path !== path);
    if (this.activePath === path) {
      const next = this.openFiles[this.openFiles.length - 1];
      this.activePath = next ? next.path : null;
      if (next) {
        await this.refreshIfStale(next);
        await this.loadActive();
      } else {
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: '' },
          effects: this.langCompartment.reconfigure([]),
          annotations: Transaction.userEvent.of('programmatic'),
        });
        this.setStatus('Nenhum arquivo aberto');
      }
    }
    this.renderTabs();
  }

  // S3: remove um arquivo aberto sem salvar (ex.: arquivo excluído no Explorer)
  async forceRemove(path) {
    this.openFiles = this.openFiles.filter((f) => f.path !== path);
    this.saveTimers.delete(path);
    if (this.activePath === path) {
      const next = this.openFiles[this.openFiles.length - 1];
      this.activePath = next ? next.path : null;
      if (next) {
        await this.refreshIfStale(next);
        await this.loadActive();
      } else {
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: '' },
          effects: this.langCompartment.reconfigure([]),
          annotations: Transaction.userEvent.of('programmatic'),
        });
        this.setStatus('Nenhum arquivo aberto');
      }
    }
    this.renderTabs();
  }

  renderTabs() {
    if (!this.tabsEl) return;
    this.tabsEl.innerHTML = '';
    if (this.openFiles.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'editor-tab-empty';
      empty.textContent = 'Selecione um arquivo no Explorer';
      this.tabsEl.appendChild(empty);
      return;
    }
    for (const file of this.openFiles) {
      const tab = document.createElement('button');
      tab.className = 'editor-tab' + (file.path === this.activePath ? ' active' : '') + (file.dirty ? ' dirty' : '');
      tab.addEventListener('click', () => this.openFile(file.path));
      const name = document.createElement('span');
      name.className = 'editor-tab-name';
      name.textContent = vfs.constructor.basename(file.path);
      name.title = file.path;
      const close = document.createElement('span');
      close.className = 'editor-tab-close';
      close.textContent = '×';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeFile(file.path);
      });
      tab.appendChild(name);
      tab.appendChild(close);
      this.tabsEl.appendChild(tab);
    }
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  // ============================================================
  // S39 — Preferências do editor (tema / fonte / snippets)
  // ============================================================

  currentLang() {
    return this.activePath ? langFromPath(this.activePath) : '';
  }

  async initPrefs() {
    this.prefs = await loadEditorPrefs();
    this.applyPrefs(this.prefs);
  }

  async getPrefs() {
    return { ...this.prefs };
  }

  applyPrefs(prefs) {
    this.prefs = { ...DEFAULT_PREFS, ...(prefs || {}), snippets: prefs?.snippets || [] };
    const themeExt = this.prefs.theme === 'light' ? lightTheme : oneDark;
    this.view.dispatch({
      effects: [
        this.themeCompartment.reconfigure(themeExt),
        this.fontCompartment.reconfigure(fontTheme(this.prefs.fontSize, this.prefs.fontFamily)),
      ],
    });
  }

  async savePrefs(patch) {
    this.prefs = { ...this.prefs, ...(patch || {}) };
    this.applyPrefs(this.prefs);
    await saveEditorPrefs(this.prefs);
    return { ...this.prefs };
  }

  // Expande a palavra antes do cursor se ela casar com um snippet (Mod-Space /
  // atalho do teclado externo). Retorna o snippet aplicado ou null.
  expandSnippetAtCursor() {
    if (!this.activePath) return false;
    const { from, to } = this.view.state.selection.main;
    const { word, from: wordFrom } = wordBeforeCursor(this.view.state.doc, from);
    if (!word) return false;
    const snippet = findSnippet(word, this.currentLang(), this.prefs.snippets);
    if (!snippet) return false;
    this.view.dispatch({
      changes: { from: wordFrom, to, insert: snippet.content },
      annotations: Transaction.userEvent.of('programmatic'),
    });
    this.setStatus(`Snippet: ${snippet.description || snippet.trigger}`);
    this.markDirty(this.activePath);
    return true;
  }

  insertSnippet(snippet) {
    if (!this.activePath) return false;
    const { from } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, insert: snippet.content },
      selection: { anchor: from + snippet.content.length },
      scrollIntoView: true,
      annotations: Transaction.userEvent.of('programmatic'),
    });
    this.markDirty(this.activePath);
    return true;
  }

  // Picker de snippets: lista os disponíveis para a linguagem atual (botão ⚡
  // da toolbar flutuante + customizados). Tocar insere no cursor.
  openSnippetPicker() {
    this.closeSnippetPicker();
    if (!this.activePath) return;
    const lang = this.currentLang();
    const all = [...(this.prefs.snippets || []), ...DEFAULT_SNIPPETS];
    const visible = all.filter((s) => !s.lang || s.lang === '*' || s.lang === lang);
    const picker = document.createElement('div');
    picker.className = 'snippet-picker';
    picker.id = 'snippet-picker';
    const title = document.createElement('div');
    title.className = 'snippet-picker-title';
    title.textContent = `Snippets (${lang || 'qualquer'})`;
    picker.appendChild(title);
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'snippet-picker-empty';
      empty.textContent = 'Nenhum snippet para esta linguagem.';
      picker.appendChild(empty);
    }
    for (const s of visible) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'snippet-picker-item';
      row.addEventListener('click', () => {
        this.insertSnippet(s);
        this.closeSnippetPicker();
        this.view.focus();
      });
      const trigger = document.createElement('span');
      trigger.className = 'snippet-picker-trigger';
      trigger.textContent = s.trigger;
      const desc = document.createElement('span');
      desc.className = 'snippet-picker-desc';
      desc.textContent = s.description || s.trigger;
      row.append(trigger, desc);
      picker.appendChild(row);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'snippet-picker-add';
    add.textContent = '+ Novo snippet';
    add.addEventListener('click', async () => {
      this.closeSnippetPicker();
      await this.addCustomSnippet();
    });
    picker.appendChild(add);
    document.body.appendChild(picker);
    setTimeout(() => {
      document.addEventListener('click', this._onSnippetPickerDocClick = () => this.closeSnippetPicker(), { once: true });
    }, 0);
  }

  closeSnippetPicker() {
    document.getElementById('snippet-picker')?.remove();
    if (this._onSnippetPickerDocClick) {
      document.removeEventListener('click', this._onSnippetPickerDocClick);
      this._onSnippetPickerDocClick = null;
    }
  }

  async addCustomSnippet() {
    if (!this.activePath) return;
    const trigger = await this.prompt('Gatilho do snippet (ex.: meucomp)', 'Novo snippet');
    if (!trigger) return;
    const content = await this.prompt('Conteúdo do snippet (use \\n p/ quebra de linha)', 'Conteúdo');
    if (content == null) return;
    const snippets = [...(this.prefs.snippets || [])];
    const existing = snippets.findIndex((s) => s.trigger === trigger.trim());
    const item = { trigger: trigger.trim(), lang: this.currentLang(), description: trigger.trim(), content: content.replace(/\\n/g, '\n') };
    if (existing >= 0) snippets[existing] = item;
    else snippets.push(item);
    await this.savePrefs({ snippets });
    this.setStatus(`Snippet "${trigger}" salvo`);
  }

  prompt(placeholder, title) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.className = 'editor-prompt-input';
      input.placeholder = placeholder;
      const finish = (value) => {
        overlay.remove();
        resolve(value);
      };
      const ok = () => finish(input.value);
      const cancel = () => finish(null);
      const overlay = document.createElement('div');
      overlay.className = 'editor-prompt';
      const box = document.createElement('div');
      box.className = 'editor-prompt-box';
      const h = document.createElement('div');
      h.className = 'editor-prompt-title';
      h.textContent = title;
      const btns = document.createElement('div');
      btns.className = 'editor-prompt-btns';
      const bOk = document.createElement('button');
      bOk.textContent = 'OK';
      bOk.className = 'pixel-btn pixel-btn-primary';
      const bCancel = document.createElement('button');
      bCancel.textContent = 'Cancelar';
      bCancel.className = 'pixel-btn pixel-btn-ghost';
      bOk.addEventListener('click', ok);
      bCancel.addEventListener('click', cancel);
      btns.append(bOk, bCancel);
      box.append(h, input, btns);
      overlay.appendChild(box);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cancel();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') ok();
        if (e.key === 'Escape') cancel();
      });
      document.body.appendChild(overlay);
      input.focus();
    });
  }

  // ============================================================
  // S4: Keyboard Floating Toolbar (iOS)
  // ============================================================

  setupFloatingToolbar() {
    const bar = document.createElement('div');
    bar.className = 'editor-floating-toolbar';
    bar.id = 'editor-toolbar';
    bar.style.display = 'none';

    const defs = [
      { label: '{ }', insert: '{}', anchorRel: 1 },
      { label: '[ ]', insert: '[]', anchorRel: 1 },
      { label: '( )', insert: '()', anchorRel: 1 },
      { label: '< >', insert: '<>', anchorRel: 1 },
      { label: '=', insert: ' = ', anchorRel: 1 },
      { label: '⇥', insert: '  ', anchorRel: 2 },
      { label: '⚡', snippet: true, title: 'Inserir snippet' },
      { label: '↶', command: undo, title: 'Desfazer' },
      { label: '↷', command: redo, title: 'Refazer' },
    ];

    for (const def of defs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'etf-btn';
      btn.textContent = def.label;
      btn.title = def.title || def.label;
      btn.addEventListener('click', () => {
        if (!this.activePath) return;
        if (def.snippet) {
          this.openSnippetPicker();
          return;
        }
        if (def.command) {
          def.command(this.view);
        } else {
          this.insertAtCursor(def.insert, def.anchorRel);
        }
        this.view.focus();
      });
      bar.appendChild(btn);
    }

    document.body.appendChild(bar);
    this.toolbar = bar;

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.updateToolbar());
      window.visualViewport.addEventListener('scroll', () => this.updateToolbar());
    }
    document.addEventListener('focusin', () => this.updateToolbar());
    document.addEventListener('focusout', () => setTimeout(() => this.updateToolbar(), 0));
    window.addEventListener('scroll', () => this.updateToolbar(), { passive: true });
  }

  insertAtCursor(insert, anchorRel = 0) {
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + insert.length },
      scrollIntoView: true,
    });
    const head = this.view.state.selection.main.head - insert.length + anchorRel;
    this.view.dispatch({
      selection: { anchor: head },
      annotations: Transaction.userEvent.of('programmatic'),
    });
  }

  updateToolbar() {
    const bar = this.toolbar;
    const vv = window.visualViewport;
    if (!bar || !vv) return;
    const editorFocused = this.container.contains(document.activeElement);
    const keyboardLikelyOpen = vv.height < window.innerHeight * 0.7;
    if (editorFocused && keyboardLikelyOpen && this.activePath) {
      const H = bar.offsetHeight || 44;
      bar.style.display = 'flex';
      bar.style.position = 'fixed';
      bar.style.left = '0px';
      bar.style.right = '0px';
      bar.style.bottom = 'auto';
      bar.style.top = `${Math.max(vv.height - H, 0)}px`;
    } else {
      bar.style.display = 'none';
    }
  }
}
