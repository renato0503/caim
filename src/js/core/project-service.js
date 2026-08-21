// S36 — Gestor de projetos locais.
//
// Projetos locais são SNAPSHOTS nomeados do workspace atual (VFS). O usuário
// pode continuar um projeto (restaura os arquivos no workspace), renomear ou
// excluir. Exclusão é SEMPRE local (IndexedDB) — nunca apaga o repo publicado
// no GitHub (projetos deployados são outra lista, em Firestore).

import { vfs } from './vfs-service.js';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function slugify(name) {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'projeto';
}

// S41 — normaliza um path vindo de um .zip e rejeita path traversal/absoluto.
function sanitizeZipPath(raw) {
  let p = String(raw || '').replace(/\\/g, '/').trim();
  if (!p) return null;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split('/');
  if (parts.some((seg) => seg === '..' || seg === '.')) return null;
  return parts.filter(Boolean).join('/') || null;
}

// S40 — catálogo de templates de projeto (snapshot de partida).
export const PROJECT_TEMPLATES = [
  {
    id: 'html-css-js',
    name: 'HTML/CSS/JS puro',
    description: 'Site estático simples, sem dependências',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Meu Site</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Meu Site</h1>\n  <p>Comece a editar aqui.</p>\n  <script src="script.js"></script>\n</body>\n</html>\n' },
      { path: 'style.css', content: 'body {\n  font-family: system-ui, sans-serif;\n  margin: 0;\n  padding: 24px;\n  background: #f8fafc;\n  color: #0f172a;\n}\n' },
      { path: 'script.js', content: "console.log('CAIM template HTML/CSS/JS');\n" },
    ],
  },
  {
    id: 'react-cdn',
    name: 'React via CDN',
    description: 'App React com Babel standalone (sem build)',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>React App</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>\n  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>\n  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>\n  <script type="text/babel" src="App.js"></script>\n</body>\n</html>\n' },
      { path: 'App.js', content: 'const App = () => (\n  <div style={{ fontFamily: "system-ui", padding: 24 }}>\n    <h1>React no CAIM</h1>\n    <p>Componente via CDN + Babel.</p>\n  </div>\n);\n\nReactDOM.createRoot(document.getElementById("root")).render(<App />);\n' },
    ],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Script Python simples',
    files: [
      { path: 'main.py', content: 'def main():\n    print("Olá, CAIM!")\n\n\nif __name__ == "__main__":\n    main()\n' },
      { path: 'README.md', content: '# Projeto Python\n\nExecutável de exemplo gerado pelo CAIM.\n' },
    ],
  },
  {
    id: 'markdown',
    name: 'Markdown doc',
    description: 'Documentação em Markdown',
    files: [
      { path: 'README.md', content: '# Projeto\n\nDocumentação gerada pelo CAIM.\n\n## Como usar\n\n1. Edite este arquivo.\n2. Adicione seções.\n3. Publique.\n' },
    ],
  },
  {
    id: 'curriculo-16bit',
    name: 'Currículo 16-bit',
    description: 'Currículo retro em estilo 16-bit',
    files: [
      { path: 'index.html', content: '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Currículo</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <main class="card">\n    <h1>SEU NOME</h1>\n    <p class="tagline">Desenvolvedor(a) 16-bit</p>\n    <section>\n      <h2>Experiência</h2>\n      <ul>\n        <li>Empresa X — cargo (2020–2024)</li>\n      </ul>\n    </section>\n    <section>\n      <h2>Educação</h2>\n      <ul>\n        <li>Curso / Universidade</li>\n      </ul>\n    </section>\n  </main>\n</body>\n</html>\n' },
      { path: 'style.css', content: 'body {\n  background: #0f172a;\n  color: #2dd4bf;\n  font-family: "Courier New", monospace;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n.card {\n  border: 3px solid #2dd4bf;\n  padding: 24px;\n  max-width: 420px;\n  width: 100%;\n  box-sizing: border-box;\n  box-shadow: 4px 4px 0 #2dd4bf;\n}\nh1 { font-size: 22px; margin-bottom: 4px; }\n.tagline { color: #94a3b8; font-size: 12px; }\nh2 { border-bottom: 1px dashed #2dd4bf; font-size: 14px; }\nli { color: #e2e8f0; font-size: 13px; margin-bottom: 6px; }\n' },
    ],
  },
];

