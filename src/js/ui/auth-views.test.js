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

vi.mock('../core/project-service.js', () => ({
  projectService: {
    listLocalProjects: vi.fn(),
    newProject: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
    slugify: vi.fn((n) => n),
    PROJECT_TEMPLATES: [
      { id: 'html-css-js', name: 'HTML/CSS/JS puro', description: 'Site estático', files: [] },
      { id: 'curriculo-16bit', name: 'Currículo 16-bit', description: 'Currículo retro', files: [] },
    ],
    newProjectFromTemplate: vi.fn(),
    duplicateProject: vi.fn(),
    togglePin: vi.fn(),
    setTags: vi.fn(),
    exportProjectZip: vi.fn(),
    trashProject: vi.fn(),
    listTrashed: vi.fn(),
    restoreProject: vi.fn(),
    purgeProject: vi.fn(),
    emptyTrash: vi.fn(),
  },
}));

import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { authService } from '../auth/auth-service.js';
import { projectService } from '../core/project-service.js';

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
  const local = document.createElement('div');
  local.id = 'dashboard-local-projects';
  const projects = document.createElement('div');
  projects.id = 'dashboard-projects';
  const verify = document.createElement('div');
  verify.id = 'dashboard-verify';
  verify.classList.add('hidden');
  const openIde = document.createElement('button');
  openIde.id = 'dashboard-open-ide';
  const newProject = document.createElement('button');
  newProject.id = 'dashboard-new-project';
  const settingsBtn = document.createElement('button');
  settingsBtn.id = 'dashboard-settings-btn';
  const logoutBtn = document.createElement('button');
  logoutBtn.id = 'dashboard-logout';
  const verifyBtn = document.createElement('button');
  verifyBtn.id = 'dashboard-verify-btn';
  document.body.append(name, local, projects, verify, openIde, newProject, settingsBtn, logoutBtn, verifyBtn);
  map['dashboard-user-name'] = name;
  map['dashboard-local-projects'] = local;
  map['dashboard-projects'] = projects;
  map['dashboard-verify'] = verify;
  const search = document.createElement('input');
  search.id = 'dashboard-search';
  const sort = document.createElement('select');
  sort.id = 'dashboard-sort';
  const trashBtn = document.createElement('button');
  trashBtn.id = 'dashboard-trash-btn';
  const trash = document.createElement('div');
  trash.id = 'dashboard-trash';
  trash.className = 'hidden';
  const importZip = document.createElement('button');
  importZip.id = 'dashboard-import-zip';
  document.body.append(search, sort, trashBtn, trash, importZip);
  map['dashboard-search'] = search;
  map['dashboard-sort'] = sort;
  map['dashboard-trash'] = trash;
  map['dashboard-trash-btn'] = trashBtn;
  map['dashboard-import-zip'] = importZip;
};

