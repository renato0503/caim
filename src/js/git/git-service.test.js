import { describe, it, expect, beforeEach } from 'vitest';
import { vfs } from '../core/vfs-service.js';
import { gitService } from './git-service.js';

// S2/S11: fluxo git offline (init → add → commit → status → log) sobre o VFS.

describe('GitService — operações offline', () => {
  beforeEach(async () => {
    // Base limpa por teste (mantém o mesmo IndexedDB/factory do singleton).
    const all = await vfs.listAllFiles();
    for (const p of all) await vfs.deleteFile(p, { silent: true });
    await vfs.db.directories.clear();
  });

  it('init → add → commit → log (1 commit) com conteúdo persistido', async () => {
    await vfs.ready;
    await vfs.writeFile('README.md', '# Projeto');
    await vfs.writeFile('src/app.js', 'export const x = 1;');

    expect(await gitService.isInitialized()).toBe(false);
    await gitService.ensureInit();
    expect(await gitService.isInitialized()).toBe(true);

    await gitService.addAll();
    await gitService.commit('Initial MVP');

    const log = await gitService.log();
    expect(log).toHaveLength(1);
    expect(log[0].commit.message.trim()).toContain('Initial MVP');
  });

  it('status reporta "modificado" após edição e "novo" antes do primeiro commit', async () => {
    await vfs.ready;
    await vfs.writeFile('a.txt', 'v1');
    await gitService.ensureInit();
    await gitService.addAll();

    let status = await gitService.status();
    expect(status.find((e) => e.filepath === 'a.txt')?.status).toBe('novo');

    await gitService.commit('v1');

    await vfs.writeFile('a.txt', 'v2');
    status = await gitService.status();
    expect(status.find((e) => e.filepath === 'a.txt')?.status).toBe('modificado');
  });

  it('reusa o histórico entre instâncias (persistência no VFS)', async () => {
    await vfs.ready;
    await vfs.writeFile('persist.js', 'console.log(1)');
    await gitService.ensureInit();
    await gitService.addAll();
    await gitService.commit('primeiro');

    await vfs.writeFile('persist.js', 'console.log(2)');
    await gitService.addAll();
    await gitService.commit('segundo');

    const log = await gitService.log(5);
    expect(log.map((c) => c.commit.message.trim())).toEqual(['segundo', 'primeiro']);
  });

  it('setRemote/getRemote armazenam e substituem a origin', async () => {
    await vfs.ready;
    await gitService.ensureInit();
    expect(await gitService.getRemote()).toBeNull();
    await gitService.setRemote('https://github.com/renato0503/x.git');
    expect(await gitService.getRemote()).toBe('https://github.com/renato0503/x.git');
    await gitService.setRemote('https://github.com/renato0503/y.git');
    expect(await gitService.getRemote()).toBe('https://github.com/renato0503/y.git');
  });
});