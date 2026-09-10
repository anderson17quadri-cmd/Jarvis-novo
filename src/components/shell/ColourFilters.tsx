import { DALTONISM_MATRICES, type DaltonismKind } from '@/types/appearance';

/**
 * Filtros de daltonismo (Parte 15 §Acessibilidade).
 *
 * Um `<svg>` invisível com uma matriz de cor por tipo. O CSS aplica-os ao
 * `<html>` por `filter: url(#…)`, e passam a valer para tudo o que está no
 * ecrã — incluindo os `<canvas>` do núcleo e dos gráficos, que uma solução
 * feita só de variáveis CSS não alcançaria.
 *
 * **Não são simulações.** São correções: aproximam os canais que o olho não
 * distingue, para o vermelho e o verde do sistema — que dizem "erro" e "bem" —
 * deixarem de ser a mesma cor. As matrizes vêm da compensação de Machado,
 * Oliveira e Fernandes.
 *
 * Montado uma vez, sempre presente: um filtro que não existe no DOM quando o
 * CSS o pede deixa a página inteira em branco no Chromium.
 */
export function ColourFilters(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute h-0 w-0 overflow-hidden"
    >
      <defs>
        {(Object.keys(DALTONISM_MATRICES) as DaltonismKind[])
          .filter((kind) => kind !== 'nenhum')
          .map((kind) => (
            <filter key={kind} id={`daltonismo-${kind}`} colorInterpolationFilters="linearRGB">
              <feColorMatrix type="matrix" values={DALTONISM_MATRICES[kind].join(' ')} />
            </filter>
          ))}
      </defs>
    </svg>
  );
}
