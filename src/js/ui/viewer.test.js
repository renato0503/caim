// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// S3.5/S18/J4: viewer sanitiza saída (DOMPurify) e escapa texto — sem XSS.

const xlsxSheet = vi.hoisted(() => ({
  html: '<script>alert(1)</script><table><tr><td>ok</td></tr></table>',
}));
const docxHtml = vi.hoisted(() => ({ value: '<b>bold</b><script>alert(1)</script>' }));

vi.mock('xlsx', () => ({
  read: () => ({ SheetNames: ['S1'], Sheets: { S1: { '!ref': 'A1', A1: { v: 'x' } } } }),
  utils: { sheet_to_html: () => xlsxSheet.html },
}));

vi.mock('mammoth/mammoth.browser.min.js', () => ({
  convertToHtml: async () => docxHtml,
}));

import { FileViewer } from './viewer.js';

describe('FileViewer — XSS e sanitização', () => {
  let viewer;
  let container;
  let titleEl;

  beforeEach(() => {
    container = document.createElement('div');
    titleEl = document.createElement('div');
    viewer = new FileViewer({ container, titleEl });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('markdown malicioso é sanitizado (script/img onerror removidos)', async () => {
    await viewer.renderMarkdown('Hello **world**\n\n<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n');
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(container.innerHTML).not.toContain('alert(1)');
  });

  it('CSV com HTML injetado é escapado (células via textContent)', () => {
    viewer.renderCsv('nome,valor\n<script>alert(1)</script>,10');
    const table = container.querySelector('table');
    expect(table).toBeTruthy();
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('<script>');
  });

  it('HTML é renderizado em iframe sandbox (sem privilégios de origem)', () => {
    viewer.renderHtml('<html><body><script>top.location=evil</script></body></html>');
    const iframe = container.querySelector('iframe.viewer-iframe');
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
  });

  it('renderXlsx sanitiza a saída do sheet_to_html', async () => {
    await viewer.renderXlsx('data:application/vnd.ms-excel;base64,AAAA');
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('alert(1)');
    expect(container.innerHTML).toContain('ok');
  });

  it('renderDocx sanitiza a saída do mammoth', async () => {
    await viewer.renderDocx('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA');
    expect(container.querySelector('script')).toBeNull();
    expect(container.innerHTML).not.toContain('alert(1)');
    expect(container.innerHTML).toContain('bold');
  });

  it('texto puro renderiza via textContent (sem interpretar HTML)', () => {
    viewer.renderText('<b>não é negrito</b><script>alert(1)</script>');
    const pre = container.querySelector('pre');
    expect(pre.textContent).toContain('<script>');
    expect(container.querySelector('script')).toBeNull();
  });
});
