// Gera todos os ícones PNG do CAIM a partir de assets/icons/logo_caim.svg
// usando @resvg/resvg-js + fonte Press Start 2P (baixada localmente).
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'assets/icons/logo_caim.svg');
const fontPath = process.env.CAIM_PIXEL_FONT || join(__dirname, 'PressStart2P-Regular.ttf');
const svg = readFileSync(svgPath, 'utf8');

const targets = [
  { file: 'icon-16.png', size: 16 },
  { file: 'icon-32.png', size: 32 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'maskable-192.png', size: 192 },
  { file: 'maskable-512.png', size: 512 },
  { file: 'favicon.ico', size: 32 },
];

// Splash screens iOS — logo centralizada sobre fundo navy
const splash = [
  { file: 'splash-640x1136.png', w: 640, h: 1136 },
  { file: 'splash-750x1334.png', w: 750, h: 1334 },
  { file: 'splash-1242x2208.png', w: 1242, h: 2208 },
  { file: 'splash-1125x2436.png', w: 1125, h: 2436 },
  { file: 'splash-828x1792.png', w: 828, h: 1792 },
  { file: 'splash-1242x2688.png', w: 1242, h: 2688 },
  { file: 'splash-1170x2532.png', w: 1170, h: 2532 },
  { file: 'splash-1284x2778.png', w: 1284, h: 2778 },
  { file: 'splash-1179x2556.png', w: 1179, h: 2556 },
  { file: 'splash-1290x2796.png', w: 1290, h: 2796 },
];

const iconsDir = join(root, 'assets/icons');
const splashDir = join(root, 'assets/splash');
mkdirSync(iconsDir, { recursive: true });
mkdirSync(splashDir, { recursive: true });

function renderSvg(svgString, width, background = '#0f172a') {
  return new Resvg(svgString, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: 'Press Start 2P' },
    background,
  }).render().asPng();
}

for (const t of targets) {
  const png = renderSvg(svg, t.size);
  writeFileSync(join(iconsDir, t.file), png);
  console.log('OK', t.file, png.length, 'bytes');
}

// Splash: fundo navy + logo CAIM centralizada (~30% da largura)
const logoForSplash = svg;
for (const s of splash) {
  const resvg = new Resvg(logoForSplash, {
    fitTo: { mode: 'width', value: Math.round(s.w * 0.28) },
    font: { fontFiles: [fontPath], loadSystemFonts: false, defaultFontFamily: 'Press Start 2P' },
  });
  const logoPng = resvg.render().asPng();
  const { default: Sharp } = await import('sharp');
  const sharp = Sharp(logoPng);
  const meta = await sharp.metadata();
  const w = meta.width;
  const h = meta.height;
  const left = Math.round((s.w - w) / 2);
  const top = Math.round((s.h - h) / 2);
  const composite = await Sharp({ create: { width: s.w, height: s.h, channels: 3, background: { r: 15, g: 23, b: 42 } } })
    .composite([{ input: logoPng, left, top }])
    .png()
    .toBuffer();
  writeFileSync(join(splashDir, s.file), composite);
  console.log('OK', s.file, composite.length, 'bytes');
}

