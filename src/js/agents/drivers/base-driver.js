/**
 * S6 — Contrato base dos drivers de agente.
 * Cada driver converte a saída bruta do LLM em tool calls validáveis.
 */
export class BaseDriver {
  /**
   * @param {string} text - saída completa do LLM
   * @returns {Array<{tool: string, args: Object}>}
   */
  parseResponse(text) {
    throw new Error('Not implemented: parseResponse');
  }

  /**
   * @param {string} text - saída completa do LLM
   * @returns {string} mensagem de texto para exibir no chat
   */
  extractMessage(text) {
    throw new Error('Not implemented: extractMessage');
  }
}
