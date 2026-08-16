import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'assets');
const dest = resolve(root, 'public', 'assets');

if (!existsSync(src)) {
  console.warn('[copy-assets] pasta assets/ não encontrada, pulando.');
  process.exit(0);
}

await mkdir(dirname(dest), { recursive: true });
await cp(src, dest, { recursive: true, force: true });
console.log('[copy-assets] assets/ -> public/assets/');