async function snapshotFiles() {
  const all = await vfs.listAllFiles();
  const files = [];
  for (const p of all) {
    if (p.startsWith('.git/')) continue; // snapshots não carregam o .git local
    const { content, mimeType } = await vfs.readFile(p);
    files.push({ path: p, content, mimeType });
  }
  return files;
}

export const projectService = {
  slugify,
  PROJECT_TEMPLATES,

  async getActiveProjectId() {
    const rec = await vfs.db.metadata.get('activeProjectId');
    return rec?.value || null;
  },

  async setActiveProject(id) {
    await vfs.db.metadata.put({ key: 'activeProjectId', value: id || '' });
  },

  // Salva o snapshot do projeto ativo (se houver) antes de trocar/limpar.
  async saveActiveProject() {
    const id = await this.getActiveProjectId();
    if (!id) return null;
    const project = await this.getProject(id);
    if (!project) return null;
    return this.saveProjectSnapshot(id);
  },

  // Lista os projetos locais (sem os arquivos — só metadados).
  // S40: fixados (pinned) primeiro, depois por recência.
  async listLocalProjects() {
    try {
      const rows = await vfs.db.projects.toArray();
      return rows.sort((a, b) => {
        if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
        return (b.lastModified || 0) - (a.lastModified || 0);
      });
    } catch (err) {
      return [];
    }
  },

  async getProject(id) {
    try {
      return await vfs.db.projects.get(id);
    } catch (err) {
      return null;
    }
  },

  // Cria um novo projeto vazio (limpa o workspace antes). Retorna o projeto.
  async newProject(name) {
    const clean = String(name || '').trim();
    const id = slugify(clean);
    if (!SLUG_RE.test(id)) throw new Error('Nome de projeto inválido (use letras, números e hífens)');
    await this.saveActiveProject();
    await this.clearWorkspace();
    const now = Date.now();
    const project = { id, name: clean, createdAt: now, lastModified: now, deployed: false, url: '', fileCount: 0, pinned: false, tags: [] };
    await vfs.db.projects.put(project);
    await this.setActiveProject(id);
    return project;
  },

  // S40 — cria um projeto a partir de um template do catálogo (escreve os
  // arquivos no workspace + snapshot). Retorna o projeto com fileCount.
  async newProjectFromTemplate(name, templateId) {
    const clean = String(name || '').trim();
    const id = slugify(clean);
    if (!SLUG_RE.test(id)) throw new Error('Nome de projeto inválido (use letras, números e hífens)');
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) throw new Error('Template não encontrado');
    await this.saveActiveProject();
    await this.clearWorkspace();
    const now = Date.now();
    const project = { id, name: clean, createdAt: now, lastModified: now, deployed: false, url: '', fileCount: 0, pinned: false, tags: [] };
    await vfs.db.projects.put(project);
    await this.setActiveProject(id);
    for (const f of tpl.files) {
      await vfs.writeFile(f.path, f.content, { silent: true });
    }
    const count = await this.saveProjectSnapshot(id);
    return { ...project, fileCount: count };
  },

  // S40 — duplica o snapshot de um projeto ("Cópia de X"), id único. Não toca
  // no original nem no workspace atual.
  async duplicateProject(id) {
    const src = await this.getProject(id);
    if (!src) throw new Error(`Projeto não encontrado: ${id}`);
    let newId = slugify(`copia-de-${src.name}`);
    let suffix = 2;
    while (await vfs.db.projects.get(newId)) newId = `${slugify(`copia-de-${src.name}`)}-${suffix++}`;
    const now = Date.now();
    const dup = {
      id: newId,
      name: `Cópia de ${src.name}`,
      createdAt: now,
      lastModified: now,
      deployed: false,
      url: '',
      fileCount: src.fileCount,
      pinned: false,
      tags: [...(src.tags || [])],
    };
    await vfs.db.projects.put(dup);
    const rows = await vfs.db.project_files.where('projectId').equals(id).toArray();
    for (const r of rows) {
      await vfs.db.project_files.put({ projectId: newId, path: r.path, content: r.content, mimeType: r.mimeType });
    }
    return dup;
  },

  // S40 — fixar/desafixar (pinned vai para o topo da lista).
  async togglePin(id) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    const updated = { ...project, pinned: !project.pinned, lastModified: Date.now() };
    await vfs.db.projects.put(updated);
    return updated;
  },

  // S40 — define as tags do projeto (máx. 8, minúsculas, sem duplicadas).
  async setTags(id, tags) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    const clean = (Array.isArray(tags) ? tags : [])
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    const updated = { ...project, tags: [...new Set(clean)].slice(0, 8), lastModified: Date.now() };
    await vfs.db.projects.put(updated);
    return updated;
  },

  // Cria um projeto a partir do workspace ATUAL sem limpar nada (usado no deploy
  // quando não há projeto ativo). Retorna o projeto criado.
  async createFromWorkspace(name) {
    const clean = String(name || '').trim();
    const id = slugify(clean);
    const now = Date.now();
    const project = { id, name: clean || id, createdAt: now, lastModified: now, deployed: false, url: '', fileCount: 0, pinned: false, tags: [] };
    await vfs.db.projects.put(project);
    await this.setActiveProject(id);
    const count = await this.saveProjectSnapshot(id);
    const updated = { ...project, fileCount: count };
    await vfs.db.projects.put(updated);
    return updated;
  },

  // Salva o estado atual do workspace como snapshot do projeto (continuação).
  async saveProjectSnapshot(id) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    const files = await snapshotFiles();
    await vfs.db.transaction('rw', vfs.db.projects, vfs.db.project_files, async () => {
      await vfs.db.project_files.where('projectId').equals(id).delete();
      for (const f of files) {
        await vfs.db.project_files.put({ projectId: id, path: f.path, content: f.content, mimeType: f.mimeType });
      }
      await vfs.db.projects.put({ ...project, lastModified: Date.now(), fileCount: files.length });
    });
    return files.length;
  },

  // Restaura o snapshot do projeto no workspace (substitui o conteúdo atual).
  async openProject(id) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    const activeId = await this.getActiveProjectId();
    if (activeId && activeId !== id) await this.saveActiveProject();
    const rows = await vfs.db.project_files.where('projectId').equals(id).toArray();
    await this.clearWorkspace({ keepGit: false });
    for (const f of rows) {
      await vfs.writeFile(f.path, f.content, { silent: true });
    }
    await vfs.db.projects.put({ ...project, lastModified: Date.now(), fileCount: rows.length });
    await this.setActiveProject(id);
    return { project, files: rows.map((r) => r.path) };
  },

  // Marca o projeto como publicado (deploy feito) — guarda a URL.
  async markDeployed(id, url) {
    const project = await this.getProject(id);
    if (!project) return null;
    const updated = { ...project, deployed: true, url, lastModified: Date.now() };
    await vfs.db.projects.put(updated);
    return updated;
  },

  async renameProject(id, newName) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    const name = String(newName || '').trim();
    if (!name) throw new Error('Nome vazio');
    const updated = { ...project, name, lastModified: Date.now() };
    await vfs.db.projects.put(updated);
    return updated;
  },

  // Exclui SOMENTE o snapshot local. O repo publicado no GitHub NUNCA é tocado.
  async deleteProject(id) {
    await vfs.db.transaction('rw', vfs.db.projects, vfs.db.project_files, async () => {
      await vfs.db.project_files.where('projectId').equals(id).delete();
      await vfs.db.projects.delete(id);
    });
    return id;
  },

  // ============================================================
  // S41 — Export/Import .zip por projeto (JSZip) + Lixeira
  // ============================================================

  // Exporta o snapshot de um projeto como .zip (sem .git/.env).
  async exportProjectZip(projectId) {
    const JSZip = (await import('jszip')).default;
    const project = await this.getProject(projectId);
    if (!project) throw new Error(`Projeto não encontrado: ${projectId}`);
    const rows = await vfs.db.project_files.where('projectId').equals(projectId).toArray();
    const zip = new JSZip();
    const files = [];
    for (const r of rows) {
      if (r.path.startsWith('.git/')) continue;
      zip.file(r.path, r.content);
      files.push(r.path);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    return { blob, project, files };
  },

  // Importa um .zip como novo projeto local (valida paths/limites; NUNCA toca
  // no workspace atual). Retorna o projeto criado.
  async importProjectZip(file, name) {
    const JSZip = (await import('jszip')).default;
    const MAX_TOTAL = 20 * 1024 * 1024; // 20MB no total
    const MAX_FILE = 1024 * 1024; // 1MB por arquivo (mesmo limite do VFS)
    let zip;
    try {
      const input = typeof file?.arrayBuffer === 'function' ? await file.arrayBuffer() : file;
      zip = await JSZip.loadAsync(input);
    } catch (err) {
      throw new Error('Arquivo .zip inválido');
    }
    const collected = [];
    let total = 0;
    const walk = (relativePath, entry) => {
      if (entry.dir) return;
      const p = sanitizeZipPath(relativePath);
      if (!p || p.startsWith('.git/')) return;
      collected.push({ path: p, entry });
    };
    zip.forEach(walk);
    if (!collected.length) throw new Error('ZIP sem arquivos válidos');
    const files = [];
    for (const { path, entry } of collected) {
      const content = await entry.async('string');
      if (content.length > MAX_FILE) throw new Error(`Arquivo grande demais: ${path} (max 1MB)`);
      total += content.length;
      if (total > MAX_TOTAL) throw new Error('ZIP grande demais (max 20MB)');
      files.push({ path, content, mimeType: vfs.constructor.resolveMime(path, content) });
    }
    const cleanName = String(name || file?.name || 'projeto')
      .replace(/\.zip$/i, '')
      .trim() || 'projeto';
    let id = slugify(cleanName);
    let suffix = 2;
    while (await vfs.db.projects.get(id)) id = `${slugify(cleanName)}-${suffix++}`;
    const now = Date.now();
    const project = {
      id,
      name: cleanName,
      createdAt: now,
      lastModified: now,
      deployed: false,
      url: '',
      fileCount: files.length,
      pinned: false,
      tags: [],
    };
    await vfs.db.projects.put(project);
    for (const f of files) {
      await vfs.db.project_files.put({ projectId: id, path: f.path, content: f.content, mimeType: f.mimeType });
    }
    return project;
  },

  // Move o projeto para a LIXEIRA (tabela `trashed`) — não apaga. Se for o
  // ativo, desmarca o ativo (sem tocar o workspace).
  async trashProject(id) {
    const project = await this.getProject(id);
    if (!project) throw new Error(`Projeto não encontrado: ${id}`);
    if ((await this.getActiveProjectId()) === id) await this.setActiveProject('');
    const trashedAt = Date.now();
    await vfs.db.transaction('rw', vfs.db.projects, vfs.db.trashed, async () => {
      await vfs.db.trashed.put({ ...project, trashedAt });
      await vfs.db.projects.delete(id);
    });
    return { ...project, trashedAt };
  },

  async listTrashed() {
    try {
      const rows = await vfs.db.trashed.toArray();
      return rows.sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
    } catch (err) {
      return [];
    }
  },

  // Restaura da lixeira (se o id já existir de novo, gera id único).
  async restoreProject(id) {
    const rec = await vfs.db.trashed.get(id);
    if (!rec) throw new Error(`Projeto não encontrado na lixeira: ${id}`);
    const { trashedAt, ...project } = rec;
    let newId = project.id;
    let suffix = 2;
    while (await vfs.db.projects.get(newId)) newId = `${project.id}-${suffix++}`;
    const restored = {
      ...project,
      id: newId,
      name: newId !== project.id ? `${project.name} (restaurado)` : project.name,
      lastModified: Date.now(),
    };
    await vfs.db.transaction('rw', vfs.db.projects, vfs.db.project_files, vfs.db.trashed, async () => {
      await vfs.db.projects.put(restored);
      const rows = await vfs.db.project_files.where('projectId').equals(project.id).toArray();
      for (const r of rows) {
        await vfs.db.project_files.put({ ...r, projectId: newId });
      }
      await vfs.db.trashed.delete(id);
    });
    return restored;
  },

  // Apaga DEFINITIVAMENTE da lixeira (só local — nunca GitHub).
  async purgeProject(id) {
    await vfs.db.transaction('rw', vfs.db.project_files, vfs.db.trashed, async () => {
      await vfs.db.project_files.where('projectId').equals(id).delete();
      await vfs.db.trashed.delete(id);
    });
    return id;
  },

  async emptyTrash() {
    const ids = (await vfs.db.trashed.toArray()).map((r) => r.id);
    if (!ids.length) return 0;
    await vfs.db.transaction('rw', vfs.db.project_files, vfs.db.trashed, async () => {
      await vfs.db.project_files.where('projectId').anyOf(ids).delete();
      await vfs.db.trashed.clear();
    });
    return ids.length;
  },

  // Limpa o workspace (sem tocar em projetos). keepGit=false apaga também o .git.
  async clearWorkspace({ keepGit = false } = {}) {
    const files = await vfs.listAllFiles();
    for (const p of files) {
      if (keepGit && p.startsWith('.git/')) continue;
      await vfs.deleteFile(p, { silent: true });
    }
    await vfs.db.directories.clear();
  },
};