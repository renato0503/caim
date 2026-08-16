// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileTree } from './file-tree.js';
import { vfs } from '../core/vfs-service.js';

// S3/S16/J6: explorer — árvore recursiva, filtro de .git, menu ⋯ e preview.

describe('FileTree — Explorer (S3/S16)', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    resetIndexedDB();
    await vfs.ready;
    const all = await vfs.listAllFiles();
    for (const p of all) await vfs.deleteFile(p, { silent: true });
    await vfs.db.directories.clear();
  });

  async function makeTree(callbacks = {}) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const tree = new FileTree({
      container,
      onOpenFile: callbacks.onOpenFile || vi.fn(),
      onPreviewFile: callbacks.onPreviewFile || vi.fn(),
      onFileActions: callbacks.onFileActions || vi.fn(),
    });
    await tree.render();
    return { tree, container };
  }

  it('renderiza arquivos e pastas', async () => {
    await vfs.writeFile('README.md', '# oi');
    await vfs.writeFile('src/app.js', 'const a = 1;');
    const { container } = await makeTree();
    expect(container.textContent).toContain('README.md');
    expect(container.textContent).toContain('src');
    expect(container.textContent).toContain('app.js');
  });

  it('oculta o diretório .git da árvore', async () => {
    await vfs.writeFile('a.txt', 'x');
    await vfs.ensureDir('.git');
    const { container } = await makeTree();
    expect(container.textContent).not.toContain('.git');
    expect(container.textContent).toContain('a.txt');
  });

  it('clique no arquivo abre no editor', async () => {
    await vfs.writeFile('hello.js', 'console.log(1)');
    const onOpenFile = vi.fn();
    const { container } = await makeTree({ onOpenFile });
    const node = container.querySelector('.ft-file[data-path="hello.js"]');
    node.click();
    expect(onOpenFile).toHaveBeenCalledWith('hello.js');
  });

  it('clique na pasta expande/recolhe', async () => {
    await vfs.writeFile('lib/util.js', 'export {};');
    const { container } = await makeTree();
    // Árvore expande por padrão: recolhe primeiro.
    expect(container.textContent).toContain('util.js');
    const dir = container.querySelector('.ft-dir[data-path="lib"]');
    dir.click();
    await vi.waitFor(() => expect(container.querySelector('[data-path="util.js"]')).toBeNull());
    dir.click();
    await vi.waitFor(() => expect(container.textContent).toContain('util.js'));
  });

  it('botão 👁 dispara preview e botão ⋯ dispara ações', async () => {
    await vfs.writeFile('doc.md', '# doc');
    const onPreviewFile = vi.fn();
    const onFileActions = vi.fn();
    const { container } = await makeTree({ onPreviewFile, onFileActions });
    container.querySelector('.ft-preview').click();
    expect(onPreviewFile).toHaveBeenCalledWith('doc.md');
    container.querySelector('.ft-more').click();
    expect(onFileActions).toHaveBeenCalledWith(expect.objectContaining({ path: 'doc.md' }));
  });

  it('nomes de arquivo são escapados (XSS)', async () => {
    await vfs.writeFile('<img src=x onerror=alert(1)>.js', 'x');
    const { container } = await makeTree();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.textContent).toContain('onerror');
  });
});
