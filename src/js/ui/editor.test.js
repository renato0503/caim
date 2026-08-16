// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { CodeEditor } from './editor.js';
import { vfs } from '../core/vfs-service.js';

// S22/J3: contexto dinâmico (16KB) prioriza arquivo ativo, sujos e configs.

function makeEditor() {
  const container = document.createElement('div');
  const tabs = document.createElement('div');
  const status = document.createElement('span');
  document.body.append(container, tabs, status);
  return new CodeEditor({ container, tabsEl: tabs, statusEl: status });
}

beforeEach(() => {
  document.body.innerHTML = '';
  resetIndexedDB();
});

describe('CodeEditor.getOpenFilesContext — priorização (S22)', () => {
  it('prioriza o arquivo ativo no contexto', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('a.txt', 'aaaa');
    await vfs.writeFile('b.txt', 'bbbb');
    await vfs.writeFile('c.txt', 'cccc');
    await editor.openFile('a.txt');
    await editor.openFile('b.txt');
    await editor.openFile('c.txt');
    const ctx = editor.getOpenFilesContext();
    expect(ctx[0].path).toBe('c.txt'); // ativo (último aberto)
  });

  it('prioriza arquivos sujos (dirty) sobre os limpos (sem ativo)', async () => {
    const editor = makeEditor();
    // injeta estados diretamente (sem CodeMirror dispatch)
    editor.openFiles = [
      { path: 'limpo.js', content: 'clean', dirty: false },
      { path: 'sujo.js', content: 'dirty', dirty: true },
    ];
    editor.activePath = null;
    const ctx = editor.getOpenFilesContext();
    expect(ctx[0].path).toBe('sujo.js');
  });

  it('prioriza .json de config antes de outros limpos', async () => {
    const editor = makeEditor();
    editor.openFiles = [
      { path: 'src/app.js', content: 'x', dirty: false },
      { path: 'package.json', content: '{}', dirty: false },
    ];
    editor.activePath = 'src/app.js';
    const ctx = editor.getOpenFilesContext();
    // ativo primeiro, config depois
    expect(ctx.map((c) => c.path)).toEqual(['src/app.js', 'package.json']);
  });

  it('arquivo grande é cortado no limite (nunca trunca o mais importante no meio)', async () => {
    const editor = makeEditor();
    const big = 'x'.repeat(20000);
    editor.openFiles = [
      { path: 'ativo.js', content: big, dirty: true },
      { path: 'outro.js', content: 'zz', dirty: false },
    ];
    editor.activePath = 'ativo.js';
    const ctx = editor.getOpenFilesContext(16384);
    expect(ctx[0].path).toBe('ativo.js');
    expect(ctx[0].content.length).toBeLessThanOrEqual(16384);
  });
});
