import { describe, it, expect, beforeEach } from 'vitest';
import { VFSService } from './vfs-service.js';

// J1/S13: CRUD, path traversal, persistência, eventos e listagem do VFS.

describe('VFSService — path helpers', () => {
  it('normaliza barras invertidas e segmentos duplicados', () => {
    expect(VFSService.normalize('a\\b\\c')).toBe('a/b/c');
    expect(VFSService.normalize('a//b///c')).toBe('a/b/c');
    expect(VFSService.normalize('./a/./b')).toBe('a/b');
  });

  it('resolve ".." interno sem escapar do VFS', () => {
    expect(VFSService.normalize('a/../b')).toBe('b');
  });

  it('bloqueia ".." que escapa da raiz com erro amigável', () => {
    expect(() => VFSService.normalize('../secret')).toThrow(/inválido|não é possível sair/);
    expect(() => VFSService.normalize('../../etc/passwd')).toThrow(/inválido|não é possível sair/);
    expect(() => VFSService.normalize('/absoluto')).toThrow(/Invalid path/);
  });

  it('extrai basename, parentDir e extname', () => {
    expect(VFSService.basename('src/app.js')).toBe('app.js');
    expect(VFSService.parentDir('src/app.js')).toBe('src');
    expect(VFSService.parentDir('app.js')).toBe('');
    expect(VFSService.extname('src/app.js')).toBe('.js');
    expect(VFSService.extname('noext')).toBe('');
  });
});

describe('VFSService — CRUD e persistência', () => {
  beforeEach(() => {
    resetIndexedDB();
  });

  async function makeVfs() {
    const vfs = new VFSService();
    await vfs.ready;
    return vfs;
  }

  it('cria, lê e atualiza arquivos', async () => {
    const vfs = await makeVfs();
    const { created } = await vfs.writeFile('a.txt', 'olá');
    expect(created).toBe(true);
    expect((await vfs.readFile('a.txt')).content).toBe('olá');
    expect(await vfs.exists('a.txt')).toBe(true);

    const upd = await vfs.writeFile('a.txt', 'olá mundo');
    expect(upd.created).toBe(false);
    expect((await vfs.readFile('a.txt')).content).toBe('olá mundo');
  });

  it('createFile falha se o arquivo já existe', async () => {
    const vfs = await makeVfs();
    await vfs.createFile('dup.txt', 'x');
    await expect(vfs.createFile('dup.txt', 'y')).rejects.toThrow(/already exists/);
  });

  it('renomeia preservando conteúdo e mime', async () => {
    const vfs = await makeVfs();
    await vfs.writeFile('old.md', '# título');
    await vfs.renameFile('old.md', 'novo.md');
    expect(await vfs.exists('old.md')).toBe(false);
    const f = await vfs.readFile('novo.md');
    expect(f.content).toBe('# título');
    expect(f.mimeType).toBe('text/markdown');
  });

  it('deleteFile remove e emite evento', async () => {
    const vfs = await makeVfs();
    const events = [];
    vfs.events.on('vfs:changed', (e) => events.push(e));
    await vfs.writeFile('del.txt', 'x');
    await vfs.deleteFile('del.txt');
    expect(await vfs.exists('del.txt')).toBe(false);
    expect(events.some((e) => e.type === 'delete' && e.path === 'del.txt')).toBe(true);
  });

  it('persiste após "reload" (nova instância, mesma base IndexedDB)', async () => {
    let vfs = await makeVfs();
    await vfs.writeFile('src/keep.js', 'export const x = 1;');
    await vfs.writeFile('src/nested/keep.css', 'body {}');

    vfs = await makeVfs(); // simulando reload do app
    expect((await vfs.readFile('src/keep.js')).content).toBe('export const x = 1;');
    expect(await vfs.exists('src/nested/keep.css')).toBe(true);
  });

  it('bloqueia escrita de conteúdo acima de 1MB', async () => {
    const vfs = await makeVfs();
    const big = 'x'.repeat(1024 * 1024 + 1);
    await expect(vfs.writeFile('big.txt', big)).rejects.toThrow(/max 1MB/);
  });
});

describe('VFSService — listagem e mime', () => {
  beforeEach(() => {
    resetIndexedDB();
  });

  // Instância SEM o seed inicial (base limpa para listagens exatas).
  async function makeCleanVfs() {
    const vfs = new VFSService();
    await vfs.ready;
    await vfs.db.files.clear();
    await vfs.db.directories.clear();
    await vfs.db.metadata.put({ key: 'seeded', value: true });
    return vfs;
  }

  it('listDir retorna arquivos e diretórios agrupados', async () => {
    const vfs = await makeCleanVfs();
    await vfs.writeFile('root.txt', 'a');
    await vfs.writeFile('src/a.js', 'a');
    await vfs.writeFile('src/b.js', 'b');
    await vfs.writeFile('src/sub/c.js', 'c');
    await vfs.writeFile('src/sub/d.css', 'd');

    const root = await vfs.listDir();
    expect(root.files.map((f) => f.name)).toEqual(['root.txt']);
    expect(root.dirs.map((d) => d.name)).toEqual(['src']);

    const src = await vfs.listDir('src');
    expect(src.files.map((f) => f.name)).toEqual(['a.js', 'b.js']);
    expect(src.dirs.map((d) => d.name)).toEqual(['sub']);

    const sub = await vfs.listDir('src/sub');
    expect(sub.files.map((f) => f.name)).toEqual(['c.js', 'd.css']);
    expect(sub.dirs).toEqual([]);
  });

  it('resolve mime por extensão e por data URL', () => {
    expect(VFSService.resolveMime('x.png', '')).toBe('image/png');
    expect(VFSService.resolveMime('x.html', '')).toBe('text/html');
    expect(VFSService.resolveMime('x.doc', '')).toBe('text/plain');
    expect(VFSService.resolveMime('x.pdf', 'data:application/pdf;base64,AAAA')).toBe('application/pdf');
  });

  it('listAllFiles ordena por path', async () => {
    const vfs = await makeCleanVfs();
    await vfs.writeFile('z.js', '');
    await vfs.writeFile('a.js', '');
    const paths = await vfs.listAllFiles();
    expect(paths).toEqual(['a.js', 'z.js']);
  });
});

describe('VFSService — eventos', () => {
  beforeEach(() => {
    resetIndexedDB();
  });

  it('emite vfs:changed em create/update/delete/rename', async () => {
    const vfs = new VFSService();
    await vfs.ready;
    const events = [];
    vfs.events.on('vfs:changed', (e) => events.push(e));

    await vfs.writeFile('e1.js', '1');
    await vfs.writeFile('e1.js', '2');
    await vfs.renameFile('e1.js', 'e2.js');
    await vfs.deleteFile('e2.js');

    expect(events.map((e) => e.type)).toEqual(['create', 'update', 'rename', 'delete']);
    expect(events[2].from).toBe('e1.js');
    expect(events[2].path).toBe('e2.js');
  });

  it('silent não emite evento', async () => {
    const vfs = new VFSService();
    await vfs.ready;
    const events = [];
    vfs.events.on('vfs:changed', (e) => events.push(e));
    await vfs.writeFile('silent.js', '1', { silent: true });
    await vfs.deleteFile('silent.js', { silent: true });
    expect(events).toEqual([]);
  });
});