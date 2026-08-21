import { vfs } from '../core/vfs-service.js';
import { getFileIcon } from './file-icons.js';

// S38 — Busca fuzzy (go-to-file) + Find & Replace global no explorer.

const BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|avif|pdf|docx?|xlsx?|pptx?|zip|tar|gz|7z|rar|woff2?|ttf|otf|eot|mp3|mp4|avi|mov|mkv|bin|exe|dll|so|dylib)$/i;
const X_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

function basename(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

function subsequence(haystack, needle) {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

// Score de um path contra a query: exact > basename startsWith > basename
// contains > path startsWith > path contains > subsequência. 0 = sem match.
export function scoreFile(path, query) {
  const q = String(query).trim().toLowerCase();
  if (!q) return 0;
  const p = path.toLowerCase();
  const b = basename(p);
  if (p === q || b === q) return 100;
  if (b.startsWith(q)) return 80;
  if (b.includes(q)) return 70;
  if (p.startsWith(q)) return 60;
  const at = p.indexOf(q);
  if (at !== -1) return 50 - Math.min(at, 40);
  if (subsequence(p.replace(/[^a-z0-9]/g, ''), q.replace(/[^a-z0-9]/g, ''))) return 30;
  return 0;
}

export function isTextPath(path) {
  if (path.startsWith('.git/')) return false;
  if (BINARY_EXT.test(path)) return false;
  return true;
}

// Encontra ocorrências de `query` (case-insensitive) no conteúdo, com linha/
// coluna 1-based e o texto da linha. Cap protege contra arquivos gigantes.
export function findMatches(content, query, cap = 100) {
  const q = String(query);
  if (!q) return [];
  const needle = q.toLowerCase();
  const lower = content.toLowerCase();
  const matches = [];
  let idx = 0;
  let line = 1;
  let col = 1;
  let lineStart = 0;
  while (idx < content.length && matches.length < cap) {
    const found = lower.indexOf(needle, idx);
    if (found === -1) break;
    for (let i = idx; i < found; i++) {
      if (content.charCodeAt(i) === 10) {
        line++;
        col = 1;
        lineStart = i + 1;
      } else {
        col++;
      }
    }
    const eol = content.indexOf('\n', found);
    const lineText = content.slice(lineStart, eol === -1 ? content.length : eol);
    matches.push({ line, column: col, text: lineText });
    idx = found + needle.length;
    col += needle.length;
  }
  return matches;
}

// Busca a query em todos os arquivos de texto do VFS (ignora .git/, binários
// e data URLs de upload). Resultado: [{ path, matches:[{line,column,text}] }].
export async function findInFiles(query) {
  const q = String(query).trim();
  if (!q) return [];
  const paths = await vfs.listAllFiles();
  const results = [];
  for (const path of paths) {
    if (!isTextPath(path)) continue;
    let content;
    try {
      ({ content } = await vfs.readFile(path));
    } catch {
      continue;
    }
    if (typeof content !== 'string' || content.startsWith('data:')) continue;
    const matches = findMatches(content, q);
    if (matches.length) results.push({ path, matches });
  }
  return results;
}

// Substitui todas as ocorrências nos arquivos que casam. Retorna resumo.
export async function replaceInFiles(query, replacement) {
  const q = String(query);
  if (!q) return { files: 0, occurrences: 0 };
  const results = await findInFiles(q);
  let files = 0;
  let occurrences = 0;
  for (const r of results) {
    const { content } = await vfs.readFile(r.path);
    const next = content.split(q).join(String(replacement));
    if (next !== content) {
      await vfs.writeFile(r.path, next);
      files++;
      occurrences += r.matches.length;
    }
  }
  return { files, occurrences };
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export class SearchPanel {
  constructor({ container, notify, onOpenFile, onClose }) {
    this.container = container;
    this.notify = notify;
    this.onOpenFile = onOpenFile;
    this.onClose = onClose;
    this.mode = 'files';
    this.paths = [];
    this.sequence = 0;
    this.build();
    this.refreshPaths();
  }

  async refreshPaths() {
    this.paths = (await vfs.listAllFiles()).filter((p) => isTextPath(p));
  }

  build() {
    this.container.innerHTML = '';

    const header = document.createElement('header');
    header.className = 'pane-header drawer-header';
    const title = document.createElement('span');
    title.className = 'pane-title';
    title.textContent = 'Buscar';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ide-icon-btn';
    closeBtn.setAttribute('aria-label', 'Fechar busca');
    closeBtn.innerHTML = X_ICON;
    closeBtn.addEventListener('click', () => this.onClose?.());
    header.append(title, closeBtn);

    const modes = document.createElement('div');
    modes.className = 'search-modes';
    this.filesBtn = this.modeButton('files', 'Arquivos');
    this.findBtn = this.modeButton('find', 'Encontrar');
    modes.append(this.filesBtn, this.findBtn);

    this.input = document.createElement('input');
    this.input.className = 'search-input';
    this.input.placeholder = 'Buscar arquivos… ex.: app.js';
    this.input.setAttribute('aria-label', 'Buscar arquivos');
    this.input.addEventListener('input', this.debouncedRun());
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.openFirstResult();
    });

    this.replaceWrap = document.createElement('div');
    this.replaceWrap.className = 'search-replace-wrap hidden';
    this.replaceInput = document.createElement('input');
    this.replaceInput.className = 'search-input';
    this.replaceInput.placeholder = 'Substituir por…';
    this.replaceInput.setAttribute('aria-label', 'Substituir por');
    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'pixel-btn pixel-btn-primary';
    replaceBtn.textContent = 'Substituir todos';
    replaceBtn.addEventListener('click', () => this.replaceAll());
    this.replaceWrap.append(this.replaceInput, replaceBtn);

    this.results = document.createElement('div');
    this.results.className = 'search-results';

    const body = document.createElement('div');
    body.className = 'search-body';
    body.append(modes, this.input, this.replaceWrap, this.results);
    this.container.append(header, body);
  }

  modeButton(mode, label) {
    const btn = document.createElement('button');
    btn.className = 'search-mode' + (this.mode === mode ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => {
      this.mode = mode;
      this.filesBtn.classList.toggle('active', mode === 'files');
      this.findBtn.classList.toggle('active', mode === 'find');
      this.replaceWrap.classList.toggle('hidden', mode !== 'find');
      this.input.placeholder = mode === 'files' ? 'Buscar arquivos… ex.: app.js' : 'Encontrar no código…';
      this.run();
    });
    return btn;
  }

  debouncedRun() {
    const run = debounce(() => this.run(), 180);
    return run;
  }

  async run() {
    const q = this.input.value.trim();
    if (this.mode === 'files') {
      this.renderFiles(q);
    } else {
      this.renderFind(q);
    }
  }

  renderFiles(q) {
    const results = this.results;
    results.innerHTML = '';
    if (!q) {
      const empty = document.createElement('div');
      empty.className = 'pane-empty';
      empty.textContent = 'Digite para buscar arquivos (ex.: app.js, index, style).';
      results.appendChild(empty);
      return;
    }
    const hits = this.paths
      .map((p) => ({ path: p, score: scoreFile(p, q) }))
      .filter((h) => h.score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, 30);
    if (!hits.length) {
      const empty = document.createElement('div');
      empty.className = 'pane-empty';
      empty.textContent = 'Nenhum arquivo encontrado.';
      results.appendChild(empty);
      return;
    }
    for (const hit of hits) {
      const row = document.createElement('button');
      row.className = 'search-hit';
      row.type = 'button';
      row.addEventListener('click', () => this.onOpenFile(hit.path));
      const icon = getFileIcon(hit.path);
      const iconEl = document.createElement('span');
      iconEl.className = `ft-icon ${icon.cls}`;
      iconEl.innerHTML = icon.svg;
      const meta = document.createElement('span');
      meta.className = 'search-hit-meta';
      const name = document.createElement('span');
      name.className = 'search-hit-name';
      name.textContent = basename(hit.path);
      const pathEl = document.createElement('span');
      pathEl.className = 'search-hit-path';
      pathEl.textContent = hit.path;
      meta.append(name, pathEl);
      row.append(iconEl, meta);
      results.appendChild(row);
    }
  }

  async renderFind(q) {
    const results = this.results;
    results.innerHTML = '';
    if (!q) {
      const empty = document.createElement('div');
      empty.className = 'pane-empty';
      empty.textContent = 'Digite um termo para buscar no código de todos os arquivos.';
      results.appendChild(empty);
      return;
    }
    const seq = ++this.sequence;
    const searching = document.createElement('div');
    searching.className = 'pane-empty';
    searching.textContent = 'Buscando…';
    results.appendChild(searching);
    const data = await findInFiles(q);
    if (seq !== this.sequence) return; // resultado obsoleto (digitação nova)
    results.innerHTML = '';
    if (!data.length) {
      const empty = document.createElement('div');
      empty.className = 'pane-empty';
      empty.textContent = 'Nenhuma ocorrência encontrada.';
      results.appendChild(empty);
      return;
    }
    let shown = 0;
    const MAX_ROWS = 60;
    for (const file of data) {
      if (shown >= MAX_ROWS) break;
      const group = document.createElement('div');
      group.className = 'search-file';
      const head = document.createElement('div');
      head.className = 'search-file-head';
      head.textContent = `${file.path} — ${file.matches.length}`;
      group.appendChild(head);
      for (const m of file.matches) {
        if (shown >= MAX_ROWS) break;
        shown++;
        const row = document.createElement('button');
        row.className = 'search-match';
        row.type = 'button';
        row.addEventListener('click', () => this.onOpenFile(file.path));
        const line = document.createElement('span');
        line.className = 'search-match-line';
        line.textContent = `L${m.line}:`;
        const text = document.createElement('span');
        text.className = 'search-match-text';
        text.textContent = m.text.trim() || '(linha em branco)';
        row.append(line, text);
        group.appendChild(row);
      }
      results.appendChild(group);
    }
    const summary = document.createElement('div');
    summary.className = 'search-summary';
    const total = data.reduce((acc, f) => acc + f.matches.length, 0);
    summary.textContent = `${data.length} arquivo(s) · ${total} ocorrência(s)`;
    results.appendChild(summary);
  }

  openFirstResult() {
    if (this.mode !== 'files') return;
    const first = this.results.querySelector('.search-hit');
    if (first) first.click();
  }

  async replaceAll() {
    const q = this.input.value.trim();
    const replacement = this.replaceInput.value;
    if (!q) {
      this.notify?.toast('Digite o termo a substituir.', { position: 'center' });
      return;
    }
    const preview = await findInFiles(q);
    const total = preview.reduce((acc, f) => acc + f.matches.length, 0);
    if (!total) {
      this.notify?.toast('Nenhuma ocorrência encontrada.', { position: 'center' });
      return;
    }
    const apply = async () => {
      const { files, occurrences } = await replaceInFiles(q, replacement);
      this.notify?.toast(`Substituído: ${occurrences} ocorrência(s) em ${files} arquivo(s).`, { position: 'center' });
      await this.refreshPaths();
      await this.run();
    };
    if (this.notify?.confirm) {
      this.notify.confirm(
        `Substituir "${q}" por "${replacement}" em ${total} ocorrência(s)?`,
        'Substituir em todos os arquivos',
        apply
      );
    } else {
      await apply();
    }
  }
}