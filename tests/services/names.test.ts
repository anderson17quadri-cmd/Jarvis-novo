import { describe, expect, it } from 'vitest';

import { appTitle, stateName, themeName, widgetName } from '@/lib/names';

/**
 * Nomes partilhados (Partes 10 e 13).
 *
 * Um só sítio para "Abrir emails" deixar de acontecer — nos comandos de voz e
 * nas automações ao mesmo tempo, e não outra vez em cada um à vez.
 */
describe('lib/names', () => {
  it('appTitle devolve o título, não o identificador', () => {
    expect(appTitle('emails')).toBe('Emails');
    expect(appTitle('emails')).not.toBe('emails');
  });

  it('themeName devolve o nome do tema oficial', () => {
    expect(themeName('oled')).toBe('OLED Black');
  });

  it('themeName cai no identificador para um tema personalizado', () => {
    // Os temas do utilizador não estão em `THEMES` — a função não pode
    // rebentar por causa disso, só não tem um nome bonito para mostrar.
    const custom = 'custom:abc123' as Parameters<typeof themeName>[0];
    expect(themeName(custom)).toBe(custom);
  });

  it('widgetName devolve o nome do widget', () => {
    expect(widgetName('cpu')).toBe('CPU');
  });

  it('stateName devolve o nome do modo do sistema', () => {
    expect(stateName('foco')).toBe('Foco');
    expect(stateName('economia')).toBe('Economia');
  });
});
