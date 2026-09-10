import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CoreRings } from '@/components/ai-core/CoreRings';

/**
 * Esconder os anéis do núcleo (Parte 15 §Núcleo personalizável) — a opção
 * que ficava por decidir. Desligado, fica só o brilho central; as
 * partículas orbitais vivem à parte, num canvas próprio (`AICore.tsx`), e
 * não são deste componente.
 */
describe('CoreRings — esconder os anéis', () => {
  it('por omissão (ringsVisible ausente), os anéis aparecem', () => {
    const { container } = render(<CoreRings mode="idle" color="#00CFFF" />);

    // Cinco `<g>` são os anéis (ver RING_SPEEDS); mais os dois das cruzetas.
    expect(container.querySelectorAll('g').length).toBe(7);
  });

  it('ringsVisible=false esconde os anéis e as cruzetas, mas não o brilho', () => {
    const { container } = render(<CoreRings mode="idle" color="#00CFFF" ringsVisible={false} />);

    expect(container.querySelectorAll('g').length).toBe(0);
    // O núcleo energético (o brilho) é um <circle> direto, fora de qualquer <g>.
    expect(container.querySelector('circle[fill="url(#core-glow-gradient)"]')).not.toBeNull();
  });

  it('ringsVisible=true é o mesmo que omitir a prop', () => {
    const { container } = render(<CoreRings mode="idle" color="#00CFFF" ringsVisible />);

    expect(container.querySelectorAll('g').length).toBe(7);
  });
});
