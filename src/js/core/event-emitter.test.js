import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from './event-emitter.js';

describe('EventEmitter', () => {
  it('registra e dispara listeners', () => {
    const ee = new EventEmitter();
    const cb = vi.fn();
    ee.on('vfs:changed', cb);
    ee.emit('vfs:changed', { type: 'create' });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({ type: 'create' });
  });

  it('ignora eventos sem listeners', () => {
    const ee = new EventEmitter();
    expect(() => ee.emit('none', {})).not.toThrow();
  });

  it('remove listener via off() e via retorno de on()', () => {
    const ee = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribe = ee.on('e', a);
    ee.on('e', b);
    ee.off('e', a);
    unsubscribe();
    ee.emit('e', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('não dispara listener removido durante a emissão para chamadas futuras', () => {
    const ee = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    ee.on('e', a);
    const unsub = ee.on('e', b);
    ee.emit('e', 1);
    unsub();
    ee.emit('e', 2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });
});