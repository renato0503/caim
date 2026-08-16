import { vfs } from '../core/vfs-service.js';

const MAX_CONTENT = 1024 * 1024; // 1MB

/**
 * S6 — Sandboxed Tool Executor.
 * Executa tool calls contra o VFS com validação rígida de path/tamanho.
 */
export class ToolExecutor {
  async execute(tool, args = {}) {
    switch (tool) {
      case 'write_file':
        return this.writeFile(args);
      case 'read_file':
        return this.readFile(args);
      case 'list_dir':
        return this.listDir(args);
      case 'delete_file':
        return this.deleteFile(args);
      default:
        throw new Error(`Tool desconhecida: ${tool}`);
    }
  }

  validatePath(path) {
    if (typeof path !== 'string' || !path.trim()) throw new Error('path inválido');
    if (path.startsWith('/') || path.includes('..')) throw new Error('path inválido');
    if (path === '.git' || path.startsWith('.git/')) throw new Error('path protegido');
  }

  async writeFile({ path, content }) {
    this.validatePath(path);
    if (typeof content !== 'string') throw new Error('content inválido');
    if (content.length > MAX_CONTENT) throw new Error('Arquivo grande demais (max 1MB)');
    const { created } = await vfs.writeFile(path, content);
    return `OK: ${created ? 'criado' : 'atualizado'} ${path}`;
  }

  async readFile({ path }) {
    this.validatePath(path);
    const { content } = await vfs.readFile(path);
    return content.slice(0, MAX_CONTENT);
  }

  async listDir({ path = '' } = {}) {
    if (path) this.validatePath(path);
    const entry = await vfs.listDir(path || '');
    const dirs = entry.dirs.map((d) => d.name).join(', ') || '-';
    const files = entry.files.map((f) => f.name).join(', ') || '-';
    return `dirs: ${dirs}\nfiles: ${files}`;
  }

  async deleteFile({ path }) {
    this.validatePath(path);
    await vfs.deleteFile(path);
    return `OK: excluído ${path}`;
  }
}

export const toolExecutor = new ToolExecutor();
