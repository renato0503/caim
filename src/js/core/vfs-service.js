import Dexie from 'dexie';
import { EventEmitter } from './event-emitter.js';

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

function normalizePath(rawPath) {
  if (typeof rawPath !== 'string') throw new Error('Path must be a string');
  let path = rawPath.trim().replace(/\\/g, '/');
  if (path === '') return ''; // raiz do VFS
  if (path.startsWith('/')) throw new Error('Invalid path');
  const parts = [];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) throw new Error('Caminho inválido: não é possível sair do VFS (../)');
      parts.pop();
      continue;
    }
    if (/^[a-zA-Z]:/.test(seg)) throw new Error('Invalid path segment');
    parts.push(seg);
  }
  return parts.join('/');
}

export class VFSService {
  constructor() {
    this.db = new Dexie('caim-vfs');
    this.db.version(1).stores({
      files: '&path, content, lastModified, mimeType',
      directories: '&path',
      metadata: '&key, value',
    });
    // S36: projetos locais — snapshots nomeados do workspace (continuar/renomear/
    // excluir só local; nunca toca no GitHub). project_files: &[projectId+path].
    this.db.version(2).stores({
      files: '&path, content, lastModified, mimeType',
      directories: '&path',
      metadata: '&key, value',
      projects: '&id, name, createdAt, lastModified, deployed, url, fileCount',
      project_files: '&[projectId+path], projectId, path, content, mimeType',
    });
    // S40/S41: `projects` ganha pinned+tags (S40); tabela `trashed` p/ a lixeira
    // (S41 — mover para lá NÃO apaga; apagar só no esvaziar).
    this.db.version(3).stores({
      files: '&path, content, lastModified, mimeType',
      directories: '&path',
      metadata: '&key, value',
      projects: '&id, name, createdAt, lastModified, deployed, url, fileCount, pinned, tags',
      project_files: '&[projectId+path], projectId, path, content, mimeType',
      trashed: '&id, name, createdAt, lastModified, deployed, url, fileCount, pinned, tags, trashedAt',
    });
    this.events = new EventEmitter();
    this.ready = this.init();
  }

  async init() {
    await this.db.open();
    const seeded = await this.db.metadata.get('seeded');
    if (!seeded) {
      await this.seed();
      await this.db.metadata.put({ key: 'seeded', value: true });
    }
    return this;
  }

  async seed() {
    const files = {
      'README.md': '# CAIM Demo\n\nApp móvel de agente de IA. Arquivos criados no chat aparecem aqui no Explorer e abrem no Editor.\n',
      'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>Demo</title>\n</head>\n<body>\n  <h1>Hello CAIM</h1>\n</body>\n</html>\n',
      'src/app.js': "export function hello(name) {\n  return `Olá, ${name}!`;\n}\n\nconsole.log(hello('CAIM'));\n",
      'src/style.css': ':root {\n  --accent: #2dd4bf;\n}\n\nbody {\n  font-family: system-ui, sans-serif;\n}\n',
      'src/data.json': '{\n  "name": "CAIM",\n  "version": "0.1.0",\n  "mobile": true\n}\n',
    };
    const mime = {
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
    };
    const now = Date.now();
    const dirs = new Set(['', 'src']);
    for (const [path, content] of Object.entries(files)) {
      const ext = path.slice(path.lastIndexOf('.'));
      await this.db.files.put({
        path,
        content,
        lastModified: now,
        mimeType: mime[ext] || 'text/plain',
      });
      dirs.add(path.split('/').slice(0, -1).join('/'));
    }
    for (const dir of dirs) {
      if (dir) await this.db.directories.put({ path: dir });
    }
  }

  // ---- Path helpers ----

  static normalize(rawPath) {
    return normalizePath(rawPath);
  }

  static extname(path) {
    const last = path.lastIndexOf('.');
    return last === -1 ? '' : path.slice(last);
  }

  static parentDir(path) {
    const i = path.lastIndexOf('/');
    return i === -1 ? '' : path.slice(0, i);
  }

  static basename(path) {
    const i = path.lastIndexOf('/');
    return i === -1 ? path : path.slice(i + 1);
  }

