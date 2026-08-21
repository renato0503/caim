// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notify } from './notify.js';

// S36/J4: toast com duration:0 fica persistente (não some sozinho) — usado no
// deploy para o usuário ter tempo de clicar em "Abrir".

describe('notify.toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('toast padrão some após a duration', () => {
    notify.toast('oi', { duration: 500 });
    expect(document.querySelector('.ui-toast')).toBeTruthy();
    vi.advanceTimersByTime(900);
    expect(document.querySelector('.ui-toast')).toBeNull();
  });

  it('duration:0 mantém o toast na tela mesmo após muito tempo', () => {
    notify.toast('publicado!', { duration: 0 });
    expect(document.querySelector('.ui-toast')).toBeTruthy();
    vi.advanceTimersByTime(120000);
    expect(document.querySelector('.ui-toast')).toBeTruthy();
  });

  it('botão fecha o toast e dispara o onClick', () => {
    const onClick = vi.fn();
    notify.toast('ok', { duration: 0, button: { text: 'Abrir', onClick } });
    const btn = document.querySelector('.ui-toast-btn');
    expect(btn.textContent).toBe('Abrir');
    btn.click();
    vi.advanceTimersByTime(400);
    expect(onClick).toHaveBeenCalled();
    expect(document.querySelector('.ui-toast')).toBeNull();
  });
});