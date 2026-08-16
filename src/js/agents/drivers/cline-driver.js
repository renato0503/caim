import { BaseDriver } from './base-driver.js';

/**
 * S6 — ClineDriver: saída em tags XML.
 * <write_to_file path="...">conteúdo</write_to_file>
 * <read_file path="..."/>
 * <list_dir path="..."/>
 *
 * S15 (hardening): tolerância a truncamento — se a stream/limite de tokens
 * cortar a resposta no meio de uma tag, a tool ainda é extraída (conteúdo
 * parcial) e `detectTruncation()` sinaliza para o usuário reenviar.
 */
export class ClineDriver extends BaseDriver {
  parseResponse(text) {
    const tools = [];
    const writeRe = /<write_to_file\s+path="([^"]+)"[^>]*>([\s\S]*?)<\/write_to_file>/g;
    let m;
    while ((m = writeRe.exec(text))) {
      tools.push({ tool: 'write_file', args: { path: m[1], content: m[2] } });
    }
    const readRe = /<read_file\s+path="([^"]+)"[^>]*\/?>/g;
    while ((m = readRe.exec(text))) {
      tools.push({ tool: 'read_file', args: { path: m[1] } });
    }
    const listRe = /<list_dir\s+path="([^"]*)"[^>]*\/?>/g;
    while ((m = listRe.exec(text))) {
      tools.push({ tool: 'list_dir', args: { path: m[1] || '' } });
    }
    this.salvageTruncatedWrite(text, tools);
    return tools;
  }

  /**
   * Extrai um <write_to_file> sem fechamento no fim do texto (resposta cortada).
   * Escreve o conteúdo parcial para não perder o arquivo inteiro.
   */
  salvageTruncatedWrite(text, tools) {
    if (!text) return;
    const openCount = (text.match(/<write_to_file\s/g) || []).length;
    const closeCount = (text.match(/<\/write_to_file>/g) || []).length;
    if (openCount <= closeCount) return;
    const lastOpen = text.lastIndexOf('<write_to_file');
    const tagEnd = text.indexOf('>', lastOpen);
    if (tagEnd === -1) return;
    const tag = text.slice(lastOpen, tagEnd);
    const pathMatch = tag.match(/path="([^"]+)"/);
    if (!pathMatch) return;
    const already = tools.some((t) => t.tool === 'write_file' && t.args.path === pathMatch[1]);
    if (already) return;
    tools.push({
      tool: 'write_file',
      args: { path: pathMatch[1], content: text.slice(tagEnd + 1) },
      truncated: true,
    });
  }

  detectTruncation(text) {
    if (typeof text !== 'string' || !text) return false;
    // Remove tool calls completas e verifica se sobrou alguma tag aberta.
    let remaining = text;
    remaining = remaining.replace(/<write_to_file\s+path="[^"]*"[^>]*>[\s\S]*?<\/write_to_file>/g, '');
    remaining = remaining.replace(/<(read_file|list_dir)\s+path="[^"]*"[^>]*\/>/g, '');
    return /<(write_to_file|read_file|list_dir)\b/.test(remaining);
  }

  extractMessage(text) {
    const cleaned = text
      .replace(/<write_to_file\s+path="[^"]*"[^>]*>[\s\S]*?<\/write_to_file>/g, '')
      .replace(/<read_file\s+path="[^"]*"[^>]*\/?>/g, '')
      .replace(/<list_dir\s+path="[^"]*"[^>]*\/?>/g, '')
      .replace(/<\/?[^>]+>/g, '')
      .trim();
    return cleaned || 'Arquivos alterados.';
  }
}