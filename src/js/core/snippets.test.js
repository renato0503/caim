// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_SNIPPETS, findSnippet, langFromPath, wordBeforeCursor } from './snippets.js';
import { EditorState } from '@codemirror/state';

describe('snippets', () => {
  it('expõe snippets padrão com trigger/lang/description/content', () => {
    expect(DEFAULT_SNIPPETS.length).toBeGreaterThanOrEqual(10);
    for (const s of DEFAULT_SNIPPETS) {
      expect(typeof s.trigger).toBe('string');
      expect(typeof s.content).toBe('string');
      expect(s.trigger.length).toBeGreaterThan(0);
    }
  });

  it('findSnippet casa gatilho com a linguagem correta', () => {
    expect(findSnippet('fn', 'js').trigger).toBe('fn');
    expect(findSnippet('html', 'html').trigger).toBe('html');
    expect(findSnippet('json', 'json').trigger).toBe('json');
    expect(findSnippet('h1', 'md').trigger).toBe('h1');
  });

  it('findSnippet não casa gatilho de outra linguagem', () => {
    expect(findSnippet('fn', 'css')).toBeNull();
    expect(findSnippet('html', 'js')).toBeNull();
  });

  it('findSnippet ignora o prefixo ! e normaliza case', () => {
    expect(findSnippet('!FN', 'js').trigger).toBe('fn');
    expect(findSnippet('  for ', 'js').trigger).toBe('for');
  });

  it('snippets com lang "*" funcionam em qualquer linguagem', () => {
    expect(findSnippet('todo', 'md').trigger).toBe('todo');
    expect(findSnippet('todo', 'js').trigger).toBe('todo');
  });

  it('snippets customizados têm prioridade sobre os padrão', () => {
    const custom = [{ trigger: 'fn', lang: 'js', description: 'custom', content: 'custom()' }];
    const hit = findSnippet('fn', 'js', custom);
    expect(hit.content).toBe('custom()');
  });

  it('langFromPath mapeia extensões conhecidas', () => {
    expect(langFromPath('a.js')).toBe('js');
    expect(langFromPath('a/App.tsx')).toBe('js');
    expect(langFromPath('x.py')).toBe('py');
    expect(langFromPath('index.html')).toBe('html');
    expect(langFromPath('style.scss')).toBe('css');
    expect(langFromPath('data.json')).toBe('json');
    expect(langFromPath('README.md')).toBe('md');
    expect(langFromPath('arquivo.txt')).toBe('');
  });

  it('wordBeforeCursor captura a palavra antes do cursor', () => {
    const state = EditorState.create({ doc: 'const abc', selection: { anchor: 9 } });
    const { word, from } = wordBeforeCursor(state.doc, 9);
    expect(word).toBe('abc');
    expect(from).toBe(6);
  });

  it('wordBeforeCursor inclui "!" no gatilho', () => {
    const state = EditorState.create({ doc: '  !fn', selection: { anchor: 5 } });
    const { word } = wordBeforeCursor(state.doc, 5);
    expect(word).toBe('!fn');
  });

  it('wordBeforeCursor retorna vazio no início', () => {
    const state = EditorState.create({ doc: 'abc', selection: { anchor: 0 } });
    const { word } = wordBeforeCursor(state.doc, 0);
    expect(word).toBe('');
  });
});