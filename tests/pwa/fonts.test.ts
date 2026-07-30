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
