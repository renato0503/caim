/**
 * S31/S34 — Renderização do bubble do chat.
 *
 * S31: o bubble exibe o `message` extraído pelo driver + chips de arquivo com
 * ações (Abrir/Preview). O JSON cru da tool call NUNCA é injetado como HTML —
 * vai em `<details>` de debug via textContent (evita XSS e o "sumiço" das tags
 * HTML embutidas no conteúdo gerado).
 *
 * S34: intenção de "ver o site" (localhost/preview/rodar) abre o Preview.
 */

// S34: detecta pedidos de "ver/rodar/mostrar o site" — CAIM não usa localhost.
export function detectViewIntent(text) {
  return /localhost|preview|ver o site|abrir o site|rodar|mostrar o site/i.test((text || '').trim());
}

// S31: texto principal da resposta — usa o `message` extraído pelo driver
// (ou fallback), nunca o payload bruto da stream.
export function buildFinalText(result, fallback = '') {
  const truncatedNote = result.truncated ? '\n\n⚠ **Resposta truncada** — o modelo cortou a saída no meio.' : '';
  const binaryNote = result.binaryWarnings?.length
    ? `\n\n⚠ Binário ignorado na geração: ${result.binaryWarnings.join(', ')}. Use o upload.`
    : '';
  const overwriteNote = result.overwrites?.length
    ? `\n\n⚠ **Arquivos sobrescritos:** ${result.overwrites.join(', ')}. Revise no Diff.`
    : '';
  const costNote = result.approxTokens ? `\n\n*~${result.approxTokens} tokens estimados nesta geração.*` : '';
  const body = result.message || (result.files?.length ? '✅ Arquivos gerados.' : fallback);
  return `${body}${truncatedNote}${binaryNote}${overwriteNote}${costNote}`;
}

// S31: chip por arquivo gerado — [📄 index.html] com ações Abrir/Preview.
// `handlers` = { onOpen(path), onPreview(path) } (injetado p/ testabilidade).
export function fileChip(path, handlers = {}) {
  const chip = document.createElement('span');
  chip.className = 'chat-file-chip';
  const name = document.createElement('span');
  name.className = 'chat-file-chip-name';
  name.textContent = `📄 ${path}`;
  name.title = path;
  chip.appendChild(name);
  if (handlers.onOpen) {
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'chat-file-chip-btn';
    openBtn.textContent = 'Abrir';
    openBtn.addEventListener('click', () => handlers.onOpen(path));
    chip.appendChild(openBtn);
  }
  if (handlers.onPreview) {
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'chat-file-chip-btn';
    previewBtn.textContent = '👁';
    previewBtn.title = 'Preview';
    previewBtn.addEventListener('click', () => handlers.onPreview(path));
    chip.appendChild(previewBtn);
  }
  return chip;
}

// S31: container de chips de arquivo gerados.
export function fileChips(files, handlers = {}) {
  const chips = document.createElement('div');
  chips.className = 'chat-file-chips';
  for (const path of files || []) {
    chips.appendChild(fileChip(path, handlers));
  }
  return chips;
}

// S31: JSON cru da tool call em <details> de debug via textContent.
export function debugRawDetails(raw) {
  const details = document.createElement('details');
  details.className = 'chat-debug-raw';
  const summary = document.createElement('summary');
  summary.textContent = 'Debug (JSON bruto)';
  const body = document.createElement('pre');
  body.className = 'chat-debug-raw-body';
  body.textContent = raw;
  details.appendChild(summary);
  details.appendChild(body);
  return details;
}

// S34: monta a resposta de "ver o site" e os handlers de abertura.
// `filesList` = paths raiz do VFS; `handlers` = { onPreview(path) }.
export async function handleViewIntent(text, filesList, handlers = {}) {
  const html = filesList.find((p) => /\.html?$/i.test(p)) || filesList.find((p) => /\.(md|txt)$/i.test(p));
  if (!html) {
    return (
      'O CAIM não usa localhost 🙃 — ainda não há um arquivo para visualizar. ' +
      'Peça no chat um site (ex.: "crie um site de currículo") e depois toque 🚀 Deploy para publicar.'
    );
  }
  try {
    if (handlers.onPreview) handlers.onPreview(html);
    return 'O CAIM não usa localhost 🙃 — abri o **Preview** de `' + html + '` no pane 👁. ' +
      'Para publicar, use 🚀 **Deploy**.';
  } catch (err) {
    return `Erro ao abrir o preview: ${err.message}`;
  }
}