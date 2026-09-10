import { describe, expect, it } from 'vitest';

import { seedAutomations } from '@/data/automations';
import {
  describeAction,
  describeCondition,
  describeTrigger,
} from '@/types/automation';

/**
 * As frases das automações (Parte 13).
 *
 * `describeAction`/`describeCondition` mostravam identificadores crus —
 * "Aplicar o tema oled", "Passar ao modo economia" — na própria janela de
 * automações. Ninguém tinha reparado porque não havia teste nenhum sobre
 * este ficheiro; os cinco exemplos que vêm com o sistema usam identificadores
 * a sério, e é sobre eles que se prova a correção.
 */

describe('describeAction usa nomes, não identificadores', () => {
  it('abrir uma janela', () => {
    expect(describeAction({ kind: 'abrir-janela', appId: 'emails' })).toBe('Abrir a janela Emails');
  });

  it('mudar de tema', () => {
    expect(describeAction({ kind: 'tema', theme: 'oled' })).toBe('Aplicar o tema OLED Black');
  });

  it('mudar de estado do sistema', () => {
    expect(describeAction({ kind: 'estado-sistema', state: 'economia' })).toBe(
      'Passar ao modo Economia',
    );
  });

  it('mostrar e esconder um widget', () => {
    expect(describeAction({ kind: 'widget', widget: 'news', show: false })).toBe(
      'Esconder o widget Notícias',
    );
    expect(describeAction({ kind: 'widget', widget: 'news', show: true })).toBe(
      'Mostrar o widget Notícias',
    );
  });
});

describe('describeCondition usa nomes, não identificadores', () => {
  it('condição de estado do sistema', () => {
    expect(describeCondition({ kind: 'estado-sistema', state: 'foco' })).toBe('Só no modo Foco');
  });
});

describe('os cinco exemplos do sistema', () => {
  const automations = seedAutomations();

  it('nenhuma frase de ação ou condição deixa escapar um identificador em minúsculas', () => {
    // Um identificador interno é sempre tudo minúsculas e sem espaço — um
    // nome a sério tem maiúscula inicial. Não é uma prova formal, mas é
    // exatamente o sintoma que se procura: "oled" ao lado de "OLED Black".
    const suspicious = /\b(oled|economia|foco|emails|calendar|news|cpu)\b/;

    for (const automation of automations) {
      for (const action of automation.actions) {
        const phrase = describeAction(action);
        expect(phrase, `${automation.name}: ${JSON.stringify(action)}`).not.toMatch(suspicious);
      }

      for (const condition of automation.conditions) {
        const phrase = describeCondition(condition);
        expect(phrase, `${automation.name}: ${JSON.stringify(condition)}`).not.toMatch(suspicious);
      }
    }
  });

  it('toda a automação descreve o gatilho, sem rebentar', () => {
    for (const automation of automations) {
      expect(describeTrigger(automation.trigger).length, automation.name).toBeGreaterThan(0);
    }
  });
});
