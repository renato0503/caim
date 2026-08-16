import { describe, it, expect } from 'vitest';
import { ClineDriver } from './cline-driver.js';
import { OpenCodeDriver } from './opencode-driver.js';

// S6: parsing de tool calls. S15: tolerância a truncamento (bug clássico do Cline).

describe('ClineDriver', () => {
  const driver = new ClineDriver();

  it('parseia write_file/read_file/list_dir completos', () => {
    const text =
      '<write_to_file path="src/a.js">const a = 1;</write_to_file>' +
      '<read_file path="src/b.js"/>' +
      '<list_dir path="src"/>';
    const tools = driver.parseResponse(text);
    expect(tools).toHaveLength(3);
    expect(tools[0]).toEqual({ tool: 'write_file', args: { path: 'src/a.js', content: 'const a = 1;' } });
    expect(tools[1]).toEqual({ tool: 'read_file', args: { path: 'src/b.js' } });
    expect(tools[2]).toEqual({ tool: 'list_dir', args: { path: 'src' } });
  });

  it('salva write_file truncado no fim da stream (sem </write_to_file>)', () => {
    const text = 'Aqui vai o código:\n<write_to_file path="index.html"><h1>Olá';
    const tools = driver.parseResponse(text);
    expect(tools).toHaveLength(1);
    expect(tools[0].tool).toBe('write_file');
    expect(tools[0].args.path).toBe('index.html');
    expect(tools[0].args.content).toContain('<h1>Olá');
    expect(tools[0].truncated).toBe(true);
  });

  it('não duplica write_file já parseado completo', () => {
    const text =
      '<write_to_file path="a.js">x</write_to_file><write_to_file path="b.js">' +
      '<write_to_file path="a.js">y</write_to_file>';
    const tools = driver.parseResponse(text);
    const aJs = tools.filter((t) => t.args.path === 'a.js');
    expect(aJs).toHaveLength(1);
  });

  it('detecta truncamento apenas quando há tag aberta sem fechamento', () => {
    expect(driver.detectTruncation('<write_to_file path="a.js">abc')).toBe(true);
    expect(driver.detectTruncation('<read_file path="a.js"/>')).toBe(false);
    expect(driver.detectTruncation('<write_to_file path="a.js">abc</write_to_file>')).toBe(false);
    expect(driver.detectTruncation('texto puro sem tags')).toBe(false);
  });

  it('extractMessage remove as tags', () => {
    const msg = driver.extractMessage('<write_to_file path="a.js">x</write_to_file>\nFeito!');
    expect(msg).toBe('Feito!');
  });
});

describe('OpenCodeDriver', () => {
  const driver = new OpenCodeDriver();

  it('parseia JSON válido', () => {
    const text = '{"message":"ok","files":[{"path":"a.js","content":"x"}]}';
    const tools = driver.parseResponse(text);
    expect(tools).toHaveLength(1);
    expect(tools[0]).toEqual({ tool: 'write_file', args: { path: 'a.js', content: 'x' } });
  });

  it('resgata arquivos completos de JSON truncado', () => {
    const text =
      '{"message":"gerando...","files":[{"path":"a.js","content":"const a = 1;"},' +
      '{"path":"b.js","content":"const b = 2;"}'; // cortado sem fechar
    const tools = driver.parseResponse(text);
    expect(tools).toHaveLength(2);
    expect(tools.map((t) => t.args.path)).toEqual(['a.js', 'b.js']);
  });

  it('detecta truncamento em JSON incompleto', () => {
    expect(driver.detectTruncation('{"message":"oi","files":[{')).toBe(true);
    expect(driver.detectTruncation('{"message":"oi","files":[]}')).toBe(false);
    expect(driver.detectTruncation('não é json')).toBe(false);
  });

  it('extractMessage usa o campo message', () => {
    expect(driver.extractMessage('{"message":"pronto","files":[]}')).toBe('pronto');
  });
});