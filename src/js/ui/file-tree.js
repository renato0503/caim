import { vfs } from '../core/vfs-service.js';

const FOLDER_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>`;
const FILE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>
  </svg>`;
const CHEVRON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>`;
const EYE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>
  </svg>`;
const MORE_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="5" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle>
  </svg>`;

export class FileTree {
  constructor({ container, onOpenFile, onPreviewFile, onFileActions }) {
    this.container = container;
    this.onOpenFile = onOpenFile;
    this.onPreviewFile = onPreviewFile;
    this.onFileActions = onFileActions;
    this.collapsed = new Set();
    this.currentPath = '';
    vfs.events.on('vfs:changed', () => this.render());
    this.render();
  }

  async render() {
    const root = document.createElement('div');
    root.className = 'file-tree-root';

    const tree = document.createElement('div');
    tree.className = 'file-tree';
    await this.buildLevel(tree, this.currentPath);
    root.appendChild(tree);

    this.container.innerHTML = '';
    this.container.appendChild(root);
  }

  async buildLevel(container, dirPath) {
    const entry = await vfs.listDir(dirPath);
    const dirs = entry.dirs.filter((d) => d.path !== '.git' && !d.path.startsWith('.git/'));
    const files = entry.files.filter((f) => !f.path.startsWith('.git/'));
    for (const dir of dirs) {
      const li = this.dirNode(dir);
      container.appendChild(li);
      if (!this.collapsed.has(dir.path)) {
        await this.expandDir(li, dir.path);
      }
    }
    for (const file of files) {
      container.appendChild(this.fileNode(file));
    }
  }

  dirNode(dir) {
    const li = document.createElement('div');
    li.className = 'ft-dir';
    li.dataset.path = dir.path;
    li.addEventListener('click', async () => {
      if (this.collapsed.has(dir.path)) {
        this.collapsed.delete(dir.path);
        await this.expandDir(li, dir.path);
      } else {
        this.collapsed.add(dir.path);
        li.classList.remove('open');
        li.querySelectorAll(':scope > .ft-children').forEach((n) => n.remove());
      }
      li.classList.toggle('open', !this.collapsed.has(dir.path));
    });
    li.innerHTML = `
      <div class="ft-row">
        <span class="ft-chevron">${CHEVRON}</span>
        <span class="ft-icon ft-icon-folder">${FOLDER_ICON}</span>
        <span class="ft-name">${escapeHtml(dir.name)}</span>
      </div>`;
    return li;
  }

  async expandDir(li, dirPath) {
    const children = document.createElement('div');
    children.className = 'ft-children';
    await this.buildLevel(children, dirPath);
    li.appendChild(children);
  }

  fileNode(file) {
    const li = document.createElement('div');
    li.className = 'ft-file';
    li.dataset.path = file.path;
    li.addEventListener('click', () => this.onOpenFile(file.path));
    li.innerHTML = `
      <div class="ft-row">
        <span class="ft-chevron ft-chevron-empty"></span>
        <span class="ft-icon ft-icon-file">${FILE_ICON}</span>
        <span class="ft-name">${escapeHtml(file.name)}</span>
        ${this.onPreviewFile ? `<button class="ft-preview" aria-label="Visualizar ${escapeHtml(file.name)}" title="Visualizar">${EYE_ICON}</button>` : ''}
        ${this.onFileActions ? `<button class="ft-more" aria-label="Ações de ${escapeHtml(file.name)}" title="Ações">${MORE_ICON}</button>` : ''}
      </div>`;
    if (this.onPreviewFile) {
      li.querySelector('.ft-preview').addEventListener('click', (e) => {
        e.stopPropagation();
        this.onPreviewFile(file.path);
      });
    }
    if (this.onFileActions) {
      li.querySelector('.ft-more').addEventListener('click', (e) => {
        e.stopPropagation();
        this.onFileActions(file);
      });
    }
    return li;
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}