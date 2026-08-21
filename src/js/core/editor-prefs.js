// S39 — Preferências do editor (tema, fonte, tamanho, snippets customizados)
// persistidas no VFS (`metadata` key `editor-prefs`).

import { vfs } from './vfs-service.js';

export const DEFAULT_PREFS = {
  theme: '16bit', // '16bit' | 'light'
  fontSize: 14,
  fontFamily: 'mono', // 'mono' | 'pixel' | fonte custom
  snippets: [], // [{ trigger, lang, description, content }]
};

export const THEMES = [
  { value: '16bit', label: '16-bit (padrão)' },
  { value: 'light', label: 'Claro' },
];

export const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];

export const FONT_FAMILIES = [
  { value: 'mono', label: 'Mono' },
  { value: 'pixel', label: 'Pixel' },
];

export async function loadEditorPrefs() {
  try {
    const rec = await vfs.db.metadata.get('editor-prefs');
    return { ...DEFAULT_PREFS, ...(rec?.value || {}) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveEditorPrefs(prefs) {
  const merged = { ...DEFAULT_PREFS, ...(prefs || {}) };
  await vfs.db.metadata.put({ key: 'editor-prefs', value: merged });
  return merged;
}