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
    let timer = setTimeout(hide, duration);
    function hide() {
      clearTimeout(timer);
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

  actions({ buttons }) {
    const overlay = createOverlay(true);
    const sheet = document.createElement('div');
    sheet.className = 'ui-actions';
    for (const btn of buttons) {
      const b = document.createElement('button');
      b.className = 'ui-action-btn' + (btn.color === 'red' ? ' ui-action-danger' : '');
      b.textContent = btn.text;
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
};
