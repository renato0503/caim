// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthViews } from './auth-views.js';

// S14/J2: salvar até 3 chaves cifradas; reabrir Settings preserva as chaves
// já salvas sem redigitar; desativar remove do failover (filtro por active).

vi.mock('../db/db-service.js', () => ({
  dbService: {
    getUserProfile: vi.fn(),
    updateLlmKeys: vi.fn(),
    listProjects: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
  },
}));

vi.mock('../security/security-service.js', () => ({
  security: {
    encrypt: vi.fn(),
    encryptForUser: vi.fn(),
  },
}));

vi.mock('../auth/auth-service.js', () => ({
  authService: { logout: vi.fn(), isEmailVerified: vi.fn(() => true) },
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
  const name = document.createElement('div');
  name.id = 'dashboard-user-name';
  const projects = document.createElement('div');
  projects.id = 'dashboard-projects';
  const verify = document.createElement('div');
  verify.id = 'dashboard-verify';
  verify.classList.add('hidden');
  document.body.append(name, projects, verify);
  map['dashboard-user-name'] = name;
  map['dashboard-projects'] = projects;
  map['dashboard-verify'] = verify;
};

function makeViews() {
  screens();
  const views = new AuthViews({ notify: { toast: vi.fn(), prompt: vi.fn(), confirm: vi.fn() }, onEnterIde: vi.fn() });
  views.devMode = false;
  views.user = { uid: 'u1', displayName: 'Teste', email: 'teste@x.com' };
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
    security.encryptForUser.mockResolvedValue(encrypted('ivN', 'ctN'));
    dbService.getUserProfile.mockResolvedValue(null);
    const views = makeViews();

    await views.loadSettings();
    const keyInput = document.querySelector('#settings-list [data-field="key"]');
    keyInput.value = 'sk-plaintext';

    await views.saveSettings();
    expect(security.encryptForUser).toHaveBeenCalledWith('u1', 'sk-plaintext');
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

  it('goBack volta para a tela anterior (settings aberto a partir da IDE)', () => {
    const views = makeViews();
    views.show('dashboard');
    views.show('ide');
    views.show('settings');
    expect(views.currentScreen).toBe('settings');
    views.goBack();
    expect(views.currentScreen).toBe('ide');
    views.goBack();
    expect(views.currentScreen).toBe('dashboard');
  });
});

describe('AuthViews — Dashboard (projetos do usuário)', () => {
  it('renderiza um card por projeto com botões Renomear e Excluir', async () => {
    dbService.listProjects.mockResolvedValue([
      { id: 'p1', name: 'meu-mvp', url: 'https://renato0503.github.io/meu-mvp', fileCount: 3, ownerId: 'u1' },
      { id: 'p2', name: 'outro', url: 'https://renato0503.github.io/outro', fileCount: 2, ownerId: 'u1' },
    ]);
    const views = makeViews();
    await views.renderDashboard();

    const cards = document.querySelectorAll('#dashboard-projects .project-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.project-name').textContent).toBe('meu-mvp');
    expect(cards[0].querySelector('.project-action')).toBeTruthy();
    expect(cards[0].querySelector('.project-action-danger')).toBeTruthy();
  });

  it('Renomear chama dbService.renameProject e atualiza o rótulo sem recarregar', async () => {
    dbService.listProjects.mockResolvedValue([
      { id: 'p1', name: 'meu-mvp', url: 'https://renato0503.github.io/meu-mvp', fileCount: 3, ownerId: 'u1' },
    ]);
    dbService.renameProject.mockResolvedValue(undefined);
    const views = makeViews();
    await views.renderDashboard();

    const card = document.querySelector('#dashboard-projects .project-card');
    const renameBtn = card.querySelector('.project-action');
    const confirmMock = views.notify.prompt.mockImplementation((initial, title, onSubmit) => onSubmit('novo-nome'));
    renameBtn.click();

    await Promise.resolve();
    expect(dbService.renameProject).toHaveBeenCalledWith('p1', 'novo-nome');
    expect(card.querySelector('.project-name').textContent).toBe('novo-nome');
  });

  it('Excluir pede confirmação, chama deleteProject e remove só o card (repo continua no GitHub)', async () => {
    dbService.listProjects.mockResolvedValue([
      { id: 'p1', name: 'meu-mvp', url: 'https://renato0503.github.io/meu-mvp', fileCount: 3, ownerId: 'u1' },
    ]);
    dbService.deleteProject.mockResolvedValue(undefined);
    const views = makeViews();
    await views.renderDashboard();

    const card = document.querySelector('#dashboard-projects .project-card');
    views.notify.confirm.mockImplementation((text, title, onOk) => onOk());
    card.querySelector('.project-action-danger').click();

    await Promise.resolve();
    expect(dbService.deleteProject).toHaveBeenCalledWith('p1');
    expect(document.querySelector('#dashboard-projects .project-card')).toBeNull();
  });
});