function makeViews() {
  screens();
  const views = new AuthViews({
    notify: { toast: vi.fn(), prompt: vi.fn(), confirm: vi.fn(), actions: vi.fn() },
    onEnterIde: vi.fn(),
    onOpenProject: vi.fn(),
  });
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

describe('AuthViews — Dashboard (gestor de projetos)', () => {
  it('renderiza um card por projeto PUBLICADO com botões Renomear e Remover da lista', async () => {
    projectService.listLocalProjects.mockResolvedValue([]);
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

  it('renderiza um card por projeto LOCAL com ações de gestão (Continuar/Fixar/Duplicar/Renomear/Lixeira)', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'meu-mvp', name: 'meu-mvp', createdAt: 1, lastModified: 2, fileCount: 3, deployed: false, url: '', pinned: false, tags: [] },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    const cards = document.querySelectorAll('#dashboard-local-projects .project-card');
    expect(cards).toHaveLength(1);
    const actions = cards[0].querySelectorAll('.project-action');
    expect(actions[0].textContent).toBe('Continuar');
    expect(actions[1].textContent).toBe('Fixar');
    expect(actions[2].textContent).toBe('Duplicar');
    expect(actions[3].textContent).toBe('Tags');
    expect(actions[4].textContent).toBe('Exportar .zip');
    expect(actions[5].textContent).toBe('Renomear');
    expect(actions[6].textContent).toBe('Lixeira');
    expect(cards[0].querySelector('.project-badge')).toBeNull();
  });

  it('projeto local publicado exibe badge com link para a URL', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'meu-mvp', name: 'meu-mvp', createdAt: 1, lastModified: 2, fileCount: 3, deployed: true, url: 'https://renato0503.github.io/meu-mvp' },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    const badge = document.querySelector('#dashboard-local-projects .project-badge');
    expect(badge).toBeTruthy();
    expect(badge.href).toContain('renato0503.github.io');
  });

  it('Continuar chama onOpenProject com o id do projeto local', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'meu-mvp', name: 'meu-mvp', createdAt: 1, lastModified: 2, fileCount: 3, deployed: false, url: '' },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    const continueBtn = document.querySelector('#dashboard-local-projects .project-action-primary');
    continueBtn.click();
    await Promise.resolve();
    expect(views.onOpenProject).toHaveBeenCalledWith('meu-mvp');
  });

  it('Renomear projeto local chama projectService.renameProject e recarrega', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'meu-mvp', name: 'meu-mvp', createdAt: 1, lastModified: 2, fileCount: 3, deployed: false, url: '' },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    views.notify.prompt.mockImplementation((initial, title, onSubmit) => onSubmit('novo-nome'));
    document.querySelectorAll('#dashboard-local-projects .project-action')[5].click();
    await Promise.resolve();
    expect(projectService.renameProject).toHaveBeenCalledWith('meu-mvp', 'novo-nome');
  });

  it('Lixeira (excluir) pede confirmação e chama projectService.trashProject (só local, recuperável)', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'meu-mvp', name: 'meu-mvp', createdAt: 1, lastModified: 2, fileCount: 3, deployed: false, url: '', pinned: false, tags: [] },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    views.notify.confirm.mockImplementation((text, title, onOk) => onOk());
    document.querySelectorAll('#dashboard-local-projects .project-action')[6].click();
    await Promise.resolve();
    expect(projectService.trashProject).toHaveBeenCalledWith('meu-mvp');
  });

  it('Novo projeto pede nome, chama projectService.newProject e entra na IDE', async () => {
    projectService.newProject.mockResolvedValue({ id: 'novo', name: 'novo', fileCount: 0 });
    const views = makeViews();
    views.bindDashboard();

    views.notify.actions.mockImplementation(({ buttons }) => buttons[0].onClick());
    views.notify.prompt.mockImplementation((initial, title, onSubmit) => onSubmit('novo'));
    document.getElementById('dashboard-new-project').click();
    await Promise.resolve();
    expect(projectService.newProject).toHaveBeenCalledWith('novo');
    expect(views.onEnterIde).toHaveBeenCalled();
  });

  it('Renomear (publicado) chama dbService.renameProject e atualiza o rótulo sem recarregar', async () => {
    projectService.listLocalProjects.mockResolvedValue([]);
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

  it('Remover da lista pede confirmação, chama deleteProject e remove só o card (repo continua no GitHub)', async () => {
    projectService.listLocalProjects.mockResolvedValue([]);
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

describe('AuthViews — Dashboard UX (S40/S41)', () => {
  const localProjects = () => [
    { id: 'a', name: 'Alpha', createdAt: 1, lastModified: 10, fileCount: 1, deployed: false, url: '', pinned: false, tags: ['site'] },
    { id: 'b', name: 'Beta', createdAt: 1, lastModified: 20, fileCount: 2, deployed: false, url: '', pinned: true, tags: ['app'] },
    { id: 'c', name: 'Curriculo', createdAt: 1, lastModified: 30, fileCount: 3, deployed: false, url: '', pinned: false, tags: ['cv'] },
  ];

  it('busca por nome filtra os cards (case-insensitive)', async () => {
    projectService.listLocalProjects.mockResolvedValue(localProjects());
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    views.dashboardState.search = 'beta';
    await views.renderLocalProjects();
    const names = [...document.querySelectorAll('#dashboard-local-projects .project-name')].map((n) => n.textContent);
    expect(names).toEqual(['Beta']);
  });

  it('busca também casa por tag', async () => {
    projectService.listLocalProjects.mockResolvedValue(localProjects());
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    views.dashboardState.search = 'cv';
    await views.renderLocalProjects();
    const names = [...document.querySelectorAll('#dashboard-local-projects .project-name')].map((n) => n.textContent);
    expect(names).toEqual(['Curriculo']);
  });

  it('ordenação por nome A→Z mantém pins no topo', async () => {
    projectService.listLocalProjects.mockResolvedValue(localProjects());
    dbService.listProjects.mockResolvedValue([]);
    const views = makeViews();
    await views.renderDashboard();

    views.dashboardState.sort = 'name';
    await views.renderLocalProjects();
    const names = [...document.querySelectorAll('#dashboard-local-projects .project-name')].map((n) => n.textContent);
    expect(names).toEqual(['Beta', 'Alpha', 'Curriculo']);
  });

  it('Fixar chama togglePin e re-renderiza a lista', async () => {
    projectService.listLocalProjects.mockResolvedValue([
      { id: 'a', name: 'Alpha', createdAt: 1, lastModified: 10, fileCount: 1, deployed: false, url: '', pinned: false, tags: [] },
    ]);
    dbService.listProjects.mockResolvedValue([]);
    projectService.togglePin.mockResolvedValue({ id: 'a', pinned: true });
    const views = makeViews();
    await views.renderDashboard();

    document.querySelectorAll('#dashboard-local-projects .project-action')[1].click();
    await Promise.resolve();
    expect(projectService.togglePin).toHaveBeenCalledWith('a');
  });

  it('Novo projeto abre action sheet com "Em branco" + templates do catálogo', () => {
    const views = makeViews();
    views.bindDashboard();
    views.notify.actions.mockImplementation(({ buttons }) => {
      const texts = buttons.map((b) => b.text);
      expect(texts).toContain('Em branco');
      expect(texts).toContain('HTML/CSS/JS puro');
      expect(texts).toContain('Currículo 16-bit');
    });
    document.getElementById('dashboard-new-project').click();
    expect(views.notify.actions).toHaveBeenCalled();
  });

  it('Novo projeto a partir de template chama newProjectFromTemplate e entra na IDE', async () => {
    projectService.newProjectFromTemplate.mockResolvedValue({ id: 'curriculo', fileCount: 2 });
    const views = makeViews();
    views.bindDashboard();
    views.notify.actions.mockImplementation(({ buttons }) => buttons[1].onClick());
    views.notify.prompt.mockImplementation(async (initial, title, onSubmit) => {
      await onSubmit('Meu Currículo');
    });
    document.getElementById('dashboard-new-project').click();
    expect(projectService.newProjectFromTemplate).toHaveBeenCalledWith('Meu Currículo', 'html-css-js');
    await Promise.resolve();
    expect(views.onEnterIde).toHaveBeenCalled();
  });

  it('toggleTrashView renderiza cards da lixeira com Restaurar e Apagar definitivamente', async () => {
    projectService.listTrashed.mockResolvedValue([
      { id: 'x', name: 'apagado', fileCount: 2, trashedAt: Date.now(), pinned: false, tags: [] },
    ]);
    const views = makeViews();
    await views.toggleTrashView();
    const cards = document.querySelectorAll('#dashboard-trash .project-card');
    expect(cards).toHaveLength(1);
    const actions = cards[0].querySelectorAll('.project-action');
    expect(actions[0].textContent).toBe('Restaurar');
    expect(actions[1].textContent).toBe('Apagar definitivamente');
  });

  it('Restaurar na lixeira chama restoreProject e volta para a lista', async () => {
    projectService.listTrashed.mockResolvedValue([
      { id: 'x', name: 'apagado', fileCount: 2, trashedAt: Date.now(), pinned: false, tags: [] },
    ]);
    projectService.restoreProject.mockResolvedValue({ id: 'x', name: 'apagado' });
    const views = makeViews();
    await views.toggleTrashView();
    views.notify.confirm.mockImplementation((t, ti, ok) => ok());
    document.querySelector('#dashboard-trash .project-action-primary').click();
    await Promise.resolve();
    expect(projectService.restoreProject).toHaveBeenCalledWith('x');
  });

  it('Importar .zip dispara file picker e importa como novo projeto local', async () => {
    const views = makeViews();
    views.bindDashboard();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    document.getElementById('dashboard-import-zip').click();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
