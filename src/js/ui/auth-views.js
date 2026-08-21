import { authService } from '../auth/auth-service.js';
import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { agentManager } from '../agents/agent-manager.js';
import { projectService } from '../core/project-service.js';
import { loadEditorPrefs, saveEditorPrefs, THEMES, FONT_SIZES, FONT_FAMILIES } from '../core/editor-prefs.js';

export const PROVIDER_LABELS = { deepseek: 'DeepSeek', qwen: 'Qwen', openai: 'OpenAI', nvidia: 'NVIDIA', groq: 'Groq', opencode: 'OpenCode' };

export class AuthViews {
  constructor({ notify, onEnterIde, onOpenProject, onEditorPrefsChange }) {
    this.notify = notify;
    this.onEnterIde = onEnterIde;
    this.onOpenProject = onOpenProject;
    this.onEditorPrefsChange = onEditorPrefsChange;
    this.user = null;
    this.devMode = false;
    this.signupMode = false;
    this.navStack = [];
    this.currentScreen = null;
    this.screens = {
      auth: document.getElementById('screen-auth'),
      dashboard: document.getElementById('screen-dashboard'),
      settings: document.getElementById('screen-settings'),
      ide: document.getElementById('screen-ide'),
    };
  }

  toast(text, error = false) {
    this.notify.toast(text, { position: 'center' });
  }

  show(name) {
    for (const s of Object.values(this.screens)) s.classList.remove('active');
    this.screens[name].classList.add('active');
    // Rastreia a tela anterior para o botão "Voltar" retornar corretamente
    // (ex.: Configurações abertas a partir da IDE volta para a IDE, não pro dashboard).
    if (name !== this.currentScreen && this.currentScreen) {
      this.navStack.push(this.currentScreen);
      if (this.navStack.length > 5) this.navStack.shift();
    }
    this.currentScreen = name;
    this.updateBackVisibility();
  }

  updateBackVisibility() {
    const canGoBack = this.navStack.length > 0;
    document.querySelectorAll('[data-nav-back]').forEach((btn) => {
      btn.classList.toggle('hidden', !canGoBack);
    });
  }

  goBack() {
    const prev = this.navStack.pop() || 'dashboard';
    this.currentScreen = prev;
    for (const s of Object.values(this.screens)) s.classList.remove('active');
    this.screens[prev].classList.add('active');
    this.updateBackVisibility();
  }

  async init() {
    this.bindAuth();
    this.bindDashboard();
    this.bindSettings();

    if (!authService.isConfigured) {
      this.devMode = true;
      document.getElementById('auth-config-note').classList.remove('hidden');
      document.getElementById('auth-dev-btn').classList.remove('hidden');
      document.getElementById('auth-dev-btn').addEventListener('click', () => {
        this.show('dashboard');
        this.renderDashboard();
      });
      this.show('auth');
      return;
    }

    authService.onAuthStateChanged((user) => {
      this.user = user;
      this.navStack = [];
      this.currentScreen = null;
      if (user) {
        this.show('dashboard');
        this.renderDashboard();
      } else {
        this.show('auth');
      }
    });
  }

  // ---------------- Auth (login/cadastro) ----------------

