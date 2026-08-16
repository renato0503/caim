import { gitService } from '../git/git-service.js';
import { security } from '../security/security-service.js';

function esc(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}

const STATUS_LABEL = {
  novo: 'novo',
  excluído: 'excluído',
  adicionado: 'adicionado',
  modificado: 'modificado',
  staged: 'staged',
};

export class GitPanel {
  constructor({ container, notify, onDeployed, onDeploy, onResetWorkspace, onExportZip }) {
    this.container = container;
    this.notify = notify;
    this.onDeployed = onDeployed;
    this.onDeploy = onDeploy;
    this.onResetWorkspace = onResetWorkspace;
    this.onExportZip = onExportZip;
    this.busy = false;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="gp">
        <div class="gp-section">
          <div class="gp-row gp-between">
            <span class="gp-label">Repositório</span>
            <button class="gp-btn" data-act="init">Init</button>
          </div>
          <div class="gp-state" data-ref="repoState">…</div>
        </div>

        <div class="gp-section">
          <div class="gp-label">GitHub PAT <span class="gp-hint">(cifrado — AES-GCM)</span></div>
          <input class="gp-input" data-ref="patInput" type="password" placeholder="Personal Access Token" autocomplete="off" />
          <div class="gp-row">
            <button class="gp-btn gp-primary" data-act="savePat">Salvar</button>
            <button class="gp-btn" data-act="clearPat">Limpar</button>
            <span class="gp-note" data-ref="patState">…</span>
          </div>
        </div>

        <div class="gp-section">
          <div class="gp-row gp-between">
            <span class="gp-label">Arquivos alterados</span>
            <button class="gp-btn" data-act="stage">Stage all</button>
          </div>
          <ul class="gp-files" data-ref="files"></ul>
        </div>

        <div class="gp-section">
          <div class="gp-label">MVP Factory</div>
          <button class="gp-btn gp-accept" data-act="deploy">Publicar MVP (via plataforma)</button>
          <ol class="gp-steps" data-ref="steps"></ol>
        </div>

        <div class="gp-section gp-row">
          <button class="gp-btn gp-primary" data-act="commit">Commit</button>
          <button class="gp-btn" data-act="log">Log</button>
          <button class="gp-btn" data-act="export">Exportar ZIP</button>
          <button class="gp-btn gp-danger" data-act="reset">Novo projeto</button>
        </div>
        <div class="gp-pending hidden" data-ref="pendingPush"></div>
        <div class="gp-log" data-ref="log"></div>
      </div>
    `;

    this.el = {
      repoState: this.container.querySelector('[data-ref="repoState"]'),
      patInput: this.container.querySelector('[data-ref="patInput"]'),
      patState: this.container.querySelector('[data-ref="patState"]'),
      steps: this.container.querySelector('[data-ref="steps"]'),
      files: this.container.querySelector('[data-ref="files"]'),
      log: this.container.querySelector('[data-ref="log"]'),
      pendingPush: this.container.querySelector('[data-ref="pendingPush"]'),
    };

    this.container.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this.onAction(btn.dataset.act));
    });

    this.refresh();
  }

  async onAction(action) {
    if (this.busy) return;
    try {
      if (action === 'init') {
        await gitService.ensureInit();
        this.toast('Repositório inicializado');
      } else if (action === 'savePat') {
        const value = this.el.patInput.value.trim();
        if (!value) return;
        await security.storeSecret('github_pat', value);
        this.el.patInput.value = '';
        this.toast('PAT salvo (cifrado)');
      } else if (action === 'clearPat') {
        await security.deleteSecret('github_pat');
        this.toast('PAT removido');
      } else if (action === 'stage') {
        await gitService.addAll();
        this.toast('Arquivos em stage');
      } else if (action === 'commit') {
        await this.commit();
      } else if (action === 'log') {
        await this.showLog();
      } else if (action === 'deploy') {
        await this.deploy();
      } else if (action === 'export') {
        const count = await this.onExportZip?.();
        if (count) this.toast(`ZIP gerado com ${count} arquivos`);
      } else if (action === 'reset') {
        await this.onResetWorkspace?.();
      }
      this.refresh();
    } catch (err) {
      this.toast(`Erro: ${err.message || err}`, true);
      this.refresh();
    }
  }

  async commit() {
    const message = await this.prompt('Mensagem do commit', 'Initial MVP');
    if (!message) return;
    await gitService.commit(message);
    this.toast(`Commit: ${message}`);
  }

  async deploy() {
    this.el.steps.innerHTML = '';
    this.setBusy(true);
    this.addStep('Publicando via githubDeployProxy (conta do Owner)…');
    try {
      const url = await this.onDeploy();
      this.addStep(`Publicado: ${url}`);
      this.onDeployed?.(url);
    } catch (err) {
      this.addStep(`Falha: ${err.message || err}`);
      this.toast(`Deploy falhou: ${err.message || err}`, true);
    } finally {
      this.setBusy(false);
      this.refresh();
    }
  }

  addStep(label) {
    const li = document.createElement('li');
    li.textContent = label;
    li.className = 'gp-step';
    this.el.steps.appendChild(li);
    li.scrollIntoView({ block: 'nearest' });
  }

  setBusy(busy) {
    this.busy = busy;
    this.container.querySelectorAll('[data-act]').forEach((b) => b.classList.toggle('disabled', busy));
  }

  prompt(title, initial = '') {
    return new Promise((resolve) => {
      this.notify.prompt(initial, title, (value) => resolve((value || '').trim() || null), () => resolve(null));
    });
  }

  toast(text, error = false) {
    this.notify.toast(text, { position: 'center' });
  }

  async refresh() {
    try {
      const initialized = await gitService.isInitialized();
      this.el.repoState.textContent = initialized ? 'Inicializado (main)' : 'Não inicializado';
      if (initialized) {
        const status = await gitService.status();
        this.renderFiles(status);
      } else {
        this.el.files.innerHTML = '<li class="gp-note">Rode Init para começar</li>';
      }
    } catch (err) {
      this.el.repoState.textContent = `Erro: ${err.message || err}`;
    }
    const hasPat = await security.hasSecret('github_pat');
    this.el.patState.textContent = hasPat ? 'PAT salvo (cifrado)' : 'Sem PAT';
    this.el.patState.classList.toggle('ok', hasPat);
  }

  // S24: exibe badge "push pendente" quando há commits locais sem remote
  setPendingPush(hasPending) {
    if (!this.el.pendingPush) return;
    this.el.pendingPush.classList.toggle('hidden', !hasPending);
    if (hasPending) {
      this.el.pendingPush.textContent = '⚠ Push pendente — seus commits locais ainda não foram enviados.';
    }
  }

  renderFiles(status) {
    this.el.files.innerHTML = '';
    if (!status.length) {
      this.el.files.innerHTML = '<li class="gp-note">Nenhuma alteração</li>';
      return;
    }
    for (const { filepath, status: st } of status) {
      const li = document.createElement('li');
      li.className = 'gp-file';
      li.innerHTML = `<span class="gp-file-status gp-${esc(st)}">${esc(STATUS_LABEL[st] || st)}</span><span class="gp-file-path">${esc(filepath)}</span>`;
      this.el.files.appendChild(li);
    }
  }

  async showLog() {
    const entries = await gitService.log(8);
    this.el.log.innerHTML = entries.length
      ? entries.map((c) => `<div class="gp-log-entry">${esc(c.commit.message.split('\n')[0])}</div>`).join('')
      : '<div class="gp-note">Sem commits ainda</div>';
  }
}
