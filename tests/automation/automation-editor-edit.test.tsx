import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AutomationEditor } from '@/apps/automations/AutomationEditor';
import { automationService } from '@/services/automation-service';

/**
 * Editar uma automação existente (item 10 da fila noturna, revisão a
 * sério). `save()` chamava `automationService.remove()` seguido de
 * `add()` para editar — o que dava um `id` novo à automação e apagava
 * `createdAt`/`lastRunAt`/`runCount`, mesmo numa correção trivial ao
 * nome. Uma regra que já tinha corrido várias vezes voltava a mostrar
 * "nunca correu" só por se lhe ter mudado a descrição.
 */
const noop = (): void => {};

beforeEach(async () => {
  localStorage.clear();
  await automationService.hydrate([]);
  automationService.start(
    { openWindow: noop, notify: noop, setTheme: noop, setSystemState: noop, setWidgetVisible: noop, speak: noop },
    () => ({ now: new Date(), systemState: 'normal' }),
  );
});

afterEach(() => {
  automationService.stop();
});

describe('AutomationEditor — editar automação existente', () => {
  it('guardar sem trocar nada mantém o id e o histórico de execuções', async () => {
    const created = automationService.add({
      name: 'Original',
      description: '',
      trigger: { kind: 'manual' },
      conditions: [],
      actions: [{ kind: 'falar', text: 'oi' }],
      isEnabled: true,
    });
    automationService.run(created.id, true);
    expect(automationService.list[0]?.runCount).toBe(1);

    const user = userEvent.setup();
    render(<AutomationEditor onClose={noop} onSaved={noop} existing={created} />);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(automationService.list).toHaveLength(1);
    const saved = automationService.list[0];
    expect(saved?.id).toBe(created.id);
    expect(saved?.runCount).toBe(1);
    expect(saved?.lastRunAt).not.toBeNull();
  });

  it('editar o nome atualiza a mesma automação, não cria outra', async () => {
    const created = automationService.add({
      name: 'Original',
      description: '',
      trigger: { kind: 'manual' },
      conditions: [],
      actions: [{ kind: 'falar', text: 'oi' }],
      isEnabled: true,
    });

    const user = userEvent.setup();
    render(<AutomationEditor onClose={noop} onSaved={noop} existing={created} />);
    const nome = screen.getByLabelText('Nome');
    await user.clear(nome);
    await user.type(nome, 'Editada');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(automationService.list).toHaveLength(1);
    expect(automationService.list[0]?.id).toBe(created.id);
    expect(automationService.list[0]?.name).toBe('Editada');
  });
});
