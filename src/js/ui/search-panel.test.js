// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scoreFile, isTextPath, findMatches, findInFiles, replaceInFiles, SearchPanel } from './search-panel.js';
import { vfs } from '../core/vfs-service.js';

// S38: busca fuzzy (go-to-file) + find & replace global no explorer.

describe('scoreFile — ordenação fuzzy', () => {
  it('exact e basename exact têm score máximo', () => {
    expect(scoreFile('src/app.js', 'app.js')).toBe(100);
    expect(scoreFile('app.js', 'app.js')).toBe(100);
  });

  it('basename startsWith > basename contains > path contains', () => {
    const starts = scoreFile('src/app.js', 'app');
    const contains = scoreFile('src/my-app.js', 'app');
    const pathContains = scoreFile('src/xapp/y.js', 'app');
    expect(starts).toBeGreaterThan(contains);
    expect(contains).toBeGreaterThan(pathContains);
  });

  it('sem query ou sem match retorna 0', () => {
    expect(scoreFile('src/app.js', '')).toBe(0);
    expect(scoreFile('src/app.js', 'zzz')).toBe(0);
  });

  it('subsequência retorna score baixo (ex.: vfs-service)', () => {
    const s = scoreFile('src/js/core/vfs-service.js', 'vfssrv');
    expect(s).toBeGreaterThan(0);
    expect(s).toBeLessThan(50);
  });
});

describe('isTextPath', () => {
  it('ignora .git/ e binários', () => {
    expect(isTextPath('.git/config')).toBe(false);
    expect(isTextPath('img/logo.png')).toBe(false);
    expect(isTextPath('docs/relatorio.pdf')).toBe(false);
  });
  it('aceita código e texto', () => {
    expect(isTextPath('src/app.js')).toBe(true);
    expect(isTextPath('README.md')).toBe(true);
  });
});

describe('findMatches — linhas e colunas', () => {
  it('encontra ocorrência com linha/coluna corretos', () => {
    const m = findMatches('a\nfoo bar\nbaz foo', 'foo');
    expect(m).toHaveLength(2);
    expect(m[0]).toEqual({ line: 2, column: 1, text: 'foo bar' });
    expect(m[1]).toEqual({ line: 3, column: 5, text: 'baz foo' });
  });

  it('é case-insensitive', () => {
    const m = findMatches('Hello HELLO hello', 'hello');
    expect(m).toHaveLength(3);
  });

  it('respeita o cap', () => {
    const m = findMatches('xx '.repeat(500), 'x', 10);
    expect(m).toHaveLength(10);
  });

  it('query vazia não retorna nada', () => {
    expect(findMatches('qualquer coisa', '')).toEqual([]);
  });
});

describe('findInFiles / replaceInFiles — VFS real', () => {
  beforeEach(async () => {
    resetIndexedDB();
    await vfs.ready;
    const all = await vfs.listAllFiles();
    for (const p of all) await vfs.deleteFile(p, { silent: true });
    await vfs.db.directories.clear();
  });

  it('busca em todos os arquivos de texto', async () => {
    await vfs.writeFile('a.txt', 'tem token aqui\nnada');
    await vfs.writeFile('b.js', 'const token = 1;');
    await vfs.writeFile('c.png', 'data:image/png;base64,xxx');
    const results = await findInFiles('token');
    expect(results).toHaveLength(2);
    const paths = results.map((r) => r.path).sort();
    expect(paths).toEqual(['a.txt', 'b.js']);
  });

  it('substitui todas as ocorrências e emite vfs:changed', async () => {
    await vfs.writeFile('a.txt', 'azul azul');
    await vfs.writeFile('b.txt', 'sem');
    const events = [];
    vfs.events.on('vfs:changed', (e) => events.push(e));
    const res = await replaceInFiles('azul', 'verde');
    expect(res).toEqual({ files: 1, occurrences: 2 });
    expect((await vfs.readFile('a.txt')).content).toBe('verde verde');
    expect((await vfs.readFile('b.txt')).content).toBe('sem');
    expect(events.some((e) => e.type === 'update')).toBe(true);
  });
});

describe('SearchPanel — UI (jsdom)', () => {
  beforeEach(async () => {
    resetIndexedDB();
    await vfs.ready;
    const all = await vfs.listAllFiles();
    for (const p of all) await vfs.deleteFile(p, { silent: true });
    await vfs.db.directories.clear();
    await vfs.writeFile('index.html', '<h1>oi</h1>');
    await vfs.writeFile('src/app.js', 'console.log(1)');
    document.body.innerHTML = '';
  });

  function makePanel() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onOpenFile = vi.fn();
    const panel = new SearchPanel({ container, onOpenFile });
    return { panel, container, onOpenFile };
  }

  it('modo arquivos lista resultados fuzzy e abre ao clicar', async () => {
    const { panel, container, onOpenFile } = makePanel();
    await panel.refreshPaths();
    panel.input.value = 'app';
    await panel.run();
    const hit = container.querySelector('.search-hit');
    expect(hit).not.toBeNull();
    expect(container.textContent).toContain('src/app.js');
    hit.click();
    expect(onOpenFile).toHaveBeenCalledWith('src/app.js');
  });

  it('modo find mostra ocorrências agrupadas por arquivo', async () => {
    const { panel, container } = makePanel();
    await panel.refreshPaths();
    panel.findBtn.click();
    panel.input.value = 'console';
    await panel.run();
    await vi.waitFor(() => {
      expect(container.querySelector('.search-file-head')?.textContent).toContain('src/app.js');
    });
    expect(container.querySelector('.search-match-line')?.textContent).toBe('L1:');
  });
});
