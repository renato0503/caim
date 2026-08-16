import { BaseDriver } from './base-driver.js';

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

/**
 * S6 — OpenCodeDriver: saída JSON.
 * {"message":"...","files":[{"path":"...","content":"..."}]}
 *
 * S15 (hardening): se a resposta for cortada no meio do JSON (limite de tokens),
 * salva os objetos de arquivo completos que já fecharam e sinaliza truncamento.
 */
export class OpenCodeDriver extends BaseDriver {
  parseResponse(text) {
    const tools = [];
    const json = extractJson(text);
    if (json) {
      if (Array.isArray(json.files)) {
        for (const f of json.files) {
          if (f && typeof f.path === 'string' && typeof f.content === 'string') {
            tools.push({ tool: 'write_file', args: { path: f.path, content: f.content } });
          }
        }
      }
      return tools;
    }
    // JSON inválido (provavelmente truncado): resgata arquivos completos via regex
    const objRe = /\{\s*"path"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    let m;
    while ((m = objRe.exec(text))) {
      tools.push({ tool: 'write_file', args: { path: m[1], content: m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n') } });
    }
    return tools;
  }

  detectTruncation(text) {
    if (typeof text !== 'string' || !text) return false;
    if (extractJson(text)) return false;
    // parece uma tool response JSON mas não parseou → cortada
    return /(?:\{\s*"message"|\{"message"|"files"\s*:)/.test(text);
  }

  extractMessage(text) {
    const json = extractJson(text);
    return json && typeof json.message === 'string' ? json.message : text;
  }
}