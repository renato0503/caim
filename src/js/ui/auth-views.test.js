// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthViews } from './auth-views.js';

// S14/J2: salvar até 3 chaves cifradas; reabrir Settings preserva as chaves
// já salvas sem redigitar; desativar remove do failover (filtro por active).

vi.mock('../db/db-service.js', () => ({
  dbService: {
    getUserProfile: vi.fn(),
    updateLlmKeys: vi.fn(),
  },
}));

vi.mock('../security/security-service.js', () => ({
  security: {
    encrypt: vi.fn(),
  },
}));

vi.mock('../auth/auth-service.js', () => ({
  authService: { logout: vi.fn() },
}));

import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { authService } from '../auth/auth-service.js';

const screens = () => {
  const ids = ['screen-auth', 'screen-dashboard', 'screen-settings', 'screen-ide'];
  const map = {};
  for (const id of ids) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    map[id] = el;
  }
  const list = document.createElement('div');
  list.id = 'settings-list';
  document.body.appendChild(list);
  map['settings-list'] = list;
};

function makeViews() {
  screens();
  const views = new AuthViews({ notify: { toast: vi.fn() }, onEnterIde: vi.fn() });
  views.devMode = false;
  views.user = { uid: 'u1' };
  return views;
}

const encrypted = (iv, ct) => ({ iv, ciphertext: ct });

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('AuthViews — Settings (3 APIs cifradas)', () => {
  it('renderiza 3 linhas mesmo sem chaves salvas', async () => {
    dbService.getUserProfile.mockResolvedValue(null);
    const views = makeViews();
    await views.loadSettings();
    const rows = document.querySelectorAll('#settings-list .settings-row');
    expect(rows).toHaveLength(3);
  });

  it('reabrir Settings e salvar sem redigitar preserva as chaves cifradas (regressão S14)', async () => {
    const stored = [{ provider: 'deepseek', key: encrypted('iv1', 'ct1'), baseUrl: '', model: '', priority: 1, active: true }];
    dbService.getUserProfile.mockResolvedValue({ llm_keys: stored });
    const views = makeViews();

    await views.loadSettings();
    expect(views.screens.settings).toBeTruthy();

    await views.saveSettings();
    const saved = dbService.updateLlmKeys.mock.calls[0][1];
    expect(saved).toHaveLength(1);
    expect(saved[0].key).toEqual(encrypted('iv1', 'ct1'));
    expect(saved[0].provider).toBe('deepseek');
  });

  it('chave digitada é cifrada antes de salvar (nunca texto puro)', async () => {
    security.encrypt.mockResolvedValue(encrypted('ivN', 'ctN'));
    dbService.getUserProfile.mockResolvedValue(null);
    const views = makeViews();

    await views.loadSettings();
    const keyInput = document.querySelector('#settings-list [data-field="key"]');
    keyInput.value = 'sk-plaintext';

    await views.saveSettings();
    expect(security.encrypt).toHaveBeenCalledWith('sk-plaintext');
    const saved = dbService.updateLlmKeys.mock.calls[0][1];
    expect(saved[0].key).toEqual(encrypted('ivN', 'ctN'));
    expect(JSON.stringify(saved)).not.toContain('sk-plaintext');
  });

  it('linha desativada continua salva mas com active=false (failover a ignora)', async () => {
    dbService.getUserProfile.mockResolvedValue(null);
    const views = makeViews();

    await views.loadSettings();
    const row = document.querySelector('#settings-list .settings-row');
    const toggle = row.querySelector('[data-field="active"]');
    toggle.checked = false;
    const keyInput = row.querySelector('[data-field="key"]');
    keyInput.value = 'sk-2';

    await views.saveSettings();
    const saved = dbService.updateLlmKeys.mock.calls[0][1];
    expect(saved[0].active).toBe(false);
  });

  it('botão "Sair" na tela Settings chama authService.logout', () => {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'settings-logout';
    const backBtn = document.createElement('button');
    backBtn.id = 'settings-back';
    const saveBtn = document.createElement('button');
    saveBtn.id = 'settings-save';
    document.body.append(logoutBtn, backBtn, saveBtn);

    const views = makeViews();
    views.bindSettings();
    logoutBtn.click();
    expect(authService.logout).toHaveBeenCalled();
  });
});
