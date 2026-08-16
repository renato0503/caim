import { authService } from '../auth/auth-service.js';
import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';

export const PROVIDER_LABELS = { deepseek: 'DeepSeek', qwen: 'Qwen', openai: 'OpenAI' };

export class AuthViews {
  constructor({ notify, onEnterIde }) {
    this.notify = notify;
    this.onEnterIde = onEnterIde;
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
      document.getElementById('auth-submit').textContent = signup ? 'Criar conta' : 'Entrar';
      this.setError('');
    };
    document.getElementById('auth-tab-login').addEventListener('click', () => toggle(false));
    document.getElementById('auth-tab-signup').addEventListener('click', () => toggle(true));

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
    const code = err?.code || '';
    const map = {
      'auth/email-already-in-use': 'Este email já está cadastrado.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/wrong-password': 'Email ou senha incorretos.',
      'auth/user-not-found': 'Email não cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres).',
      'auth/invalid-email': 'Email inválido.',
    };
    return map[code] || err?.message || 'Falha na autenticação.';
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
    document.getElementById('dashboard-settings-btn').addEventListener('click', async () => {
      await this.loadSettings();
      this.show('settings');
    });
    document.getElementById('dashboard-logout').addEventListener('click', async () => {
      await authService.logout();
    });
  }

  async renderDashboard() {
    const nameEl = document.getElementById('dashboard-user-name');
    const projectsEl = document.getElementById('dashboard-projects');
    if (this.devMode || !this.user) {
      nameEl.textContent = this.devMode ? 'Modo dev (Firebase não configurado)' : '';
      projectsEl.innerHTML = '<div class="auth-note">Sem histórico de MVPs neste modo.</div>';
      return;
    }
    nameEl.textContent = this.user.displayName || this.user.email || 'Bem-vindo(a)';
    try {
      const projects = await dbService.listProjects(this.user.uid);
      projectsEl.innerHTML = '';
      if (!projects.length) {
        projectsEl.innerHTML = '<div class="auth-note">Nenhum MVP publicado ainda. Publique na IDE!</div>';
        return;
      }
      for (const p of projects) {
        const item = document.createElement('a');
        item.className = 'project-card';
        item.href = p.url;
        item.target = '_blank';
        item.rel = 'noopener';
        item.innerHTML = `<span class="project-name">${escapeHtml(p.name)}</span><span class="project-url">${escapeHtml(p.url)}</span>`;
        projectsEl.appendChild(item);
      }
    } catch (err) {
      projectsEl.innerHTML = `<div class="auth-note">Erro ao listar projetos: ${escapeHtml(err.message)}</div>`;
    }
  }

  // ---------------- Settings (3 APIs LLM) ----------------

  async loadSettings() {
    let keys = [];
    if (!this.devMode && this.user) {
      const profile = await dbService.getUserProfile(this.user.uid);
      keys = profile?.llm_keys || [];
    }
    this.renderSettings(keys);
  }

  renderSettings(keys) {
    const list = document.getElementById('settings-list');
    list.innerHTML = '';
    for (let i = 0; i < 3; i += 1) {
      const data = keys[i] || { provider: 'deepseek', key: null, baseUrl: '', model: '', priority: i + 1, active: i === 0 };
      list.appendChild(this.settingsRow(i, data));
    }
  }

  settingsRow(index, data) {
    const row = document.createElement('div');
    row.className = 'settings-row';
    // S14: preserva a chave cifrada já salva no Firestore. Sem isso, reabrir
    // Configurações e salvar sem redigitar a chave apagaria todas as chaves.
    row.__encrypted = data.key || null;
    row.innerHTML = `
      <div class="settings-row-head">
        <span class="settings-row-title">API ${index + 1}</span>
        <label class="settings-toggle">
          <input type="checkbox" data-field="active" ${data.active ? 'checked' : ''}>
          <span>Ativa</span>
        </label>
      </div>
      <div class="settings-fields">
        <select data-field="provider">
          <option value="deepseek" ${data.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
          <option value="qwen" ${data.provider === 'qwen' ? 'selected' : ''}>Qwen</option>
          <option value="openai" ${data.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
        </select>
        <input data-field="baseUrl" placeholder="Base URL (opcional, ex: https://proxy/opencode/v1)" value="${escapeHtml(data.baseUrl || '')}">
        <input data-field="model" placeholder="Modelo (opcional, ex: deepseek-chat)" value="${escapeHtml(data.model || '')}">
        <input data-field="key" type="password" placeholder="API key (será cifrada)" value="">
        <div class="settings-row-foot">
          <label>Prioridade</label>
          <input data-field="priority" type="number" min="1" max="3" value="${data.priority || index + 1}">
        </div>
      </div>
    `;
    return row;
  }

  async saveSettings() {
    const rows = [...document.querySelectorAll('#settings-list .settings-row')];
    const keys = [];
    for (const row of rows) {
      const read = (f) => row.querySelector(`[data-field="${f}"]`).value;
      const provider = read('provider');
      const baseUrl = read('baseUrl').trim();
      const model = read('model').trim();
      const plainKey = read('key').trim();
      const priority = Number(read('priority')) || 99;
      const active = row.querySelector('[data-field="active"]').checked;
      let encrypted = row.__encrypted || null;
      if (plainKey) {
        encrypted = await security.encrypt(plainKey);
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
