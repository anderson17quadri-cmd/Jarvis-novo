import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_EVENTS, EventBus, EVENT_LABELS } from '@/services/event-bus';

let bus: EventBus;

beforeEach(() => {
  bus = new EventBus();
});

describe('Event Bus', () => {
  it('entrega o evento a quem o subscreveu', () => {
    const heard: string[] = [];
    bus.on('tema:alterado', (payload) => heard.push(payload.theme));

    bus.emit('tema:alterado', { theme: 'oled' });

    expect(heard).toEqual(['oled']);
  });

  it('não entrega eventos de outro nome', () => {
    const listener = vi.fn();
    bus.on('tema:alterado', listener);

    bus.emit('estado:alterado', { state: 'foco' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('cancelar a subscrição pára a entrega', () => {
    const listener = vi.fn();
    const off = bus.on('email:novo', listener);

    off();
    bus.emit('email:novo', { from: 'a', subject: 'b' });

    expect(listener).not.toHaveBeenCalled();
  });

  it('um ouvinte que rebenta não cala os outros', () => {
    const depois = vi.fn();
    bus.on('email:novo', () => {
      throw new Error('partiu-se');
    });
    bus.on('email:novo', depois);

    expect(() => bus.emit('email:novo', { from: 'a', subject: 'b' })).not.toThrow();
    expect(depois).toHaveBeenCalledOnce();
  });

  it('cancelar durante a emissão não salta o ouvinte seguinte', () => {
    const segundo = vi.fn();
    const off = bus.on('email:novo', () => off());
    bus.on('email:novo', segundo);

    bus.emit('email:novo', { from: 'a', subject: 'b' });

    // A emissão percorre uma cópia — mexer no conjunto a meio não muda a ronda.
    expect(segundo).toHaveBeenCalledOnce();
  });

  it('emitir sem ninguém à escuta não faz nada nem falha', () => {
    expect(() => bus.emit('desktop:carregado', {})).not.toThrow();
  });

  it('todos os eventos têm etiqueta legível', () => {
    for (const event of ALL_EVENTS) {
      expect(EVENT_LABELS[event].length).toBeGreaterThan(0);
    }
  });
});
