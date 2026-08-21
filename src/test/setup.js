// Vitest setup — roda antes de cada arquivo de teste.
// fake-indexeddb: emula o IndexedDB (Dexie) em Node.
// resetIndexedDB(): troca a factory para uma base limpa (simula reload).
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

globalThis.resetIndexedDB = () => {
  globalThis.indexedDB = new IDBFactory();
};

// jsdom não implementa Range#getClientRects (usado pelo drawSelection do CM).
if (typeof Range !== 'undefined' && Range.prototype && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function getClientRects() {
    return [];
  };
  Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) };
  };
}