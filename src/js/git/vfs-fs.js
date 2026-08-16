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

function contentStamp(content) {
  const bytes = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
  let h1 = 2166136261;
  let h2 = 2246822519;
  for (let i = 0; i < bytes.length; i += 1) {
    h1 ^= bytes[i];
    h1 = Math.imul(h1, 16777619);
    h2 ^= bytes[i];
    h2 = Math.imul(h2, 16777619) + h1;
  }
  return { mtime: h1 >>> 0, ctime: h2 >>> 0 };
}

function statFile(content) {
  const stamp = contentStamp(content);
  return {
    type: 'file',
    size: typeof content === 'string' ? content.length : content.byteLength,
    mode: 0o100644,
    uid: 0,
    gid: 0,
    // compareStats do isomorphic-git só olha segundos (e ignora inode no win32).
    // Date.now() truncado a 1s + tamanho igual fazia edições no mesmo segundo
    // passarem despercebidas. Hash do conteúdo => conteúdo igual reusa o cache
    // do index (correto) e conteúdo diferente força re-leitura (correto).
    mtimeMs: 1_500_000_000_000 + (stamp.mtime % 1_000_000_000),
    ctimeMs: 1_500_000_000_000 + (stamp.ctime % 1_000_000_000),
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
    async readFile(path, options = {}) {
      const p = stripLeading(path);
      const encoding = typeof options === 'string' ? options : options?.encoding;
      if (!p) return encoding === 'utf8' ? '' : new Uint8Array(0);
      let content;
      try {
        ({ content } = await vfs.readFile(p));
      } catch (err) {
        err.code = 'ENOENT'; // isomorphic-git confia em err.code para decisões
        throw err;
      }
      // Arquivos internos do git (.git/) são armazenados em base64 (binário-safe).
      // Quando o isomorphic-git pede utf8 (HEAD/refs/config), devolvemos string.
      const bytes = isGitPath(p) ? base64ToBytes(content) : encoder.encode(content);
      return encoding === 'utf8' ? decoder.decode(bytes) : bytes;
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
      if (!p || p === '.') return statDir();
      const file = await vfs.db.files.get(p);
      if (file) return statFile(file.content);
      const dir = await vfs.db.directories.get(p);
      if (dir) return statDir();
      const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      err.code = 'ENOENT';
      throw err;
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
