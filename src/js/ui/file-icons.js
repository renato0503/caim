const BASE =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const OUTLINE =
  '<g opacity="0.45"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7"/></g>';

function svg(glyph) {
  return `<svg ${BASE}>${OUTLINE}${glyph}</svg>`;
}

function txt(label, size) {
  return `<text x="13" y="15" text-anchor="middle" font-size="${size}" font-weight="800" fill="currentColor" stroke="none" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">${label}</text>`;
}

const HTML_G = `<path d="M8.5 9l-3 3 3 3"/><path d="M15.5 9l3 3-3 3"/>`;
const CSS_G = `<path d="M9.5 5v14"/><path d="M14.5 5v14"/><path d="M6.5 9h12"/><path d="M6.5 15h12"/>`;
const JS_G = txt('JS', 9);
const TS_G = txt('TS', 9);
const PY_G = txt('PY', 8);
const PDF_G = txt('PDF', 7);
const ATOM_G =
  '<circle cx="13" cy="8.5" r="1.6"/><ellipse cx="13" cy="8.5" rx="5.5" ry="2.4"/><ellipse transform="rotate(60 13 8.5)" cx="13" cy="8.5" rx="5.5" ry="2.4"/>';
const JSON_G =
  '<path d="M8.5 5.5c-1.2 0-1.6.7-1.6 2v1.8c0 1.1-.4 1.7-1.9 2 1.5.3 1.9.9 1.9 2v1.8c0 1.3.4 2 1.6 2"/><path d="M15.5 5.5c1.2 0 1.6.7 1.6 2v1.8c0 1.1.4 1.7 1.9 2-1.5.3-1.9.9-1.9 2v1.8c0 1.3-.4 2-1.6 2"/>';
const MD_G =
  '<path d="M6.5 6l3 5 3-5"/><path d="M11.5 6l3 5 3-5"/><path d="M12 13.5v5"/><path d="M9.5 16l2.5 2.5 2.5-2.5"/>';
const IMG_G =
  '<rect x="5" y="7" width="14" height="10" rx="1.5"/><circle cx="9.5" cy="10.5" r="1.2"/><path d="M19 15l-5-5-8 8"/>';
const DOC_G = '<path d="M6.5 9.5h11"/><path d="M6.5 13h11"/><path d="M6.5 16.5h7"/>';
const XLS_G =
  '<rect x="5.5" y="6.5" width="13" height="11" rx="1"/><path d="M5.5 10h13"/><path d="M11 10v7.5"/>';
const PPT_G =
  '<rect x="5" y="6" width="14" height="8" rx="1"/><path d="M12 14v4"/><path d="M8.5 18h7"/>';
const ZIP_G =
  '<path d="M7 4.5v2"/><path d="M11 4.5v2"/><path d="M15 4.5v2"/><rect x="4.5" y="8.5" width="15" height="11" rx="1"/><path d="M12 11.5v3"/><path d="M10.5 14.5h3"/>';
const GIT_G =
  '<circle cx="7" cy="6.5" r="1.6"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="16.5" cy="8.5" r="1.6"/><path d="M7 8.1v7.8"/><path d="M16.5 10.1c0 2.6-2.6 3.4-4.5 4.2"/>';
const CONFIG_G =
  '<path d="M5 8h6"/><path d="M15 8h4"/><circle cx="13" cy="8" r="1.6"/><path d="M5 16h4"/><path d="M13 16h6"/><circle cx="11" cy="16" r="1.6"/>';
const TEXT_G = DOC_G;

const IMG = { cls: 'ft-icon-img', svg: svg(IMG_G) };
const DOC = { cls: 'ft-icon-doc', svg: svg(DOC_G) };
const XLS = { cls: 'ft-icon-xls', svg: svg(XLS_G) };
const PPT = { cls: 'ft-icon-ppt', svg: svg(PPT_G) };
const ZIP = { cls: 'ft-icon-zip', svg: svg(ZIP_G) };
const TEXT = { cls: 'ft-icon-txt', svg: svg(TEXT_G) };

const DEFAULT = { cls: 'ft-icon-file', svg: svg('') };

const FILE_TYPES = {
  html: { cls: 'ft-icon-html', svg: svg(HTML_G) },
  htm: { cls: 'ft-icon-html', svg: svg(HTML_G) },
  css: { cls: 'ft-icon-css', svg: svg(CSS_G) },
  scss: { cls: 'ft-icon-css', svg: svg(CSS_G) },
  sass: { cls: 'ft-icon-css', svg: svg(CSS_G) },
  less: { cls: 'ft-icon-css', svg: svg(CSS_G) },
  js: { cls: 'ft-icon-js', svg: svg(JS_G) },
  mjs: { cls: 'ft-icon-js', svg: svg(JS_G) },
  cjs: { cls: 'ft-icon-js', svg: svg(JS_G) },
  ts: { cls: 'ft-icon-ts', svg: svg(TS_G) },
  jsx: { cls: 'ft-icon-react', svg: svg(ATOM_G) },
  tsx: { cls: 'ft-icon-react', svg: svg(ATOM_G) },
  json: { cls: 'ft-icon-json', svg: svg(JSON_G) },
  jsonc: { cls: 'ft-icon-json', svg: svg(JSON_G) },
  md: { cls: 'ft-icon-md', svg: svg(MD_G) },
  markdown: { cls: 'ft-icon-md', svg: svg(MD_G) },
  png: IMG,
  jpg: IMG,
  jpeg: IMG,
  gif: IMG,
  webp: IMG,
  svg: IMG,
  ico: IMG,
  bmp: IMG,
  avif: IMG,
  pdf: { cls: 'ft-icon-pdf', svg: svg(PDF_G) },
  docx: DOC,
  doc: DOC,
  xlsx: XLS,
  xls: XLS,
  csv: XLS,
  pptx: PPT,
  ppt: PPT,
  zip: ZIP,
  tar: ZIP,
  gz: ZIP,
  '7z': ZIP,
  rar: ZIP,
  py: { cls: 'ft-icon-py', svg: svg(PY_G) },
  txt: TEXT,
  log: TEXT,
};

const GIT_FILES = new Set(['.gitignore', '.gitattributes', '.gitmodules']);
const CONFIG_FILES = new Set(['.env', '.npmrc', '.yarnrc', '.editorconfig', '.eslintrc', '.prettierrc']);

export function getFileIcon(name) {
  const base = String(name).split('/').pop() || '';
  const type = GIT_FILES.has(base)
    ? { cls: 'ft-icon-git', svg: svg(GIT_G) }
    : CONFIG_FILES.has(base)
      ? { cls: 'ft-icon-config', svg: svg(CONFIG_G) }
      : FILE_TYPES[extOf(base)] || DEFAULT;
  return { svg: type.svg, cls: type.cls };
}

function extOf(name) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return '';
  return name.slice(dot + 1).toLowerCase();
}