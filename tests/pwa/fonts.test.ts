import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A tipografia tem de ser local.
 *
 * Vinha do Google Fonts, e isso significava que a PWA instalada abria offline
 * sem a fonte do design. Estes testes existem para o problema não voltar por
 * distração — um `<link>` para um CDN é uma linha fácil de acrescentar.
 */

const root = resolve(__dirname, '../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf-8');

describe('tipografia local', () => {
  const html = read('index.html');
  const css = read('src/styles/fonts.css');
  const worker = read('public/sw.js');

  it('o index.html não pede a fonte a ninguém', () => {
    expect(html).not.toContain('fonts.googleapis.com');
    expect(html).not.toContain('fonts.gstatic.com');
  });

  it('nenhuma folha de estilos aponta para um servidor de fontes', () => {
    for (const file of [
      'src/styles/fonts.css',
      'src/styles/globals.css',
      'src/styles/themes.css',
    ]) {
      expect(read(file), file).not.toMatch(/https?:\/\/fonts\./);
    }
  });

  it('o Inter é declarado a partir de ficheiros do próprio projeto', () => {
    expect(css).toContain("url('/fonts/inter-latin.woff2')");
    expect(css).toContain("url('/fonts/inter-latin-ext.woff2')");
  });

  it('cobre os pesos 300 a 700 que a Parte 1 pede', () => {
    expect(css).toContain('font-weight: 300 700');
  });

  it('os ficheiros existem e são mesmo woff2', () => {
    for (const file of ['public/fonts/inter-latin.woff2', 'public/fonts/inter-latin-ext.woff2']) {
      const bytes = readFileSync(resolve(root, file));
      expect(bytes.length, file).toBeGreaterThan(1000);
      // Assinatura de um woff2: os quatro primeiros bytes são "wOF2".
      expect(bytes.subarray(0, 4).toString('latin1'), file).toBe('wOF2');
    }
  });

  it('o casco do service worker inclui as fontes — senão a primeira abertura offline não as tem', () => {
    expect(worker).toContain('/fonts/inter-latin.woff2');
    expect(worker).toContain('/fonts/inter-latin-ext.woff2');
  });

  it('o index.html pré-carrega o subconjunto latino, para não haver salto de fonte', () => {
    expect(html).toMatch(/rel="preload"[\s\S]*inter-latin\.woff2/);
  });
});

/**
 * Tipografia à escolha (Parte 15 §Tipografia à escolha).
 *
 * As duas famílias novas seguem a mesma regra que o Inter: vendorizadas uma
 * vez, ficheiros a sério, sem pedido nenhum à rede. Estes testes repetem, uma
 * a uma, as garantias que já existiam só para o Inter.
 */
describe('tipografia à escolha', () => {
  const css = read('src/styles/fonts.css');
  const worker = read('public/sw.js');
  const tailwindConfig = read('tailwind.config.ts');

  const FAMILIES: readonly { readonly name: string; readonly file: string }[] = [
    { name: 'Space Grotesk', file: 'space-grotesk' },
    { name: 'IBM Plex Sans', file: 'plex-sans' },
  ];

  it.each(FAMILIES)('$name é declarada a partir de ficheiros do próprio projeto', ({ file }) => {
    expect(css).toContain(`url('/fonts/${file}-latin.woff2')`);
    expect(css).toContain(`url('/fonts/${file}-latin-ext.woff2')`);
  });

  it.each(FAMILIES)('$name cobre os pesos 300 a 700', ({ name }) => {
    const block = css.slice(css.indexOf(`font-family: '${name}'`));
    expect(block.slice(0, 200)).toContain('font-weight: 300 700');
  });

  it.each(FAMILIES)('os ficheiros de $name existem e são mesmo woff2', ({ file }) => {
    for (const suffix of ['latin', 'latin-ext']) {
      const path = `public/fonts/${file}-${suffix}.woff2`;
      const bytes = readFileSync(resolve(root, path));
      expect(bytes.length, path).toBeGreaterThan(1000);
      expect(bytes.subarray(0, 4).toString('latin1'), path).toBe('wOF2');
    }
  });

  it.each(FAMILIES)('o casco do service worker inclui $name — senão só chega offline se já tiver sido pedida', ({ file }) => {
    expect(worker).toContain(`/fonts/${file}-latin.woff2`);
    expect(worker).toContain(`/fonts/${file}-latin-ext.woff2`);
  });

  it('nenhuma das duas aponta para um servidor de fontes', () => {
    expect(css).not.toMatch(/https?:\/\/fonts\./);
  });

  it('o token do Tailwind lê a variável, e não um nome de família fixo', () => {
    // Sem isto, trocar de família na Personalização mudava a variável CSS e
    // nada na página lhe dava ouvidos — as classes `font-sans` continuavam a
    // apontar para o Inter escrito à letra.
    expect(tailwindConfig).toMatch(/sans:\s*\[\s*'var\(--font-sans\)'/);
  });
});
