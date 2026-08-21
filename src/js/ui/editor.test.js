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

describe('CodeEditor.openFile — guard contra duplicação (fix abas)', () => {
  it('isOpen detecta arquivo aberto', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('x.js', 'const x = 1;');
    expect(editor.isOpen('x.js')).toBe(false);
    await editor.openFile('x.js');
    expect(editor.isOpen('x.js')).toBe(true);
  });

  it('chamadas concorrentes de openFile não duplicam a aba', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('dup.js', 'const d = 1;');
    await Promise.all([editor.openFile('dup.js'), editor.openFile('dup.js')]);
    const count = editor.openFiles.filter((f) => f.path === 'dup.js').length;
    expect(count).toBe(1);
  });
});

describe('CodeEditor — snippets e preferências (S39)', () => {
  it('expandSnippetAtCursor expande gatilho JS para o conteúdo', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('app.js', 'const a = clog');
    await editor.openFile('app.js');
    editor.view.dispatch({
      changes: { from: 'const a = clog'.length, insert: '' },
      selection: { anchor: 'const a = clog'.length },
    });
    const ok = editor.expandSnippetAtCursor();
    expect(ok).toBe(true);
    expect(editor.view.state.doc.toString()).toContain('console.log();');
  });

  it('expandSnippetAtCursor não casa gatilho de outra linguagem', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('style.css', 'fn');
    await editor.openFile('style.css');
    editor.view.dispatch({
      changes: { from: 2, insert: '' },
      selection: { anchor: 2 },
    });
    expect(editor.expandSnippetAtCursor()).toBe(false);
    expect(editor.view.state.doc.toString()).toBe('fn');
  });

  it('insertSnippet insere no cursor e marca dirty', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await vfs.writeFile('app.js', 'ab');
    await editor.openFile('app.js');
    editor.view.dispatch({
      changes: { from: 1, insert: '' },
      selection: { anchor: 1 },
    });
    editor.insertSnippet({ trigger: 'x', content: 'INSERT' });
    expect(editor.view.state.doc.toString()).toBe('aINSERTb');
    const file = editor.openFiles.find((f) => f.path === 'app.js');
    expect(file.dirty).toBe(true);
  });

  it('applyPrefs com tema light troca o extension de tema', async () => {
    await vfs.ready;
    const editor = makeEditor();
    editor.applyPrefs({ theme: 'light', fontSize: 16, fontFamily: 'pixel' });
    expect(editor.prefs.theme).toBe('light');
    expect(editor.prefs.fontSize).toBe(16);
  });

  it('savePrefs persiste no metadata do VFS', async () => {
    await vfs.ready;
    const editor = makeEditor();
    await editor.savePrefs({ fontSize: 18 });
    const rec = await vfs.db.metadata.get('editor-prefs');
    expect(rec.value.fontSize).toBe(18);
    expect(editor.prefs.fontFamily).toBe('mono');
  });
});
