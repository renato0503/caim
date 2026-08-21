// S39 — Snippets de código: lista padrão + customizados (persistidos nas prefs
// do editor). `findSnippet` resolve um gatilho (ex.: `!html`, `fn`, `for`) para
// o conteúdo do snippet, respeitando a linguagem do arquivo aberto.

export const DEFAULT_SNIPPETS = [
  {
    trigger: 'html',
    lang: 'html',
    description: 'Boilerplate HTML5',
    content:
      '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>CAIM</title>\n</head>\n<body>\n  \n</body>\n</html>',
  },
  {
    trigger: 'cssr',
    lang: 'css',
    description: 'Reset CSS',
    content: '* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; }\n',
  },
  {
    trigger: 'fn',
    lang: 'js',
    description: 'Função JS',
    content: 'function nome(params) {\n  \n}\n',
  },
  {
    trigger: 'for',
    lang: 'js',
    description: 'Loop for',
    content: 'for (let i = 0; i < N; i++) {\n  \n}\n',
  },
  {
    trigger: 'if',
    lang: 'js',
    description: 'Condicional if/else',
    content: 'if (condicao) {\n  \n} else {\n  \n}\n',
  },
  {
    trigger: 'imp',
    lang: 'js',
    description: 'Import ES module',
    content: "import {  } from './';\n",
  },
  {
    trigger: 'clog',
    lang: 'js',
    description: 'console.log',
    content: 'console.log();\n',
  },
  {
    trigger: 'json',
    lang: 'json',
    description: 'Objeto JSON',
    content: '{\n  "key": "value"\n}\n',
  },
  {
    trigger: 'h1',
    lang: 'md',
    description: 'Título markdown',
    content: '# Título\n',
  },
  {
    trigger: 'todo',
    lang: '*',
    description: 'Lista de tarefas',
    content: '- [ ] tarefa\n',
  },
];

// Linguagem do editor a partir do path (mesmo critério do loadLanguage).
export function langFromPath(path) {
  const ext = (path.split('.').pop() || '').toLowerCase();
  if (['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(ext)) return 'js';
  if (['py'].includes(ext)) return 'py';
  if (['html', 'htm', 'vue'].includes(ext)) return 'html';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (['json', 'jsonc'].includes(ext)) return 'json';
  if (['md', 'markdown'].includes(ext)) return 'md';
  return '';
}

export function findSnippet(word, lang, custom = []) {
  const w = String(word || '').replace(/^!/, '').trim().toLowerCase();
  if (!w) return null;
  const all = [...(custom || []), ...DEFAULT_SNIPPETS];
  const direct = all.find((s) => s.trigger === w);
  if (!direct) return null;
  if (!direct.lang || direct.lang === '*' || direct.lang === lang) return direct;
  return null;
}

// Palavra antes do cursor (para expansão por teclado/atalho).
export function wordBeforeCursor(doc, pos) {
  let start = pos;
  while (start > 0 && /[\w!]/.test(doc.sliceString(start - 1, start))) start--;
  return { word: doc.sliceString(start, pos), from: start };
}