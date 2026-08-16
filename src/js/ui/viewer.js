import { vfs } from '../core/vfs-service.js';

function basename(path) {
  const i = path.lastIndexOf('/');
  return i === -1 ? path : path.slice(i + 1);
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:(.*?);/.exec(head)[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function wrapMarkdown(html) {
  return `<div class="viewer-markdown">${html}</div>`;
}

export class FileViewer {
  constructor({ container, titleEl, onOpenInEditor }) {
    this.container = container;
    this.titleEl = titleEl;
    this.onOpenInEditor = onOpenInEditor;
    this.currentPath = null;
    this.objectUrls = [];
  }

  clearObjectUrls() {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
    this.objectUrls = [];
  }

  async openFile(path) {
    this.currentPath = path;
    const { content, mimeType } = await vfs.readFile(path);
    this.titleEl.textContent = basename(path);
    await this.render(path, content, mimeType);
  }

  async render(path, content, mimeType) {
    const ext = vfs.constructor.extname(path).toLowerCase();
    this.clearObjectUrls();
    this.container.innerHTML = '';
    try {
      if ((mimeType || '').startsWith('image/')) return this.renderImage(content);
      if (ext === '.md' || mimeType === 'text/markdown') return await this.renderMarkdown(content);
      if (ext === '.html' || ext === '.htm') return this.renderHtml(content);
      if (ext === '.pdf' || mimeType === 'application/pdf') return this.renderPdf(content);
      if (ext === '.csv') return this.renderCsv(content);
      if (ext === '.xlsx' || ext === '.xls') return await this.renderXlsx(content);
      if (ext === '.docx') return await this.renderDocx(content);
      if (ext === '.pptx') return await this.renderPptx(content);
      if (mimeType && mimeType.startsWith('text/')) return this.renderText(content);
      return this.renderUnsupported(content, path);
    } catch (err) {
      this.renderError(err);
    }
  }

  renderMarkdown(content) {
    return import('marked').then(async ({ marked }) => {
      const DOMPurify = (await import('dompurify')).default;
      const html = DOMPurify.sanitize(marked.parse(content));
      this.container.innerHTML = wrapMarkdown(html);
      this.container.scrollTop = 0;
    });
  }

  renderImage(dataUrl) {
    const img = document.createElement('img');
    img.className = 'viewer-image';
    img.src = dataUrl;
    img.alt = '';
    this.container.appendChild(img);
  }

  renderHtml(content) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    const iframe = document.createElement('iframe');
    iframe.className = 'viewer-iframe';
    iframe.setAttribute('sandbox', 'allow-scripts allow-popups');
    iframe.src = url;
    this.container.appendChild(iframe);
  }

  renderPdf(dataUrl) {
    const blob = dataUrlToBlob(dataUrl);
    const url = URL.createObjectURL(blob);
    this.objectUrls.push(url);
    const iframe = document.createElement('iframe');
    iframe.className = 'viewer-iframe viewer-pdf';
    iframe.src = url;
    this.container.appendChild(iframe);
    const fallback = document.createElement('a');
    fallback.className = 'viewer-fallback';
    fallback.href = url;
    fallback.target = '_blank';
    fallback.rel = 'noopener';
    fallback.textContent = 'Se não carregar, abrir PDF em nova aba';
    this.container.appendChild(fallback);
  }

  renderCsv(content) {
    const rows = [];
    for (const line of content.replace(/\r/g, '').split('\n')) {
      if (!line.trim()) continue;
      rows.push(parseCsvLine(line));
    }
    if (rows.length === 0) return this.renderText(content);
    let html = '<div class="viewer-table-wrap"><table class="viewer-table">';
    rows.forEach((cells, idx) => {
      const tag = idx === 0 ? 'th' : 'td';
      html += `<tr>${cells.map((c) => `<${tag}>${escapeHtml(c)}</${tag}>`).join('')}</tr>`;
    });
    html += '</table></div>';
    this.container.innerHTML = html;
  }

  async renderXlsx(dataUrl) {
    const XLSX = await import('xlsx');
    const blob = dataUrlToBlob(dataUrl);
    const wb = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const html = XLSX.utils.sheet_to_html(sheet);
    this.container.innerHTML = `<div class="viewer-table-wrap">${html}</div>`;
  }

  async renderDocx(dataUrl) {
    const mammoth = await import('mammoth/mammoth.browser.min.js');
    const blob = dataUrlToBlob(dataUrl);
    const result = await mammoth.convertToHtml({ arrayBuffer: await blob.arrayBuffer() });
    this.container.innerHTML = wrapMarkdown(result.value);
  }

  async renderPptx(dataUrl) {
    const JSZip = (await import('jszip')).default;
    const blob = dataUrlToBlob(dataUrl);
    const zip = await JSZip.loadAsync(blob);
    const slideNames = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    let text = '';
    for (const name of slideNames) {
      const xml = await zip.files[name].async('string');
      const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).filter(Boolean);
      if (texts.length) {
        text += `## Slide ${slideNames.indexOf(name) + 1}\n\n${texts.join('\n')}\n\n`;
      }
    }
    if (!text.trim()) {
      return this.renderUnsupported(dataUrl, this.currentPath);
    }
    return this.renderMarkdown(text);
  }

  renderText(content) {
    const pre = document.createElement('pre');
    pre.className = 'viewer-text';
    pre.textContent = content;
    this.container.appendChild(pre);
  }

  renderUnsupported(dataUrl, path) {
    const box = document.createElement('div');
    box.className = 'viewer-unsupported';
    box.innerHTML = `
      <div class="viewer-unsupported-icon">🗎</div>
      <p>Pré-visualização não disponível para este formato.</p>
      <a class="viewer-download" download="${basename(path)}" href="${dataUrl}">Baixar arquivo</a>
    `;
    this.container.appendChild(box);
  }

  renderError(err) {
    const box = document.createElement('div');
    box.className = 'viewer-unsupported';
    box.innerHTML = `<p>Não foi possível visualizar o arquivo.</p><p class="viewer-error">${escapeHtml(err.message)}</p>`;
    this.container.appendChild(box);
  }
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}