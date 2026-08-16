import { authService } from '../auth/auth-service.js';
import { dbService } from '../db/db-service.js';
import { security } from '../security/security-service.js';
import { agentManager } from '../agents/agent-manager.js';

export const PROVIDER_LABELS = { deepseek: 'DeepSeek', qwen: 'Qwen', openai: 'OpenAI', nvidia: 'NVIDIA', groq: 'Groq', opencode: 'OpenCode' };

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

  async renderDashboard() {
    const nameEl = document.getElementById('dashboard-user-name');
    const projectsEl = document.getElementById('dashboard-projects');
    const verifyEl = document.getElementById('dashboard-verify');
    if (this.devMode || !this.user) {
      nameEl.textContent = this.devMode ? 'Modo dev (Firebase não configurado)' : '';
      projectsEl.innerHTML = '<div class="auth-note">Sem histórico de MVPs neste modo.</div>';
      if (verifyEl) verifyEl.classList.add('hidden');
      return;
    }
    nameEl.textContent = this.user.displayName || this.user.email || 'Bem-vindo(a)';
    // S20: badge de email não verificado
    if (verifyEl) verifyEl.classList.toggle('hidden', !!authService.isEmailVerified());
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