  // ---- File operations ----

  async exists(path) {
    const p = normalizePath(path);
    return !!(await this.db.files.get(p));
  }

  async readFile(path) {
    const p = normalizePath(path);
    const file = await this.db.files.get(p);
    if (!file) throw new Error(`File not found: ${p}`);
    return { content: file.content, lastModified: file.lastModified, mimeType: file.mimeType };
  }

  async writeFile(path, content, { silent = false } = {}) {
    const p = normalizePath(path);
    if (typeof content !== 'string') throw new Error('Content must be a string');
    if (content.length > MAX_FILE_SIZE) throw new Error('File too large (max 1MB)');
    const existing = await this.db.files.get(p);
    const mime = VFSService.resolveMime(p, content);
    await this.db.files.put({ path: p, content, lastModified: Date.now(), mimeType: mime });
    await this.ensureParentDirs(p);
    if (!silent) this.events.emit('vfs:changed', { type: existing ? 'update' : 'create', path: p });
    return { path: p, created: !existing };
  }

  static resolveMime(path, content) {
    if (typeof content === 'string' && content.startsWith('data:')) {
      return content.slice(5, content.indexOf(';'));
    }
    const ext = VFSService.extname(path);
    return {
      '.md': 'text/markdown',
      '.markdown': 'text/markdown',
      '.html': 'text/html',
      '.htm': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.ts': 'text/typescript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.py': 'text/x-python',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }[ext] || 'text/plain';
  }

  async createFile(path, content = '') {
    const p = normalizePath(path);
    if (await this.exists(p)) throw new Error(`File already exists: ${p}`);
    return this.writeFile(p, content);
  }

  async deleteFile(path, { silent = false } = {}) {
    const p = normalizePath(path);
    await this.db.files.delete(p);
    if (!silent) this.events.emit('vfs:changed', { type: 'delete', path: p });
    return { path: p };
  }

  async renameFile(oldPath, newPath) {
    const oldP = normalizePath(oldPath);
    const newP = normalizePath(newPath);
    if (oldP === newP) return { path: newP };
    const file = await this.db.files.get(oldP);
    if (!file) throw new Error(`File not found: ${oldP}`);
    if (await this.db.files.get(newP)) throw new Error(`Já existe um arquivo em: ${newP}`);
    await this.db.files.put({
      path: newP,
      content: file.content,
      lastModified: Date.now(),
      mimeType: file.mimeType,
    });
    await this.db.files.delete(oldP);
    await this.ensureParentDirs(newP);
    this.events.emit('vfs:changed', { type: 'rename', from: oldP, path: newP });
    return { path: newP };
  }

  async ensureDir(path) {
    const p = normalizePath(path);
    if (!p) return;
    await this.db.directories.put({ path: p });
    this.events.emit('vfs:changed', { type: 'create', path: `${p}/` });
  }

  async listDir(path = '') {
    const p = normalizePath(path);
    const prefix = p ? `${p}/` : '';
    const files = await this.db.files.filter((f) => f.path.startsWith(prefix)).toArray();
    const result = { files: [], dirs: [] };
    for (const f of files) {
      const rest = f.path.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) {
        result.files.push({ path: f.path, name: rest, lastModified: f.lastModified });
      } else {
        const dirName = rest.slice(0, slash);
        if (!result.dirs.some((d) => d.name === dirName)) {
          result.dirs.push({ path: `${prefix}${dirName}`, name: dirName });
        }
      }
    }
    result.files.sort((a, b) => a.name.localeCompare(b.name));
    result.dirs.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  }

  async listAllFiles() {
    const files = await this.db.files.toArray();
    return files.sort((a, b) => a.path.localeCompare(b.path)).map((f) => f.path);
  }

  async ensureParentDirs(filePath) {
    const parent = VFSService.parentDir(filePath);
    if (!parent) return;
    let current = parent;
    const chain = [];
    while (current) {
      chain.unshift(current);
      current = VFSService.parentDir(current);
    }
    for (const dir of chain) {
      await this.db.directories.put({ path: dir });
    }
  }
}

export const vfs = new VFSService();