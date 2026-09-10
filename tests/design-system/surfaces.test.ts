import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { THEMES } from '@/design-system/tokens';

/**
 * Nenhuma superfície escrita à mão.
 *
 * O cabeçalho do `tokens.ts` diz que nenhuma cor pode ser escrita fora dele,
 * mas havia 45 sítios com `bg-white/[.03]` e `bg-[rgb(16_25_34_/_.74)]`. Num
 * tema escuro passavam despercebidas; no Arctic White, que é claro, ficariam
 * branco sobre branco — invisíveis.
 *
 * Agora são `bg-tint/[.03]` e `bg-glass/[.74]`, e a `tint` vira preta no tema
 * claro. Este teste é o que impede as antigas de voltarem.
 */

const files = globSync('src/**/*.{ts,tsx,css}', { cwd: process.cwd() });

/** Padrões que deixaram de ser aceitáveis, e o que os substitui. */
const FORBIDDEN: readonly { readonly pattern: RegExp; readonly instead: string }[] = [
  { pattern: /\bbg-white\/\[/, instead: 'bg-tint/[…]' },
  { pattern: /\bborder-white\//, instead: 'border-tint/…' },
  { pattern: /bg-\[rgb\(16[_ ]25[_ ]34/, instead: 'bg-glass/[…]' },
  { pattern: /bg-\[rgb\(11[_ ]17[_ ]24/, instead: 'bg-glass-deep/[…]' },
];

describe('superfícies vêm todas dos tokens', () => {
  it.each(FORBIDDEN.map((rule) => [rule.pattern.source, rule] as const))(
    'nenhum ficheiro usa %s',
    (_source, rule) => {
      const offenders = files.filter((file) =>
        rule.pattern.test(readFileSync(join(process.cwd(), file), 'utf8')),
      );

      expect(offenders, `use ${rule.instead} em vez disso`).toEqual([]);
    },
  );

  it('o ficheiro dos tokens é o único a saber os valores em bruto', () => {
    const tokens = readFileSync(join(process.cwd(), 'src/design-system/tokens.ts'), 'utf8');

    expect(tokens).toContain('tintRgb');
    expect(tokens).toContain('glassRgb');
    expect(tokens).toContain('glassDeepRgb');
  });
});

describe('temas oficiais', () => {
  it('são os dez da Parte 15', () => {
    expect(THEMES).toHaveLength(10);
  });

  it('cada um tem nome e três amostras', () => {
    for (const theme of THEMES) {
      expect(theme.name.length, theme.id).toBeGreaterThan(0);
      expect(theme.swatches, theme.id).toHaveLength(3);
    }
  });

  it('o tema claro vira a `tint` para preto', () => {
    const arctic = THEMES.find((theme) => theme.id === 'arctic');

    // Sem isto, uma superfície levantada seria branco sobre branco.
    expect(arctic?.overrides.tintRgb).toBe('10 20 30');
    expect(arctic?.overrides.t1).toBeDefined();
  });

  it('todo o tema que muda o fundo muda também o vidro', () => {
    for (const theme of THEMES) {
      if (theme.id === 'classic' || theme.overrides.bg === undefined) continue;

      // Um fundo novo com o vidro antigo dá cartões que não pertencem ao tema.
      expect(theme.overrides.glassRgb, `${theme.id} mudou o fundo mas não o vidro`).toBeDefined();
    }
  });
});
