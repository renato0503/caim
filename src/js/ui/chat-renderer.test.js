// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectViewIntent,
  buildFinalText,
  fileChip,
  fileChips,
  debugRawDetails,
  handleViewIntent,
} from './chat-renderer.js';

// ============================================================
// S31 — Chat legível: bubble mostra message + chips, nunca o JSON cru
// ============================================================

describe('chat-renderer — S31 bubble legível', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('buildFinalText usa o message extraído pelo driver (nunca o raw do stream)', () => {
    const finalText = buildFinalText(
      { message: 'Criei o currículo do João.', files: ['index.html', 'style.css'], overwrites: [], approxTokens: 120 },
      '{"message":"...","files":[...]}'
    );
    expect(finalText).toContain('Criei o currículo do João.');
    expect(finalText).not.toContain('{"message"');
    expect(finalText).toContain('120 tokens');
  });

  it('buildFinalText avisa sobre arquivos sobrescritos', () => {
    const finalText = buildFinalText({ message: 'ok', files: ['index.html'], overwrites: ['index.html'], approxTokens: 0 });
    expect(finalText).toContain('Arquivos sobrescritos:** index.html');
  });

  it('buildFinalText avisa sobre resposta truncada', () => {
    const finalText = buildFinalText({ message: 'parcial', files: [], truncated: true });
    expect(finalText).toContain('Resposta truncada');
  });

  it('fileChip cria botão Abrir e Preview por arquivo', () => {
    const onOpen = vi.fn();
    const onPreview = vi.fn();
    const chip = fileChip('index.html', { onOpen, onPreview });
    const buttons = chip.querySelectorAll('.chat-file-chip-btn');
    expect(buttons.length).toBe(2);
    buttons[0].click();
    buttons[1].click();
    expect(onOpen).toHaveBeenCalledWith('index.html');
    expect(onPreview).toHaveBeenCalledWith('index.html');
  });

  it('fileChips renderiza um chip por arquivo e não pisa em innerHTML', () => {
    const chips = fileChips(['index.html', 'style.css']);
    expect(chips.querySelectorAll('.chat-file-chip').length).toBe(2);
  });

  it('debugRawDetails expõe o JSON cru em <details> via textContent (sem innerHTML)', () => {
    const raw = '{"message":"x","files":[{"path":"a.html","content":"<script>alert(1)</script>"}]}';
    const details = debugRawDetails(raw);
    const body = details.querySelector('.chat-debug-raw-body');
    // <details> fecha por padrão: conteúdo não é executado nem visível.
    expect(details.open).toBe(false);
    // textContent preserva as tags como texto literal.
    expect(body.textContent).toContain('<script>alert(1)</script>');
    expect(details.querySelectorAll('script').length).toBe(0);
  });
});

// ============================================================
// S34 — Intenção "ver o site": abre o Preview, não regenera arquivos
// ============================================================

describe('chat-renderer — S34 intenção de visualização', () => {
  it('detectViewIntent reconhece "me de o localhost" e "abrir o site"', () => {
    expect(detectViewIntent('me de o localhost')).toBe(true);
    expect(detectViewIntent('abrir o site')).toBe(true);
    expect(detectViewIntent('mostrar o site')).toBe(true);
    expect(detectViewIntent('preview por favor')).toBe(true);
    expect(detectViewIntent('crie um site de currículo')).toBe(false);
  });

  it('handleViewIntent abre o Preview do primeiro HTML e explica que não usa localhost', async () => {
    const onPreview = vi.fn();
    const text = await handleViewIntent('me de o localhost', ['index.html', 'style.css'], { onPreview });
    expect(onPreview).toHaveBeenCalledWith('index.html');
    expect(text).toContain('não usa localhost');
    expect(text).toContain('**Preview**');
  });

  it('handleViewIntent responde aviso quando não há arquivo para ver (sem chamar LLM)', async () => {
    const onPreview = vi.fn();
    const text = await handleViewIntent('me de o localhost', [], { onPreview });
    expect(onPreview).not.toHaveBeenCalled();
    expect(text).toContain('ainda não há um arquivo para visualizar');
  });

  it('handleViewIntent repassa o erro de abertura sem quebrar o chat', async () => {
    const onPreview = vi.fn().mockImplementation(() => {
      throw new Error('perm denied');
    });
    const text = await handleViewIntent('ver o site', ['index.html'], { onPreview });
    expect(text).toContain('perm denied');
  });
});