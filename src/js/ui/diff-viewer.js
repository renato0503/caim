import { diffLines } from 'diff';

function splitLines(text) {
  if (!text) return [];
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
}

function normalizeNewlines(text) {
  const t = String(text || '').replace(/\r\n/g, '\n');
  // Garante newline final antes do diff: o `diff` trata a última linha sem
  // \n como uma linha "diferente" mesmo com o mesmo texto (ex.: 'b' vs 'b\n').
  return t.endsWith('\n') ? t : `${t}\n`;
}

function hasTrailingNewline(text) {
  return typeof text === 'string' && text.length > 0 && text.endsWith('\n');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Constrói blocos de alteração (removidas → adicionadas) com números de linha 1-based.
export function buildBlocks(oldContent, newContent) {
  // Normaliza newlines ANTES do diff: o `diff` compara linhas byte a byte e
  // trataria \r\n vs \n como linhas diferentes.
  const parts = diffLines(normalizeNewlines(oldContent), normalizeNewlines(newContent));
  const blocks = [];
  let block = null;
  let oldNum = 1;
  let newNum = 1;

  const flush = () => {
    if (!block) return;
    if (block.removedLines.length) block.oldStart = block.removedLines[0].num;
    if (block.addedLines.length) block.newStart = block.addedLines[0].num;
    if (block.removedLines.length && !block.addedLines.length) block.newStart = block.oldStart;
    if (block.addedLines.length && !block.removedLines.length) block.oldStart = block.newStart;
    block.oldEnd = block.oldStart + block.removedLines.length - 1;
    block.newEnd = block.newStart + block.addedLines.length - 1;
    blocks.push(block);
    block = null;
  };

  for (const part of parts) {
    const lines = splitLines(part.value);
    if (part.added) {
      if (!block) block = { removedLines: [], addedLines: [], oldStart: 0, newStart: 0 };
      block.addedLines.push(...lines.map((text, i) => ({ text, num: newNum + i })));
      newNum += lines.length;
    } else if (part.removed) {
      if (!block) block = { removedLines: [], addedLines: [], oldStart: 0, newStart: 0 };
      block.removedLines.push(...lines.map((text, i) => ({ text, num: oldNum + i })));
      oldNum += lines.length;
    } else {
      flush();
      oldNum += lines.length;
      newNum += lines.length;
    }
  }
  flush();
  return blocks;
}

// Aplica a versão "nova" de um bloco sobre o conteúdo antigo (Aceitar bloco).
export function applyBlockAccept(oldContent, newContent, idx) {
  const blocks = buildBlocks(oldContent, newContent);
  const block = blocks[idx];
  if (!block) return newContent;
  const oldLines = splitLines(oldContent);
  const addedTexts = block.addedLines.map((l) => l.text);
  const before = oldLines.slice(0, Math.max(block.oldStart - 1, 0));
  const after = oldLines.slice(Math.max(block.oldEnd, block.oldStart - 1));
  const joined = before.concat(addedTexts, after).join('\n');
  return hasTrailingNewline(oldContent) && !joined.endsWith('\n') ? `${joined}\n` : joined;
}

// Descarta o bloco novo, mantendo as linhas antigas (Rejeitar bloco).
export function applyBlockReject(oldContent, newContent, idx) {
  const blocks = buildBlocks(oldContent, newContent);
  const block = blocks[idx];
  if (!block) return newContent;
  const newLines = splitLines(newContent);
  const removedTexts = block.removedLines.map((l) => l.text);
  const before = newLines.slice(0, Math.max(block.newStart - 1, 0));
  const after = newLines.slice(Math.max(block.newEnd, block.newStart - 1));
  const joined = before.concat(removedTexts, after).join('\n');
  return hasTrailingNewline(newContent) && !joined.endsWith('\n') ? `${joined}\n` : joined;
}

export function isMinifiedFile(path) {
  return /\.min\.js$|\.min\.css$|\.map$/.test(path);
}

export class DiffViewer {
  constructor({ container, onAcceptBlock, onRejectBlock, onAcceptAll, onRejectAll }) {
    this.container = container;
    this.cbs = { onAcceptBlock, onRejectBlock, onAcceptAll, onRejectAll };
    this.files = [];
    this.activePath = null;
  }

  setFiles(files) {
    this.files = files
      .map((f) => ({ ...f, blocks: buildBlocks(f.oldContent, f.newContent) }))
      .filter((f) => f.blocks.length > 0);
    if (this.activePath && !this.files.some((f) => f.path === this.activePath)) this.activePath = null;
    if (!this.activePath && this.files.length) this.activePath = this.files[0].path;
    this.render();
  }

  render() {
    this.container.innerHTML = '';
    if (!this.files.length) {
      const empty = document.createElement('div');
      empty.className = 'pane-empty';
      empty.textContent = 'Sem alterações pendentes. Edite um arquivo no editor e volte aqui.';
      this.container.appendChild(empty);
      return;
    }

    const list = document.createElement('div');
    list.className = 'dv-file-list';
    for (const f of this.files) {
      const item = document.createElement('button');
      item.className = 'dv-file' + (f.path === this.activePath ? ' active' : '');
      item.textContent = f.path;
      item.addEventListener('click', () => {
        this.activePath = f.path;
        this.render();
      });
      list.appendChild(item);
    }
    this.container.appendChild(list);

    const file = this.files.find((f) => f.path === this.activePath);
    if (file) this.renderFile(file);
  }

  renderFile(file) {
    const body = document.createElement('div');
    body.className = 'dv-file-body';

    const actions = document.createElement('div');
    actions.className = 'dv-file-actions';
    const acceptAll = document.createElement('button');
    acceptAll.className = 'dv-btn dv-accept';
    acceptAll.textContent = 'Aceitar tudo';
    acceptAll.addEventListener('click', () => this.cbs.onAcceptAll?.(file.path));
    const rejectAll = document.createElement('button');
    rejectAll.className = 'dv-btn dv-reject';
    rejectAll.textContent = 'Descartar';
    rejectAll.addEventListener('click', () => this.cbs.onRejectAll?.(file.path));
    actions.appendChild(acceptAll);
    actions.appendChild(rejectAll);
    body.appendChild(actions);

    file.blocks.forEach((block, idx) => {
      body.appendChild(this.renderBlock(file, block, idx));
    });

    this.container.appendChild(body);
  }

  renderBlock(file, block, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'dv-block';

    const header = document.createElement('div');
    header.className = 'dv-block-header';
    header.textContent = `Bloco ${idx + 1} · linha ${block.oldStart} → ${block.newStart} (+${block.addedLines.length}/−${block.removedLines.length})`;
    wrap.appendChild(header);

    const lines = document.createElement('div');
    lines.className = 'dv-lines';
    for (const line of block.removedLines) {
      const row = document.createElement('div');
      row.className = 'dv-line dv-del';
      row.innerHTML = `<span class="dv-gutter">${line.num}</span><span class="dv-sign">−</span><span class="dv-text">${escapeHtml(line.text) || ' '}</span>`;
      lines.appendChild(row);
    }
    for (const line of block.addedLines) {
      const row = document.createElement('div');
      row.className = 'dv-line dv-add';
      row.innerHTML = `<span class="dv-gutter">${line.num}</span><span class="dv-sign">+</span><span class="dv-text">${escapeHtml(line.text) || ' '}</span>`;
      lines.appendChild(row);
    }
    wrap.appendChild(lines);

    const actions = document.createElement('div');
    actions.className = 'dv-block-actions';
    const accept = document.createElement('button');
    accept.className = 'dv-btn dv-accept';
    accept.textContent = 'Aceitar bloco';
    accept.addEventListener('click', () => this.cbs.onAcceptBlock?.(file.path, idx));
    const reject = document.createElement('button');
    reject.className = 'dv-btn dv-reject';
    reject.textContent = 'Rejeitar bloco';
    reject.addEventListener('click', () => this.cbs.onRejectBlock?.(file.path, idx));
    actions.appendChild(accept);
    actions.appendChild(reject);
    wrap.appendChild(actions);

    return wrap;
  }
}
