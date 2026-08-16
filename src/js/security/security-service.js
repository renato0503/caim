import Dexie from 'dexie';
import { bytesToBase64, base64ToBytes } from '../utils/base64.js';

/**
 * S2 — SecurityService (Web Crypto AES-GCM)
 * Guarda PATs e API keys cifrados no IndexedDB. O texto puro só existe em
 * memória no instante em que é usado (encrypt/decrypt).
 * Nota de hardening (S11): derivar a master key de uma passphrase do usuário.
 */
export class SecurityService {
  constructor() {
    this.db = new Dexie('caim-secrets');
    this.db.version(1).stores({ secrets: '&key, value' });
    this.masterKeyPromise = this.init();
    this.userKeyCache = new Map();
  }

  // Salt compartilhado com o backend (Admin SDK) para derivar a chave
  // das LLM keys por usuário — o texto puro nunca é gravado no Firestore.
  static get LLM_SALT() {
    return 'caim-llm-v1::';
  }

  async init() {
    const record = await this.db.secrets.get('masterKey');
    if (record?.value?.jwk) {
      return crypto.subtle.importKey('jwk', record.value.jwk, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const jwk = await crypto.subtle.exportKey('jwk', key);
    await this.db.secrets.put({ key: 'masterKey', value: { jwk } });
    return key;
  }

  // Deriva uma chave AES-GCM determinística a partir do UID do usuário.
  // Usada para cifrar llm_keys de forma compatível com o Admin SDK.
  async deriveUserKey(uid) {
    if (!uid) return null;
    if (this.userKeyCache.has(uid)) return this.userKeyCache.get(uid);
    const data = new TextEncoder().encode(SecurityService.LLM_SALT + uid);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    this.userKeyCache.set(uid, key);
    return key;
  }

  async encryptForUser(uid, plaintext) {
    const key = await this.deriveUserKey(uid);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
  }

  async decryptForUser(uid, { iv, ciphertext }) {
    const key = await this.deriveUserKey(uid);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
    return new TextDecoder().decode(plain);
  }

  async encrypt(plaintext) {
    const key = await this.masterKeyPromise;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext)
    );
    return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
  }

  async decrypt({ iv, ciphertext }) {
    const key = await this.masterKeyPromise;
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext)
    );
    return new TextDecoder().decode(plain);
  }

  async storeSecret(name, plaintext) {
    const secret = await this.encrypt(plaintext);
    await this.db.secrets.put({ key: `sec:${name}`, value: secret });
  }

  async readSecret(name) {
    const rec = await this.db.secrets.get(`sec:${name}`);
    if (!rec?.value) return null;
    return this.decrypt(rec.value);
  }

  async hasSecret(name) {
    return !!(await this.db.secrets.get(`sec:${name}`));
  }

  async deleteSecret(name) {
    await this.db.secrets.delete(`sec:${name}`);
  }
}

export const security = new SecurityService();
