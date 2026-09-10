import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { COLORS } from '@/design-system/tokens';

/**
 * O manifesto é lido pelo browser, não pelo TypeScript: nada no build o
 * valida. Este teste é o que impede um ícone renomeado ou uma cor trocada de
 * passarem despercebidos até alguém tentar instalar a aplicação no telemóvel.
 */

const root = process.cwd();

interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose: string;
}

interface Manifest {
  readonly name: string;
  readonly short_name: string;
  readonly display: string;
  readonly start_url: string;
  readonly scope: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: readonly ManifestIcon[];
}

// `JSON.parse` devolve `any`; a asserção é aqui, num sítio só, e o resto do
// ficheiro fica tipado.
const manifest = JSON.parse(
  readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'),
) as Manifest;

/** Lê largura e altura do cabeçalho IHDR de um PNG. */
function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

describe('manifesto da PWA', () => {
  it('tem nome, nome curto e abre sem barra do browser', () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    // O Android corta os nomes curtos aos ~12 caracteres no ecrã principal.
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.display).toBe('standalone');
  });

  it('arranca na raiz, e o âmbito cobre a aplicação toda', () => {
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
  });

  it('as cores são as do tema, não valores à parte', () => {
    expect(manifest.background_color.toLowerCase()).toBe(COLORS.bg.toLowerCase());
    expect(manifest.theme_color.toLowerCase()).toBe(COLORS.bg.toLowerCase());
  });

  it('traz os dois tamanhos que o Android exige', () => {
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('traz uma versão `maskable` — sem ela o Android põe o ícone num quadrado branco', () => {
    expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('cada ícone existe e tem mesmo o tamanho declarado', () => {
    for (const icon of manifest.icons) {
      const path = join(root, 'public', icon.src.replace(/^\//, ''));
      expect(existsSync(path), `${icon.src} não existe`).toBe(true);

      const [declared] = icon.sizes.split('x');
      const { width, height } = pngSize(path);

      expect(width, `${icon.src} tem ${width}px de largura`).toBe(Number(declared));
      expect(height).toBe(Number(declared));
    }
  });
});

describe('ligações no index.html', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');

  it('a página aponta para o manifesto', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('/manifest.webmanifest');
  });

  it('a cor da barra do sistema é a mesma do manifesto', () => {
    expect(html).toContain(`content="${manifest.theme_color}"`);
  });
});

describe('service worker', () => {
  const source = readFileSync(join(root, 'public/sw.js'), 'utf8');

  it('trata `fetch` — sem isso o browser não oferece instalar', () => {
    expect(source).toContain("addEventListener('fetch'");
  });

  it('o casco em cache existe todo', () => {
    const match = /const SHELL = \[([^\]]*)\]/.exec(source);
    expect(match?.[1]).toBeDefined();

    const entries = [...match![1]!.matchAll(/'([^']+)'/g)].map((hit) => hit[1]!);

    for (const entry of entries) {
      // A raiz e o index.html são a mesma coisa servida pelo servidor.
      if (entry === '/') continue;
      const path = join(root, entry === '/index.html' ? 'index.html' : `public${entry}`);
      expect(existsSync(path), `${entry} está na cache mas não existe`).toBe(true);
    }
  });
});
