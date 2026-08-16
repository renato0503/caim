// Vitest setup — roda antes de cada arquivo de teste.
// fake-indexeddb: emula o IndexedDB (Dexie) em Node.
// resetIndexedDB(): troca a factory para uma base limpa (simula reload).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

globalThis.resetIndexedDB = () => {
  globalThis.indexedDB = new IDBFactory();
};