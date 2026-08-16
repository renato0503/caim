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
 */
export class OpenCodeDriver extends BaseDriver {
  parseResponse(text) {
    const json = extractJson(text);
    if (!json) return [];
    const tools = [];
    if (Array.isArray(json.files)) {
      for (const f of json.files) {
        if (f && typeof f.path === 'string' && typeof f.content === 'string') {
          tools.push({ tool: 'write_file', args: { path: f.path, content: f.content } });
        }
      }
    }
    return tools;
  }

  extractMessage(text) {
    const json = extractJson(text);
    return json && typeof json.message === 'string' ? json.message : text;
  }
}
