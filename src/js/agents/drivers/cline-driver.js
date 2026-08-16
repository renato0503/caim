import { BaseDriver } from './base-driver.js';

/**
 * S6 — ClineDriver: saída em tags XML.
 * <write_to_file path="...">conteúdo</write_to_file>
 * <read_file path="..."/>
 * <list_dir path="..."/>
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
    return tools;
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
