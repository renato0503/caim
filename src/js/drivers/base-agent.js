// Agent Base Interface
export class BaseAgent {
  async sendPrompt(prompt) { throw new Error('Not implemented'); }
  async parseResponse(response) { throw new Error('Not implemented'); }
  async executeTool(toolName, args) { throw new Error('Not implemented'); }
}
