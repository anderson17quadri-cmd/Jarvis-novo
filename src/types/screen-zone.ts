/**
 * Um retângulo do ecrã, em píxeis — usado para descrever zonas sensíveis
 * (Fase 3.3) que ficam tapadas antes de um print sair da máquina.
 *
 * A medida parte do canto superior esquerdo do monitor principal e vai até
 * `x + width` / `y + height`. Só números inteiros: são coordenadas de píxeis,
 * não de um sistema de grelha abstrato.
 */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
