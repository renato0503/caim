// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_PREFS, THEMES, FONT_SIZES, FONT_FAMILIES, loadEditorPrefs, saveEditorPrefs } from './editor-prefs.js';

describe('editor-prefs', () => {
  beforeEach(async () => {
    await resetIndexedDB();
  });

  it('tem defaults de tema/fonte/snippets', () => {
    expect(DEFAULT_PREFS.theme).toBe('16bit');
    expect(DEFAULT_PREFS.fontSize).toBe(14);
    expect(DEFAULT_PREFS.fontFamily).toBe('mono');
    expect(Array.isArray(DEFAULT_PREFS.snippets)).toBe(true);
    expect(THEMES.length).toBe(2);
    expect(FONT_SIZES).toContain(14);
    expect(FONT_FAMILIES.map((f) => f.value)).toContain('mono');
  });

  it('loadEditorPrefs retorna defaults quando nada foi salvo', async () => {
    const prefs = await loadEditorPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it('saveEditorPrefs persiste e loadEditorPrefs restaura', async () => {
    const saved = await saveEditorPrefs({ theme: 'light', fontSize: 16 });
    expect(saved.theme).toBe('light');
    expect(saved.fontSize).toBe(16);
    const loaded = await loadEditorPrefs();
    expect(loaded.theme).toBe('light');
    expect(loaded.fontSize).toBe(16);
  });

  it('saveEditorPrefs faz merge com defaults (preenche campos ausentes)', async () => {
    const saved = await saveEditorPrefs({ fontSize: 18 });
    expect(saved.theme).toBe('16bit');
    expect(saved.fontFamily).toBe('mono');
  });
});