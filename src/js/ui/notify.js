/**
 * S10 — Mini UI de sistema (toast/dialog/actions) que substitui o Framework7.
 * Estilo segue a identidade CAIM (navy + teal). Zero dependência.
 */

function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

function createOverlay(forActions = false) {
  const el = document.createElement('div');
  el.className = 'ui-overlay';
  document.body.appendChild(el);
  if (forActions) {
    el.addEventListener('click', (e) => {
      if (e.target === el) el.remove();
    });
  }
  return el;
}

export const notify = {
  toast(text, { button, position = 'bottom', duration = 3500 } = {}) {
    const el = document.createElement('div');
    el.className = `ui-toast ui-toast-${position}`;
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    if (button) {
      const btn = document.createElement('button');
      btn.className = 'ui-toast-btn';
      btn.textContent = button.text;
      btn.addEventListener('click', () => {
        hide();
        button.onClick?.();
      });
      el.appendChild(btn);
    }
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    // duration 0 = toast persistente (só fecha no botão); evita sumir cedo demais
    let timer = duration > 0 ? setTimeout(hide, duration) : null;
    function hide() {
      if (timer) clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }
    return { close: hide };
  },

  prompt(initial, title, onSubmit, onCancel) {
    const overlay = createOverlay();
    overlay.innerHTML = `
      <div class="ui-dialog">
        <div class="ui-dialog-title">${esc(title)}</div>
        <input class="ui-dialog-input" value="${esc(initial || '')}" autocomplete="off">
        <div class="ui-dialog-actions">
          <button class="ui-btn" data-act="cancel">Cancelar</button>
          <button class="ui-btn ui-btn-primary" data-act="ok">OK</button>
        </div>
      </div>`;
    const input = overlay.querySelector('input');
    const close = (value) => {
      overlay.remove();
      if (value === undefined) onCancel?.();
      else onSubmit?.(value);
    };
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(undefined));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') close(input.value);
    });
    setTimeout(() => input.focus(), 0);
    return { close: () => close(undefined) };
  },

  confirm(text, title, onOk, onCancel) {
    const overlay = createOverlay();
    overlay.innerHTML = `
      <div class="ui-dialog">
        <div class="ui-dialog-title">${esc(title)}</div>
        <div class="ui-dialog-text">${esc(text)}</div>
        <div class="ui-dialog-actions">
          <button class="ui-btn" data-act="cancel">Cancelar</button>
          <button class="ui-btn ui-btn-danger" data-act="ok">Confirmar</button>
        </div>
      </div>`;
    const close = (ok) => {
      overlay.remove();
      if (ok) onOk?.();
      else onCancel?.();
    };
    overlay.querySelector('[data-act="cancel"]').addEventListener('click', () => close(false));
    overlay.querySelector('[data-act="ok"]').addEventListener('click', () => close(true));
    return { close: () => close(false) };
  },

  actions({ buttons, title }) {
    const overlay = createOverlay(true);
    const sheet = document.createElement('div');
    sheet.className = 'ui-actions';
    if (title) {
      const t = document.createElement('div');
      t.className = 'ui-actions-title';
      t.textContent = title;
      sheet.appendChild(t);
    }
    for (const btn of buttons) {
      const b = document.createElement('button');
      b.className = 'ui-action-btn' + (btn.color === 'red' ? ' ui-action-danger' : '');
      b.textContent = btn.text;
      if (btn.subtext) {
        const sub = document.createElement('span');
        sub.className = 'ui-action-subtext';
        sub.textContent = btn.subtext;
        b.appendChild(sub);
      }
      b.addEventListener('click', () => {
        overlay.remove();
        btn.onClick?.();
      });
      sheet.appendChild(b);
    }
    const cancel = document.createElement('button');
    cancel.className = 'ui-action-btn ui-action-cancel';
    cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', () => overlay.remove());
    sheet.appendChild(cancel);
    overlay.appendChild(sheet);
    return { close: () => overlay.remove() };
  },

  // S29: toast de conquista 16-bit (borda dourada + bounce)
  achievement({ title, message, duration = 4000 } = {}) {
    const el = document.createElement('div');
    el.className = 'ui-achievement';
    el.innerHTML = `
      <div class="ui-achievement-title">🏆 ${esc(title || 'CONQUISTA DESBLOQUEADA!')}</div>
      <div class="ui-achievement-msg">${esc(message || '')}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    let timer = setTimeout(hide, duration);
    function hide() {
      clearTimeout(timer);
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }
    el.addEventListener('click', hide);
    return { close: hide };
  },

  // S29: partículas pixeladas (canvas overlay) — confetti/success/error/deploy
  particles: (() => {
    let canvas = null;
    let ctx = null;
    let particles = [];
    let running = false;
    const COLORS = {
      confetti: ['#fde047', '#ec4899', '#2dd4bf', '#c084fc'],
      success: ['#4ade80', '#2dd4bf'],
      error: ['#f87171', '#fb923c'],
      deploy: ['#fde047', '#fb923c', '#f87171'],
    };
    function ensureCanvas() {
      if (canvas) return;
      canvas = document.createElement('canvas');
      canvas.className = 'ui-particles';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      };
      resize();
      window.addEventListener('resize', resize);
    }
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }
      if (particles.length) requestAnimationFrame(tick);
      else running = false;
    }
    return {
      emit(x, y, type = 'confetti') {
        ensureCanvas();
        if (!ctx) return;
        const palette = COLORS[type] || COLORS.confetti;
        const count = type === 'confetti' ? 20 : 8;
        for (let i = 0; i < count; i += 1) {
          particles.push({
            x: x ?? window.innerWidth / 2,
            y: y ?? window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 1) * 8,
            color: palette[Math.floor(Math.random() * palette.length)],
            life: 60,
            size: 4 + Math.floor(Math.random() * 4),
            gravity: 0.3,
          });
        }
        if (!running) {
          running = true;
          requestAnimationFrame(tick);
        }
      },
    };
  })(),
};
