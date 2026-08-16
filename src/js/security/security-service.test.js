import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from './security-service.js';

// J1/J2/S2: AES-GCM via Web Crypto — cifra e decifra sem texto puro persistido.

describe('SecurityService — AES-GCM', () => {
  beforeEach(() => {
    resetIndexedDB();
  });

  async function makeSecurity() {
    const s = new SecurityService();
    await s.masterKeyPromise;
    return s;
  }

  it('cifra e decifra texto plano', async () => {
    const s = await makeSecurity();
    const secret = 'sk-1234567890';
    const encrypted = await s.encrypt(secret);
    expect(typeof encrypted.iv).toBe('string');
    expect(typeof encrypted.ciphertext).toBe('string');
    expect(encrypted.ciphertext).not.toContain('sk-');
    expect(await s.decrypt(encrypted)).toBe(secret);
  });

  it('produz ciphertexts diferentes para o mesmo texto (IV aleatório)', async () => {
    const s = await makeSecurity();
    const a = await s.encrypt('mesma-chave');
    const b = await s.encrypt('mesma-chave');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('falha ao decifrar com IV/ciphertext adulterado', async () => {
    const s = await makeSecurity();
    const encrypted = await s.encrypt('segredo');
    await expect(s.decrypt({ iv: encrypted.iv, ciphertext: 'AAAA' })).rejects.toThrow();
  });

  it('storeSecret/readSecret persistem cifrado na base', async () => {
    const s = await makeSecurity();
    await s.storeSecret('GITHUB_PAT', 'ghp_secret');
    const rec = await s.db.secrets.get('sec:GITHUB_PAT');
    expect(rec.value.ciphertext).not.toContain('ghp_secret');
    expect(await s.readSecret('GITHUB_PAT')).toBe('ghp_secret');
    expect(await s.hasSecret('GITHUB_PAT')).toBe(true);
    await s.deleteSecret('GITHUB_PAT');
    expect(await s.hasSecret('GITHUB_PAT')).toBe(false);
  });

  it('reutiliza a mesma master key após novo SecurityService (mesma base)', async () => {
    let s = await makeSecurity();
    const encrypted = await s.encrypt('dado');
    s = await makeSecurity(); // mesma base fake-indexeddb → mesma master key
    expect(await s.decrypt(encrypted)).toBe('dado');
  });
});