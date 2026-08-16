import { describe, it, expect } from 'vitest';
import { buildBlocks, applyBlockAccept, applyBlockReject, isMinifiedFile } from './diff-viewer.js';

// S5/S15/J4: blocos de diff — aceitar/rejeitar bloco e filtro de arquivos minificados.

describe('buildBlocks', () => {
  it('gera bloco de adição pura', () => {
    const blocks = buildBlocks('a\nb\n', 'a\nb\nc\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].addedLines.map((l) => l.text)).toEqual(['c']);
    expect(blocks[0].addedLines[0].num).toBe(3);
    expect(blocks[0].oldStart).toBe(3);
  });

  it('gera bloco de remoção pura', () => {
    const blocks = buildBlocks('a\nb\nc\n', 'a\nc\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].removedLines.map((l) => l.text)).toEqual(['b']);
  });

  it('agrupa remoção+adição no mesmo bloco', () => {
    const blocks = buildBlocks('x\nold\nz\n', 'x\nnew\nz\n');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].removedLines.map((l) => l.text)).toEqual(['old']);
    expect(blocks[0].addedLines.map((l) => l.text)).toEqual(['new']);
  });

  it('não gera blocos para conteúdo idêntico', () => {
    expect(buildBlocks('igual\n', 'igual\n')).toHaveLength(0);
  });

  it('suporta CRLF e linha final sem newline', () => {
    const blocks = buildBlocks('a\r\nb', 'a\r\nb\r\nc');
    expect(blocks[0].addedLines.map((l) => l.text)).toEqual(['c']);
  });
});

describe('applyBlockAccept / applyBlockReject', () => {
  it('aceitar bloco aplica a versão nova daquela região', () => {
    const oldC = 'linha1\nlinha2_velha\nlinha3\n';
    const newC = 'linha1\nlinha2_nova\nlinha3\n';
    const applied = applyBlockAccept(oldC, newC, 0);
    expect(applied).toContain('linha2_nova');
    expect(applied).not.toContain('linha2_velha');
  });

  it('rejeitar bloco mantém a linha antiga', () => {
    const oldC = 'linha1\nlinha2_velha\nlinha3\n';
    const newC = 'linha1\nlinha2_nova\nlinha3\n';
    const applied = applyBlockReject(oldC, newC, 0);
    expect(applied).toContain('linha2_velha');
    expect(applied).not.toContain('linha2_nova');
  });

  it('aceitar múltiplos blocos preserva as outras regiões', () => {
    const oldC = 'a\nvelha1\nb\nvelha2\nc\n';
    const newC = 'a\nnova1\nb\nnova2\nc\n';
    expect(applyBlockAccept(oldC, newC, 0)).toBe('a\nnova1\nb\nvelha2\nc\n');
    expect(applyBlockAccept(oldC, newC, 1)).toBe('a\nvelha1\nb\nnova2\nc\n');
  });

  it('bloco inexistente retorna o conteúdo novo intacto', () => {
    const oldC = 'a\n';
    const newC = 'a\nb\n';
    expect(applyBlockAccept(oldC, newC, 5)).toBe(newC);
    expect(applyBlockReject(oldC, newC, 5)).toBe(newC);
  });

  it('aceitar bloco de adição pura insere a linha nova na posição certa', () => {
    const oldC = 'a\nb\n';
    const newC = 'a\nb\nc\n';
    expect(applyBlockAccept(oldC, newC, 0)).toBe('a\nb\nc\n');
  });
});

describe('isMinifiedFile', () => {
  it('ignora .min.js, .min.css e source maps', () => {
    expect(isMinifiedFile('dist/app.min.js')).toBe(true);
    expect(isMinifiedFile('styles.min.css')).toBe(true);
    expect(isMinifiedFile('app.js.map')).toBe(true);
  });

  it('não filtra arquivos normais', () => {
    expect(isMinifiedFile('src/app.js')).toBe(false);
    expect(isMinifiedFile('style.css')).toBe(false);
  });
});
