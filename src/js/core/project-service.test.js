import { describe, it, expect, beforeEach } from 'vitest';
import { VFSService } from './vfs-service.js';
import { projectService, PROJECT_TEMPLATES } from './project-service.js';

// S36/J3: projetos locais — snapshot do workspace, continuar, renomear,
// excluir (só local; NUNCA toca no GitHub). clearWorkspace preserva os projetos.
// S40/S41: templates, duplicar, pin/tags, export/import .zip e lixeira.

async function makeEnv() {
  resetIndexedDB();
  const vfs = new VFSService();
  await vfs.ready;
  await vfs.db.projects.clear();
  await vfs.db.project_files.clear();
  await vfs.db.trashed.clear();
  return vfs;
}

async function seedWorkspace(vfs) {
  await vfs.writeFile('index.html', '<h1>oi</h1>', { silent: true });
  await vfs.writeFile('src/app.js', 'console.log(1)', { silent: true });
}

describe('projectService — projetos locais (snapshots)', () => {
  beforeEach(async () => {
    await makeEnv();
  });

  it('newProject limpa o workspace, cria o registro e marca como ativo', async () => {
    const vfs = await makeEnv();
    await seedWorkspace(vfs);
    const p = await projectService.newProject('Meu MVP');
    expect(p.id).toBe('meu-mvp');
    expect(p.deployed).toBe(false);
    expect(p.fileCount).toBe(0);
    const files = await vfs.listAllFiles();
    expect(files).toHaveLength(0);
    expect(await projectService.getActiveProjectId()).toBe('meu-mvp');
    expect(await vfs.db.projects.count()).toBe(1);
  });

  it('saveProjectSnapshot guarda os arquivos do workspace e conta fileCount', async () => {
    const vfs = await makeEnv();
    await seedWorkspace(vfs);
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    const count = await projectService.saveProjectSnapshot('meu-mvp');
    expect(count).toBe(2);
    const p = await projectService.getProject('meu-mvp');
    expect(p.fileCount).toBe(2);
    const rows = await vfs.db.project_files.where('projectId').equals('meu-mvp').toArray();
    expect(rows.map((r) => r.path).sort()).toEqual(['index.html', 'src/app.js']);
    expect(rows[0].content).toBeTruthy();
  });

  it('openProject restaura o snapshot no workspace e substitui o conteúdo atual', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    // muda o workspace para algo diferente
    await vfs.deleteFile('index.html', { silent: true });
    await vfs.writeFile('README.md', '# novo', { silent: true });

    const { files } = await projectService.openProject('meu-mvp');
    expect(files.sort()).toEqual(['index.html', 'src/app.js']);
    const after = await vfs.listAllFiles();
    expect(after.sort()).toEqual(['index.html', 'src/app.js']);
    const { content } = await vfs.readFile('index.html');
    expect(content).toBe('<h1>oi</h1>');
    expect(await projectService.getActiveProjectId()).toBe('meu-mvp');
  });

  it('trocar de projeto salva o snapshot do projeto ativo anterior', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Projeto A');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('projeto-a');
    await vfs.writeFile('a.txt', 'x', { silent: true });
    await projectService.saveProjectSnapshot('projeto-a');

    const b = await projectService.newProject('Projeto B');
    expect(b.id).toBe('projeto-b');
    // A deve ter sido salvo automaticamente antes de limpar (index.html,
    // src/app.js e a.txt)
    const pa = await projectService.getProject('projeto-a');
    expect(pa.fileCount).toBe(3);
    const rowsA = await vfs.db.project_files.where('projectId').equals('projeto-a').toArray();
    expect(rowsA.map((r) => r.path)).toContain('index.html');
  });

  it('openProject salva o snapshot do ativo anterior antes de trocar', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Projeto A');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('projeto-a');

    await projectService.newProject('Projeto B');
    await vfs.writeFile('b.txt', 'y', { silent: true });
    await projectService.saveProjectSnapshot('projeto-b');

    await projectService.openProject('projeto-a');
    const pb = await projectService.getProject('projeto-b');
    expect(pb.fileCount).toBe(1);
    const after = await vfs.listAllFiles();
    expect(after.sort()).toEqual(['index.html', 'src/app.js']);
  });

  it('renameProject altera o nome mantendo o id', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    const updated = await projectService.renameProject('meu-mvp', 'Outro Nome');
    expect(updated.id).toBe('meu-mvp');
    expect(updated.name).toBe('Outro Nome');
  });

  it('deleteProject remove apenas o snapshot local (projetos somem da lista)', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    expect(await vfs.db.projects.count()).toBe(1);

    await projectService.deleteProject('meu-mvp');
    expect(await vfs.db.projects.count()).toBe(0);
    expect(await vfs.db.project_files.where('projectId').equals('meu-mvp').count()).toBe(0);
    // o workspace continua intacto
    const files = await vfs.listAllFiles();
    expect(files.sort()).toEqual(['index.html', 'src/app.js']);
  });

  it('markDeployed grava URL e flag sem tocar nos arquivos', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    const updated = await projectService.markDeployed('meu-mvp', 'https://renato0503.github.io/meu-mvp');
    expect(updated.deployed).toBe(true);
    expect(updated.url).toBe('https://renato0503.github.io/meu-mvp');
    const p = await projectService.getProject('meu-mvp');
    expect(p.deployed).toBe(true);
  });

  it('createFromWorkspace cria projeto do estado atual sem limpar nada', async () => {
    const vfs = await makeEnv();
    await seedWorkspace(vfs);
    const p = await projectService.createFromWorkspace('mvp-2026-01-01-abcd');
    expect(p.fileCount).toBe(2);
    const files = await vfs.listAllFiles();
    expect(files).toHaveLength(2);
    expect(await projectService.getActiveProjectId()).toBe(p.id);
  });

  it('clearWorkspace apaga arquivos mas preserva a tabela de projetos', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    await projectService.clearWorkspace();
    expect(await vfs.listAllFiles()).toHaveLength(0);
    expect(await vfs.db.projects.count()).toBe(1);
    expect(await vfs.db.project_files.count()).toBe(2);
  });

  it('slugify normaliza acentos e espaços para id válido', () => {
    expect(projectService.slugify('O Meu MVP!')).toBe('o-meu-mvp');
    expect(projectService.slugify('café')).toBe('cafe');
  });
});

