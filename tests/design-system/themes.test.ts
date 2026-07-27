import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { COLORS, RADIUS, SPACING, LAYOUT, THEMES } from '@/design-system/tokens';

/**
 * `themes.css` tem de espelhar `tokens.ts`.
 *
 * O CSS não consegue importar TypeScript, por isso os valores estão escritos nos
 * dois sítios. Este teste é o que impede os dois de divergirem em silêncio —
 * sem ele, a promessa de "token único" seria só uma intenção.
 */

const css = readFileSync(join(process.cwd(), 'src/styles/themes.css'), 'utf8');

/** Extrai o valor de uma variável CSS de dentro de um bloco. */
function readVariable(block: string, name: string): string | null {
  const match = new RegExp(`--${name}\\s*:\\s*([^;]+);`).exec(block);
  return match?.[1]?.trim() ?? null;
}

function readBlock(selector: string): string {
  const escaped = selector.replace(/[[\]'"=]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`Bloco "${selector}" não encontrado em themes.css`);
  return match[1];
}

/** Normaliza para comparar `#00CFFF` com `#00cfff` e `.06` com `0.06`. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '').replace(/(^|[^\d])\./g, '$10.');
}

describe('themes.css espelha os tokens', () => {
  const root = readBlock(':root');

  it.each([
    ['bg', COLORS.bg],
    ['bg2', COLORS.bg2],
    ['card', COLORS.card],
    ['card-hover', COLORS.cardHover],
    ['line', COLORS.line],
    ['line-2', COLORS.line2],
    ['t1', COLORS.t1],
    ['t2', COLORS.t2],
    ['t3', COLORS.t3],
    ['accent', COLORS.accent],
    ['neon', COLORS.neon],
    ['green', COLORS.green],
    ['yellow', COLORS.yellow],
    ['red', COLORS.red],
  ])('a cor --%s bate certo', (name, expected) => {
    expect(normalize(readVariable(root, name) ?? '')).toBe(normalize(expected));
  });

  it.each([
    ['r-btn', RADIUS.btn],
    ['r-card', RADIUS.card],
    ['r-modal', RADIUS.modal],
    ['r-input', RADIUS.input],
  ])('o raio --%s bate certo', (name, expected) => {
    expect(readVariable(root, name)).toBe(expected);
  });

  it.each([
    ['s1', SPACING.s1],
    ['s2', SPACING.s2],
    ['s3', SPACING.s3],
    ['s4', SPACING.s4],
    ['s5', SPACING.s5],
    ['s6', SPACING.s6],
  ])('o espaçamento --%s bate certo', (name, expected) => {
    expect(readVariable(root, name)).toBe(expected);
  });

  it('a estrutura bate certo', () => {
    expect(readVariable(root, 'header-h')).toBe(LAYOUT.headerHeight);
    expect(readVariable(root, 'rail-w')).toBe(LAYOUT.railWidth);
    expect(readVariable(root, 'rail-w-open')).toBe(LAYOUT.railWidthOpen);
  });

  describe('cada tema alternativo aplica exatamente as suas sobreposições', () => {
    /** Nome do token em `ThemeOverrides` → nome da variável CSS. */
    const CSS_NAME: Record<string, string> = {
      bg: 'bg',
      bg2: 'bg2',
      card: 'card',
      cardHover: 'card-hover',
      accent: 'accent',
      neon: 'neon',
      glow: 'glow',
    };

    for (const theme of THEMES) {
      if (theme.id === 'classic') continue;

      it(theme.name, () => {
        const block = readBlock(`[data-theme='${theme.id}']`);

        for (const [token, value] of Object.entries(theme.overrides)) {
          const cssName = CSS_NAME[token];
          expect(cssName, `token "${token}" sem mapeamento para CSS`).toBeDefined();
          expect(normalize(readVariable(block, cssName ?? '') ?? '')).toBe(normalize(value));
        }
      });
    }
  });
});
