import { vfs } from '../core/vfs-service.js';
import { bytesToBase64, base64ToBytes } from '../utils/base64.js';

/**
 * S2 — gitFs: adapter de filesystem para o isomorphic-git sobre o VFS (Dexie).
 * Os arquivos internos do git (`.git/`) são binários → armazenados como base64
 * no Dexie para round-trip sem corrupção. Arquivos do usuário seguem UTF-8.
 */

const GIT_PREFIX = '.git/';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function stripLeading(path) {
  return path.replace(/^\/+/, '');
}

function isGitPath(p) {
  return p === '.git' || p.startsWith(GIT_PREFIX);
}

function statFile(content) {
  return {
    type: 'file',
    size: typeof content === 'string' ? content.length : content.byteLength,
    mode: 0o100644,
    uid: 0,
    gid: 0,
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    isFile: () => true,
    isDirectory: () => false,
    isSymbolicLink: () => false,
  };
}

function statDir() {
  return {
    type: 'dir',
    size: 0,
    mode: 0o040000,
    uid: 0,
    gid: 0,
    mtimeMs: Date.now(),
    ctimeMs: Date.now(),
    isFile: () => false,
    isDirectory: () => true,
    isSymbolicLink: () => false,
  };
}

export const gitFs = {
  promises: {
    async readFile(path) {
      const p = stripLeading(path);
      if (!p) return new Uint8Array(0);
      const { content } = await vfs.readFile(p);
      if (isGitPath(p)) return base64ToBytes(content);
      return encoder.encode(content);
    },

    async writeFile(path, data) {
      const p = stripLeading(path);
      const bytes = typeof data === 'string' ? encoder.encode(data) : new Uint8Array(data);
      const content = isGitPath(p) ? bytesToBase64(bytes) : decoder.decode(bytes);
      await vfs.writeFile(p, content, { silent: isGitPath(p) });
    },

    async unlink(path) {
      const p = stripLeading(path);
      if (!p) return;
      try {
        await vfs.deleteFile(p, { silent: isGitPath(p) });
      } catch (err) {
        // ENOENT: já inexistente
      }
    },

    async readdir(path) {
      const p = stripLeading(path);
      const { files, dirs } = await vfs.listDir(p);
      return [...dirs.map((d) => d.name), ...files.map((f) => f.name)];
    },

    async mkdir(path) {
      const p = stripLeading(path);
      if (p) await vfs.ensureDir(p);
    },

    async rmdir(path) {
      const p = stripLeading(path);
      if (!p) return;
      await vfs.db.directories.delete(p);
    },

    async stat(path) {
      const p = stripLeading(path);
      if (!p) return statDir();
      const file = await vfs.db.files.get(p);
      if (file) return statFile(file.content);
      const dir = await vfs.db.directories.get(p);
      if (dir) return statDir();
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    },

    async lstat(path) {
      return this.stat(path);
    },

    async readlink() {
      throw new Error('EINVAL: readlink not supported');
    },

    async symlink() {
      throw new Error('EPERM: symlinks not supported');
    },
  },
};
