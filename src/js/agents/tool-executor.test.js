import { describe, it, expect } from 'vitest';
import { toolExecutor } from './tool-executor.js';
import { vfs } from '../core/vfs-service.js';

// S6/S18: validação de path no sandbox — rejeita `..`, caminhos absolutos e `.git/`.

describe('ToolExecutor — segurança de path', () => {
  it('rejeita path traversal (..)', async () => {
    await expect(toolExecutor.execute('write_file', { path: '../escape.txt', content: 'x' })).rejects.toThrow(/path inválido/);
    await expect(toolExecutor.execute('read_file', { path: 'a/../../etc' })).rejects.toThrow(/path inválido/);
    await expect(toolExecutor.execute('delete_file', { path: '..' })).rejects.toThrow(/path inválido/);
  });

  it('rejeita caminhos absolutos', async () => {
    await expect(toolExecutor.execute('read_file', { path: '/etc/passwd' })).rejects.toThrow(/path inválido/);
  });

  it('rejeita acesso à pasta .git', async () => {
    await expect(toolExecutor.execute('write_file', { path: '.git/config', content: 'x' })).rejects.toThrow(/protegido/);
    await expect(toolExecutor.execute('list_dir', { path: '.git' })).rejects.toThrow(/protegido/);
  });

  it('aceita path válido e executa no VFS', async () => {
    await vfs.ready;
    const res = await toolExecutor.execute('write_file', { path: 'src/ok.js', content: 'const ok = true;' });
    expect(res).toContain('src/ok.js');
    expect((await vfs.readFile('src/ok.js')).content).toBe('const ok = true;');
  });
});