  bindAuth() {
    const toggle = (signup) => {
      this.signupMode = signup;
      document.getElementById('auth-tab-login').classList.toggle('active', !signup);
      document.getElementById('auth-tab-signup').classList.toggle('active', signup);
      document.getElementById('auth-name').classList.toggle('hidden', !signup);
      document.getElementById('auth-whatsapp').classList.toggle('hidden', !signup);
      document.getElementById('auth-forgot').classList.toggle('hidden', signup);
      document.getElementById('auth-submit').textContent = signup ? 'Criar conta' : 'Entrar';
      this.setError('');
    };
    document.getElementById('auth-tab-login').addEventListener('click', () => toggle(false));
    document.getElementById('auth-tab-signup').addEventListener('click', () => toggle(true));

    // S20: "Esqueci minha senha" — envia link de reset por email
    document.getElementById('auth-forgot').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      if (!email) {
        this.setError('Digite seu email para recuperar a senha.');
        return;
      }
      try {
        await authService.sendPasswordReset(email);
        this.setError('');
        this.toast('Enviamos um link de recuperação para seu email.');
      } catch (err) {
        this.setError(this.friendlyAuthError(err));
      }
    });

    document.getElementById('auth-submit').addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!email || !password) {
        this.setError('Preencha email e senha.');
        return;
      }
      try {
        if (this.signupMode) {
          const name = document.getElementById('auth-name').value.trim();
          if (!name) return this.setError('Informe seu nome completo.');
          const whatsapp = document.getElementById('auth-whatsapp').value.trim();
          this.setBusy(true);
          await authService.signup({ name, email, password, whatsapp });
        } else {
          this.setBusy(true);
          await authService.login(email, password);
        }
      } catch (err) {
        this.setError(this.friendlyAuthError(err));
      } finally {
        this.setBusy(false);
      }
    });
  }

  friendlyAuthError(err) {
    return authService.friendlyAuthError(err);
  }

  setError(text) {
    const el = document.getElementById('auth-error');
    el.textContent = text;
    el.classList.toggle('visible', Boolean(text));
  }

  setBusy(busy) {
    const btn = document.getElementById('auth-submit');
    btn.disabled = busy;
    btn.textContent = busy ? 'Aguarde…' : this.signupMode ? 'Criar conta' : 'Entrar';
  }

  // ---------------- Dashboard ----------------

  bindDashboard() {
    document.getElementById('dashboard-open-ide').addEventListener('click', () => this.onEnterIde?.());
    document.getElementById('dashboard-new-project').addEventListener('click', () => this.newProject());
    document.getElementById('dashboard-import-zip').addEventListener('click', () => this.importZip());
    document.getElementById('dashboard-trash-btn').addEventListener('click', () => this.toggleTrashView());
    document.getElementById('dashboard-search').addEventListener('input', () => {
      this.dashboardState.search = document.getElementById('dashboard-search').value;
      this.renderLocalProjects();
    });
    document.getElementById('dashboard-sort').addEventListener('change', () => {
      this.dashboardState.sort = document.getElementById('dashboard-sort').value;
      this.renderLocalProjects();
    });
    document.getElementById('dashboard-settings-btn').addEventListener('click', async () => {
      await this.loadSettings();
      this.show('settings');
    });
    document.getElementById('dashboard-logout').addEventListener('click', async () => {
      await authService.logout();
    });
    // S20: reenviar link de verificação de email
    document.getElementById('dashboard-verify-btn').addEventListener('click', async () => {
      try {
        await authService.sendEmailVerification();
        this.toast('Link de verificação reenviado. Cheque seu email.');
      } catch (err) {
        this.toast(`Erro: ${this.friendlyAuthError(err)}`, true);
      }
    });
  }

  // S36/S40: cria projeto vazio (em branco) ou a partir de um template.
  async newProject() {
    if (!this.user || this.devMode) {
      this.toast('Faça login para criar um projeto.', true);
      return;
    }
    const buttons = [{ text: 'Em branco', onClick: () => this.newProjectPrompt(null) }];
    for (const t of projectService.PROJECT_TEMPLATES || []) {
      buttons.push({ text: t.name, subtext: t.description, onClick: () => this.newProjectPrompt(t) });
    }
    this.notify.actions({ title: 'Novo projeto', buttons });
  }

  newProjectPrompt(template) {
    this.notify.prompt('', 'Nome do projeto', async (value) => {
      const name = (value || '').trim();
      if (!name) return;
      try {
        if (template) await projectService.newProjectFromTemplate(name, template.id);
        else await projectService.newProject(name);
        this.toast(`Projeto "${name}" criado${template ? ` (template ${template.name})` : ''}`);
        await this.onEnterIde?.();
      } catch (err) {
        this.toast(`Erro: ${err.message}`, true);
      }
    });
  }

  // S41 — importa um .zip como novo projeto local.
  async importZip() {
    if (!this.user || this.devMode) {
      this.toast('Faça login para importar um projeto.', true);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const project = await projectService.importProjectZip(file);
        this.toast(`Projeto "${project.name}" importado (${project.fileCount} arquivos)`);
        this.renderDashboard();
      } catch (err) {
        this.toast(`Erro ao importar: ${err.message}`, true);
      }
    });
    input.click();
  }

  // S41 — alterna a visão da Lixeira (Restaurar / Apagar definitivamente).
  async toggleTrashView() {
    const trashEl = document.getElementById('dashboard-trash');
    const localEl = document.getElementById('dashboard-local-projects');
    const isOpen = !trashEl.classList.contains('hidden');
    trashEl.classList.toggle('hidden', isOpen);
    localEl.classList.toggle('hidden', !isOpen);
    document.getElementById('dashboard-trash-btn').textContent = isOpen ? 'Lixeira' : 'Voltar';
    if (!isOpen) {
      const list = await projectService.listTrashed();
      trashEl.innerHTML = '';
      if (!list.length) {
        trashEl.innerHTML = '<div class="auth-note">A lixeira está vazia.</div>';
      }
      for (const p of list) {
        trashEl.appendChild(this.trashedProjectCard(p));
      }
      const emptyBtn = document.createElement('button');
      emptyBtn.className = 'dash-btn dash-btn-sm dash-danger';
      emptyBtn.textContent = 'Esvaziar lixeira';
      emptyBtn.addEventListener('click', async () => {
        this.notify.confirm('Apagar DEFINITIVAMENTE todos os projetos da lixeira? (só local — nunca GitHub)', 'Esvaziar lixeira', async () => {
          const n = await projectService.emptyTrash();
          this.toast(n ? `Lixeira esvaziada (${n} projeto${n > 1 ? 's' : ''})` : 'Lixeira já vazia');
          this.toggleTrashView();
          this.renderDashboard();
        });
      });
      trashEl.appendChild(emptyBtn);
    }
  }

  trashedProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    const head = document.createElement('div');
    head.className = 'project-card-head';
    const nameEl = document.createElement('span');
    nameEl.className = 'project-name';
    nameEl.textContent = p.name || p.id;
    head.appendChild(nameEl);
    card.appendChild(head);
    const meta = document.createElement('div');
    meta.className = 'project-meta';
    meta.textContent = `${p.fileCount || 0} arquivos · na lixeira desde ${new Date(p.trashedAt || Date.now()).toLocaleDateString('pt-BR')}`;
    card.appendChild(meta);
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = 'project-action project-action-primary';
    restoreBtn.textContent = 'Restaurar';
    restoreBtn.addEventListener('click', async () => {
      try {
        await projectService.restoreProject(p.id);
        this.toast('Projeto restaurado');
        this.toggleTrashView();
        this.renderDashboard();
      } catch (err) {
        this.toast(`Erro ao restaurar: ${err.message}`, true);
      }
    });
    const purgeBtn = document.createElement('button');
    purgeBtn.type = 'button';
    purgeBtn.className = 'project-action project-action-danger';
    purgeBtn.textContent = 'Apagar definitivamente';
    purgeBtn.addEventListener('click', () => {
      this.notify.confirm('Isso apaga o projeto em definitivo deste dispositivo (o GitHub não é tocado).', 'Apagar definitivamente?', async () => {
        try {
          await projectService.purgeProject(p.id);
          this.toast('Projeto apagado em definitivo');
          this.toggleTrashView();
        } catch (err) {
          this.toast(`Erro ao apagar: ${err.message}`, true);
        }
      });
    });
    actions.appendChild(restoreBtn);
    actions.appendChild(purgeBtn);
    card.appendChild(actions);
    return card;
  }

  async renderDashboard() {
    this.dashboardState = { search: '', sort: 'recent' };
    const searchEl = document.getElementById('dashboard-search');
    if (searchEl) searchEl.value = '';
    const sortEl = document.getElementById('dashboard-sort');
    if (sortEl) sortEl.value = 'recent';
    const nameEl = document.getElementById('dashboard-user-name');
    const localEl = document.getElementById('dashboard-local-projects');
    const trashEl = document.getElementById('dashboard-trash');
    const deployedEl = document.getElementById('dashboard-projects');
    const verifyEl = document.getElementById('dashboard-verify');
    if (trashEl) trashEl.classList.add('hidden');
    if (localEl) localEl.classList.remove('hidden');
    if (this.devMode || !this.user) {
      nameEl.textContent = this.devMode ? 'Modo dev (Firebase não configurado)' : '';
      localEl.innerHTML = '<div class="auth-note">Sem histórico de projetos neste modo.</div>';
      deployedEl.innerHTML = '<div class="auth-note">Sem histórico de MVPs neste modo.</div>';
      if (verifyEl) verifyEl.classList.add('hidden');
      return;
    }
    nameEl.textContent = this.user.displayName || this.user.email || 'Bem-vindo(a)';
    // S20: badge de email não verificado
    if (verifyEl) verifyEl.classList.toggle('hidden', !!authService.isEmailVerified());
    try {
      await this.renderLocalProjects();
      // Projetos publicados (Firestore — só a lista; o repo no GitHub é imutável aqui)
      const projects = await dbService.listProjects(this.user.uid);
      deployedEl.innerHTML = '';
      if (!projects.length) {
        deployedEl.innerHTML = '<div class="auth-note">Nenhum MVP publicado ainda. Publique na IDE!</div>';
      }
      for (const p of projects) {
        deployedEl.appendChild(this.deployedProjectCard(p));
      }
    } catch (err) {
      deployedEl.innerHTML = `<div class="auth-note">Erro ao listar projetos: ${escapeHtml(err.message)}</div>`;
    }
  }

  // S40 — lista local com busca (nome/tag), ordenação e pins fixados no topo.
  async renderLocalProjects() {
    const localEl = document.getElementById('dashboard-local-projects');
    if (!localEl) return;
    let projects = await projectService.listLocalProjects();
    const q = (this.dashboardState?.search || '').trim().toLowerCase();
    if (q) {
      projects = projects.filter((p) => {
        const hay = `${p.name || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const sort = this.dashboardState?.sort || 'recent';
    if (sort === 'name') {
      projects = [...projects].sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      });
    }
    localEl.innerHTML = '';
    if (!projects.length) {
      localEl.innerHTML = '<div class="auth-note">Nenhum projeto local. Toque em "Novo projeto" (ou importe um .zip).</div>';
      return;
    }
    for (const p of projects) {
      localEl.appendChild(this.localProjectCard(p));
    }
  }

  // S36: card de projeto local — Continuar / Renomear / Excluir (só local).
  // S40: + Fixar (pin) / Duplicar / Tags / Exportar .zip. S41: excluir vira lixeira.
  localProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    const head = document.createElement('div');
    head.className = 'project-card-head';
    const nameEl = document.createElement('span');
    nameEl.className = 'project-name';
    nameEl.textContent = p.name || p.id;
    head.appendChild(nameEl);
    if (p.pinned) {
      const pin = document.createElement('span');
      pin.className = 'project-pin';
      pin.textContent = '📌';
      pin.title = 'Fixado';
      head.appendChild(pin);
    }
    if (p.deployed && p.url) {
      const badge = document.createElement('a');
      badge.className = 'project-badge';
      badge.href = p.url;
      badge.target = '_blank';
      badge.rel = 'noopener';
      badge.textContent = '🚀 publicado';
      head.appendChild(badge);
    }
    card.appendChild(head);
    if (p.tags && p.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'project-tags';
      for (const t of p.tags) {
        const chip = document.createElement('span');
        chip.className = 'project-tag';
        chip.textContent = t;
        tags.appendChild(chip);
      }
      card.appendChild(tags);
    }
    const meta = document.createElement('div');
    meta.className = 'project-meta';
    meta.textContent = `${p.fileCount || 0} arquivos · ${new Date(p.lastModified || p.createdAt || Date.now()).toLocaleDateString('pt-BR')}`;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const continueBtn = document.createElement('button');
    continueBtn.type = 'button';
    continueBtn.className = 'project-action project-action-primary';
    continueBtn.textContent = 'Continuar';
    continueBtn.addEventListener('click', async () => {
      try {
        await this.onOpenProject?.(p.id);
      } catch (err) {
        this.toast(`Erro ao abrir: ${err.message}`, true);
      }
    });
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'project-action';
    pinBtn.textContent = p.pinned ? 'Desfixar' : 'Fixar';
    pinBtn.addEventListener('click', async () => {
      try {
        await projectService.togglePin(p.id);
        this.renderLocalProjects();
      } catch (err) {
        this.toast(`Erro: ${err.message}`, true);
      }
    });
    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.className = 'project-action';
    dupBtn.textContent = 'Duplicar';
    dupBtn.addEventListener('click', async () => {
      try {
        await projectService.duplicateProject(p.id);
        this.toast('Projeto duplicado');
        this.renderLocalProjects();
      } catch (err) {
        this.toast(`Erro ao duplicar: ${err.message}`, true);
      }
    });
    const tagsBtn = document.createElement('button');
    tagsBtn.type = 'button';
    tagsBtn.className = 'project-action';
    tagsBtn.textContent = 'Tags';
    tagsBtn.addEventListener('click', () => {
      this.notify.prompt((p.tags || []).join(', '), 'Tags (separadas por vírgula)', async (value) => {
        try {
          await projectService.setTags(p.id, String(value || '').split(','));
          this.renderLocalProjects();
        } catch (err) {
          this.toast(`Erro: ${err.message}`, true);
        }
      });
    });
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = 'project-action';
    exportBtn.textContent = 'Exportar .zip';
    exportBtn.addEventListener('click', async () => {
      try {
        const { blob, project } = await projectService.exportProjectZip(p.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.id}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.toast(`Exportado: ${project.name}.zip`);
      } catch (err) {
        this.toast(`Erro ao exportar: ${err.message}`, true);
      }
    });
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'project-action';
    renameBtn.textContent = 'Renomear';
    renameBtn.addEventListener('click', () => {
      this.notify.prompt(p.name || '', 'Renomear projeto', async (value) => {
        const name = (value || '').trim();
        if (!name) return;
        try {
          await projectService.renameProject(p.id, name);
          this.renderLocalProjects();
          this.toast('Projeto renomeado');
        } catch (err) {
          this.toast(`Erro ao renomear: ${err.message}`, true);
        }
      });
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'project-action project-action-danger';
    delBtn.textContent = 'Lixeira';
    delBtn.addEventListener('click', () => {
      this.notify.confirm(
        'Isso move o projeto para a LIXEIRA deste dispositivo (recuperável). Se ele foi publicado, o site continua no GitHub.',
        'Mover para a lixeira?',
        async () => {
          try {
            await projectService.trashProject(p.id);
            this.renderLocalProjects();
            this.toast('Projeto movido para a lixeira');
          } catch (err) {
            this.toast(`Erro ao mover: ${err.message}`, true);
          }
        }
      );
    });
    actions.appendChild(continueBtn);
    actions.appendChild(pinBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(tagsBtn);
    actions.appendChild(exportBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    card.appendChild(actions);
    return card;
  }

  // S36: card de projeto publicado — Abrir / Renomear rótulo / Remover da lista
  // (NUNCA apaga o repo no GitHub).
  deployedProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    const link = document.createElement('a');
    link.className = 'project-link';
    link.href = p.url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.innerHTML = `<span class="project-name">${escapeHtml(p.name)}</span><span class="project-url">${escapeHtml(p.url)}</span>`;
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    const renameBtn = document.createElement('button');
    renameBtn.type = 'button';
    renameBtn.className = 'project-action';
    renameBtn.textContent = 'Renomear';
    renameBtn.addEventListener('click', () => this.renameProjectCard(card, p));
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'project-action project-action-danger';
    delBtn.textContent = 'Remover da lista';
    delBtn.addEventListener('click', () => this.deleteProjectCard(card, p));
    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);
    card.appendChild(link);
    card.appendChild(actions);
    return card;
  }

  // Renomeia apenas o rótulo (name no Firestore) — o repo no GitHub fica intacto.
  renameProjectCard(card, p) {
    this.notify.prompt(p.name || '', 'Renomear projeto', async (value) => {
      const name = (value || '').trim();
      if (!name) return;
      try {
        await dbService.renameProject(p.id, name);
        p.name = name;
        const nameEl = card.querySelector('.project-name');
        if (nameEl) nameEl.textContent = name;
        this.toast('Projeto renomeado');
      } catch (err) {
        this.toast(`Erro ao renomear: ${err.message}`, true);
      }
    });
  }

  // Remove da lista do usuário (Firestore) — o repo continua salvo no GitHub.
  deleteProjectCard(card, p) {
    this.notify.confirm(
      'Isso remove o projeto apenas da sua lista. O repositório continua salvo no GitHub.',
      'Remover da lista?',
      async () => {
        try {
          await dbService.deleteProject(p.id);
          card.remove();
          this.toast('Projeto removido da lista');
        } catch (err) {
          this.toast(`Erro ao excluir: ${err.message}`, true);
        }
      }
    );
  }

  // ---------------- Settings (3 APIs LLM) ----------------

  async loadSettings() {
    let keys = [];
    if (!this.devMode && this.user) {
      const profile = await dbService.getUserProfile(this.user.uid);
      keys = profile?.llm_keys || [];
    }
    this.renderSettings(keys);
    this.renderEditorPrefs(await loadEditorPrefs());
  }

  // S39 — popular os selects de preferências do editor no Settings.
  renderEditorPrefs(prefs) {
    const fill = (id, options, value) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '';
      for (const opt of options) {
        const o = document.createElement('option');
        o.value = String(opt.value ?? opt);
        o.textContent = opt.label ?? String(opt);
        sel.appendChild(o);
      }
      sel.value = String(value);
    };
    fill('prefs-theme', THEMES, prefs.theme);
    fill('prefs-font-size', FONT_SIZES, prefs.fontSize);
    fill('prefs-font-family', FONT_FAMILIES, prefs.fontFamily);
  }

  async readEditorPrefs() {
    const val = (id) => document.getElementById(id)?.value;
    return {
      theme: val('prefs-theme') || '16bit',
      fontSize: Number(val('prefs-font-size')) || 14,
      fontFamily: val('prefs-font-family') || 'mono',
    };
  }

  renderSettings(keys) {
    const list = document.getElementById('settings-list');
    list.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const data = keys[i] || { provider: 'deepseek', key: null, baseUrl: '', model: '', priority: i + 1, active: i === 0 };
      list.appendChild(this.settingsRow(i, data));
    }
  }

  // Autodetecta o provider pelo prefixo da chave (S21 simplificado):
  // nvapi- → NVIDIA · sk-aa → DeepSeek · sk- → OpenAI · demais → OpenCode (precisa baseUrl)
  detectProvider(key) {
    const k = (key || '').trim();
    if (/^nvapi-/.test(k)) return 'nvidia';
    if (/^gsk_/.test(k)) return 'groq';
    if (/^sk-[a-f0-9]{20,}/.test(k)) return 'deepseek';
    if (/^sk-/.test(k)) return 'openai';
    if (/^github_pat_/.test(k)) return 'opencode';
    return 'opencode';
  }

  settingsRow(index, data) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    // S14: preserva a chave cifrada já salva no Firestore.
    row.__encrypted = data.key || null;
    const provider = data.provider || 'deepseek';
    row.__provider = provider; // provider original (fallback p/ chave cifrada já salva)
    row.innerHTML = `
      <div class="settings-row-head">
        <span class="settings-row-title">API ${index + 1}</span>
        <span class="settings-provider" data-field="providerLabel">${PROVIDER_LABELS[provider] || provider}</span>
        <label class="settings-toggle">
          <input type="checkbox" data-field="active" ${data.active !== false ? 'checked' : ''}>
          <span>Ativa</span>
        </label>
      </div>
      <div class="settings-fields">
        <input data-field="key" type="password" placeholder="Cole a API key aqui" value="" autocomplete="off">
        <input data-field="baseUrl" placeholder="Base URL (só p/ OpenCode)" value="${escapeHtml(data.baseUrl || '')}" class="hidden">
        <input data-field="model" type="hidden" value="${escapeHtml(data.model || '')}">
        <input data-field="priority" type="hidden" value="${data.priority || index + 1}">
        <div class="settings-key-row">
          <button class="dash-btn dash-btn-sm" data-act="test" type="button">Testar</button>
        </div>
        <div class="settings-test-result" data-field="testResult"></div>
      </div>
    `;

    const keyInput = row.querySelector('[data-field="key"]');
    const baseUrlInput = row.querySelector('[data-field="baseUrl"]');
    const labelEl = row.querySelector('[data-field="providerLabel"]');

    // Autodetecta o provider ao colar/alterar a chave
    const updateDetect = () => {
      const p = this.detectProvider(keyInput.value);
      labelEl.textContent = PROVIDER_LABELS[p] || p;
      baseUrlInput.classList.toggle('hidden', p !== 'opencode');
      row.__detectedProvider = p;
    };
    keyInput.addEventListener('input', updateDetect);
    keyInput.addEventListener('paste', () => setTimeout(updateDetect, 0));
    updateDetect();

    // S21: valida a chave com um prompt mínimo antes de salvar
    row.querySelector('[data-act="test"]').addEventListener('click', async () => {
      const plainKey = keyInput.value.trim();
      const resultEl = row.querySelector('[data-field="testResult"]');
      if (!plainKey && !row.__encrypted) {
        resultEl.textContent = 'Cole a chave para testar.';
        resultEl.className = 'settings-test-result';
        return;
      }
      // chave não redigitada → usa o provider original salvo
      const provider = plainKey ? row.__detectedProvider : (row.__provider || 'deepseek');
      const baseUrl = baseUrlInput.value.trim();
      let key = row.__encrypted || null;
      if (plainKey) key = await this.encryptKey(plainKey);
      const btn = row.querySelector('[data-act="test"]');
      const prevText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Testando…';
      try {
        const res = await agentManager.testConnection({ provider, key, baseUrl, model: '' }, this.user?.uid);
        resultEl.textContent = res.ok ? 'Chave válida ✓' : `Falha: ${res.error}`;
        resultEl.className = 'settings-test-result ' + (res.ok ? 'ok' : 'fail');
      } finally {
        btn.disabled = false;
        btn.textContent = prevText;
      }
    });
    return row;
  }

  // Cifra uma chave LLM usando a chave derivada do usuário (compatível com o
  // Admin SDK). Sem usuário (modo dev), usa a master key local.
  async encryptKey(plainKey) {
    if (this.user?.uid) return security.encryptForUser(this.user.uid, plainKey);
    return security.encrypt(plainKey);
  }

  async saveSettings() {
    const rows = [...document.querySelectorAll('#settings-list .settings-row')];
    const keys = [];
    for (const row of rows) {
      const read = (f) => row.querySelector(`[data-field="${f}"]`).value;
      const plainKey = read('key').trim();
      const provider = plainKey ? (row.__detectedProvider || 'deepseek') : (row.__provider || read('provider') || 'deepseek');
      const baseUrl = read('baseUrl').trim();
      const model = read('model').trim();
      const priority = Number(read('priority')) || 99;
      const active = row.querySelector('[data-field="active"]').checked;
      let encrypted = row.__encrypted || null;
      if (plainKey) {
        encrypted = await this.encryptKey(plainKey);
        row.__encrypted = encrypted;
      }
      if (encrypted) {
        keys.push({ provider, key: encrypted, baseUrl, model, priority, active });
      }
    }
    if (!this.devMode && this.user) {
      await dbService.updateLlmKeys(this.user.uid, keys);
      this.toast('APIs de LLM salvas');
    } else {
      this.toast('Modo dev: chaves mantidas apenas nesta sessão (sem persistência)');
    }
    // S39 — preferências do editor (tema/fonte) persistidas + aplicadas.
    const prefs = await saveEditorPrefs(await this.readEditorPrefs());
    this.onEditorPrefsChange?.(prefs);
  }

  async bindSettings() {
    document.getElementById('settings-back').addEventListener('click', () => this.goBack());
    document.getElementById('settings-save').addEventListener('click', () => {
      this.saveSettings().then(() => this.goBack()).catch((err) => this.toast(`Erro: ${err.message}`, true));
    });
    document.getElementById('settings-logout').addEventListener('click', async () => {
      await authService.logout();
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