describe('projectService — templates, duplicar, pin e tags (S40)', () => {
  beforeEach(async () => {
    await makeEnv();
  });

  it('catálogo expõe os 5 templates com arquivos', () => {
    const ids = PROJECT_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(['html-css-js', 'react-cdn', 'python', 'markdown', 'curriculo-16bit']);
    for (const t of PROJECT_TEMPLATES) {
      expect(t.files.length).toBeGreaterThan(0);
      expect(typeof t.name).toBe('string');
    }
  });

  it('newProjectFromTemplate limpa o workspace, grava os arquivos e faz snapshot', async () => {
    const vfs = await makeEnv();
    await seedWorkspace(vfs);
    const p = await projectService.newProjectFromTemplate('Meu Currículo', 'curriculo-16bit');
    expect(p.id).toBe('meu-curriculo');
    expect(p.fileCount).toBe(2);
    const files = await vfs.listAllFiles();
    expect(files).toContain('index.html');
    expect(files).toContain('style.css');
    expect(files).not.toContain('src/app.js');
    expect(await projectService.getActiveProjectId()).toBe('meu-curriculo');
    const rows = await vfs.db.project_files.where('projectId').equals('meu-curriculo').count();
    expect(rows).toBe(2);
  });

  it('newProjectFromTemplate rejeita template inexistente', async () => {
    const vfs = await makeEnv();
    await expect(projectService.newProjectFromTemplate('X', 'nao-existe')).rejects.toThrow(/Template não encontrado/);
  });

  it('duplicateProject copia snapshot com nome "Cópia de X" sem tocar o original', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    await vfs.writeFile('extra.txt', 'extra', { silent: true });
    await projectService.saveProjectSnapshot('meu-mvp');

    const dup = await projectService.duplicateProject('meu-mvp');
    expect(dup.name).toBe('Cópia de Meu MVP');
    expect(dup.id).toBe('copia-de-meu-mvp');
    expect(dup.fileCount).toBe(3);
    // original intacto
    const orig = await projectService.getProject('meu-mvp');
    expect(orig.fileCount).toBe(3);
    expect(orig.name).toBe('Meu MVP');
    // cópia com os mesmos arquivos
    const rows = await vfs.db.project_files.where('projectId').equals(dup.id).toArray();
    expect(rows.map((r) => r.path).sort()).toEqual(['extra.txt', 'index.html', 'src/app.js']);
    expect(await vfs.db.projects.count()).toBe(2);
  });

  it('duplicateProject gera id único quando "cópia de" já existe', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('App');
    await vfs.db.projects.put({ id: 'copia-de-app', name: 'Cópia de App', createdAt: 1, lastModified: 1, deployed: false, url: '', fileCount: 0, pinned: false, tags: [] });
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('app');
    const dup = await projectService.duplicateProject('app');
    expect(dup.id).toBe('copia-de-app-2');
  });

  it('togglePin fixa/desfixa e pinned vem primeiro na listagem', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('A');
    await projectService.newProject('B');
    await projectService.togglePin('b');
    const list = await projectService.listLocalProjects();
    expect(list[0].id).toBe('b');
    expect(list[0].pinned).toBe(true);
    await projectService.togglePin('b');
    const list2 = await projectService.listLocalProjects();
    expect(list2.find((p) => p.id === 'b').pinned).toBe(false);
  });

  it('setTags normaliza para minúsculas, sem duplicadas, máx. 8', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    const tags = ['Site', 'site', 'PORTFOLIO', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const updated = await projectService.setTags('meu-mvp', tags);
    expect(updated.tags).toEqual(['site', 'portfolio', 'a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('projectService — export/import .zip e lixeira (S41)', () => {
  beforeEach(async () => {
    await makeEnv();
  });

  it('exportProjectZip gera um .zip com os arquivos do snapshot (sem .git)', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');

    const { blob, project, files } = await projectService.exportProjectZip('meu-mvp');
    expect(project.id).toBe('meu-mvp');
    expect(files.sort()).toEqual(['index.html', 'src/app.js']);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/zip');
  });

  it('importProjectZip cria novo projeto local com mimes e conteúdo preservados', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    const { blob } = await projectService.exportProjectZip('meu-mvp');

    const imported = await projectService.importProjectZip(blob, 'importado.zip');
    expect(imported.name).toBe('importado');
    expect(imported.fileCount).toBe(2);
    const rows = await vfs.db.project_files.where('projectId').equals(imported.id).toArray();
    const idx = rows.find((r) => r.path === 'index.html');
    expect(idx.content).toBe('<h1>oi</h1>');
    expect(idx.mimeType).toBe('text/html');
    // não tocou o workspace
    const ws = await vfs.listAllFiles();
    expect(ws.sort()).toEqual(['index.html', 'src/app.js']);
  });

  it('importProjectZip normaliza paths perigosos e nunca sai do VFS', async () => {
    const vfs = await makeEnv();
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('../evil.txt', 'x');
    zip.file('/etc/passwd', 'x');
    zip.file('.git/config', 'x');
    zip.file('ok.txt', 'ok');
    const blob = await zip.generateAsync({ type: 'blob' });
    const imported = await projectService.importProjectZip(blob, 'x');
    const rows = await vfs.db.project_files.where('projectId').equals(imported.id).toArray();
    const paths = rows.map((r) => r.path);
    // nenhum path sai do VFS, é absoluto ou pertence ao .git
    for (const p of paths) {
      expect(p).not.toMatch(/\.\./);
      expect(p).not.toMatch(/^[/\\]/);
      expect(p).not.toMatch(/^[A-Za-z]:/);
      expect(p).not.toMatch(/^\.git(\/|$)/);
    }
    expect(paths).toContain('ok.txt');
  });

  it('importProjectZip rejeita arquivo > 1MB', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('big.txt', 'x'.repeat(1024 * 1024 + 10));
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(projectService.importProjectZip(blob, 'x')).rejects.toThrow(/grande demais/);
  });

  it('importProjectZip rejeita zip inválido', async () => {
    const vfs = await makeEnv();
    await expect(projectService.importProjectZip(new Blob(['not a zip']), 'x')).rejects.toThrow(/inválido/);
  });

  it('trashProject move para a lixeira (não apaga) e desmarca o ativo', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');

    const trashed = await projectService.trashProject('meu-mvp');
    expect(trashed.trashedAt).toBeGreaterThan(0);
    expect(await vfs.db.projects.count()).toBe(0);
    expect(await vfs.db.trashed.count()).toBe(1);
    expect(await projectService.getActiveProjectId()).toBeNull();
    // arquivos do snapshot continuam na tabela project_files
    expect(await vfs.db.project_files.count()).toBe(2);
    expect(await vfs.listAllFiles()).toHaveLength(2); // workspace intacto
  });

  it('listTrashed ordena por trashedAt (mais recente primeiro)', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('A');
    await vfs.db.trashed.put({ id: 'a', name: 'A', createdAt: 1, lastModified: 1, deployed: false, url: '', fileCount: 0, pinned: false, tags: [], trashedAt: 100 });
    await vfs.db.trashed.put({ id: 'b', name: 'B', createdAt: 1, lastModified: 1, deployed: false, url: '', fileCount: 0, pinned: false, tags: [], trashedAt: 200 });
    const list = await projectService.listTrashed();
    expect(list[0].id).toBe('b');
  });

  it('restoreProject devolve o projeto para a lista com arquivos intactos', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    await projectService.trashProject('meu-mvp');

    const restored = await projectService.restoreProject('meu-mvp');
    expect(restored.id).toBe('meu-mvp');
    expect(restored.name).toBe('Meu MVP');
    expect(await vfs.db.projects.count()).toBe(1);
    expect(await vfs.db.trashed.count()).toBe(0);
    const rows = await vfs.db.project_files.where('projectId').equals('meu-mvp').toArray();
    expect(rows.map((r) => r.path).sort()).toEqual(['index.html', 'src/app.js']);
  });

  it('purgeProject apaga em definitivo (arquivos do snapshot + registro)', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('Meu MVP');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('meu-mvp');
    await projectService.trashProject('meu-mvp');

    await projectService.purgeProject('meu-mvp');
    expect(await vfs.db.trashed.count()).toBe(0);
    expect(await vfs.db.project_files.where('projectId').equals('meu-mvp').count()).toBe(0);
    expect(await vfs.listAllFiles()).toHaveLength(2); // workspace nunca é tocado
  });

  it('emptyTrash esvazia a lixeira inteira', async () => {
    const vfs = await makeEnv();
    await projectService.newProject('A');
    await seedWorkspace(vfs);
    await projectService.saveProjectSnapshot('a');
    await projectService.newProject('B');
    await projectService.saveProjectSnapshot('b');
    await projectService.trashProject('a');
    await projectService.trashProject('b');

    const n = await projectService.emptyTrash();
    expect(n).toBe(2);
    expect(await vfs.db.trashed.count()).toBe(0);
    expect(await vfs.db.project_files.count()).toBe(0);
  });
});