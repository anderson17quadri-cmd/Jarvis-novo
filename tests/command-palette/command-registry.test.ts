import { describe, expect, it, vi } from 'vitest';

import { buildCommands, filterCommands, type CommandActions } from '@/components/command-palette/command-registry';
import { ALL_APPS } from '@/apps/registry';
import { THEMES } from '@/design-system/tokens';

function createActions(): CommandActions & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    launchApp: (appId) => calls.push(`launch:${appId}`),
    setTheme: (theme) => calls.push(`theme:${theme}`),
    toggleMicrophone: () => calls.push('mic'),
    restartBootSequence: () => calls.push('reboot'),
  };
}

describe('a paleta deriva os comandos dos registos', () => {
  const commands = buildCommands();

  it('inclui uma entrada por aplicação registada', () => {
    for (const app of ALL_APPS) {
      expect(commands.some((command) => command.id === `app:${app.id}`)).toBe(true);
    }
  });

  it('inclui uma entrada por tema', () => {
    for (const theme of THEMES) {
      expect(commands.some((command) => command.id === `theme:${theme.id}`)).toBe(true);
    }
  });

  it('agrupa sem intercalar, para os cabeçalhos não se repetirem', () => {
    const seen = new Set<string>();
    let previous = '';

    for (const command of commands) {
      if (command.group !== previous) {
        expect(seen.has(command.group), `grupo "${command.group}" aparece duas vezes`).toBe(false);
        seen.add(command.group);
        previous = command.group;
      }
    }
  });

  it('marca as janelas ainda não implementadas', () => {
    const pending = commands.find((command) => command.id === 'app:browser');
    expect(pending?.hint).toBe('Fase 2');
  });
});

describe('filtragem', () => {
  const commands = buildCommands();

  it('encontra sem acentos', () => {
    const results = filterCommands(commands, 'personalizacao');
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe('app:themes');
  });

  it('ignora maiúsculas e espaços à volta', () => {
    expect(filterCommands(commands, '  EMERALD ')[0]?.id).toBe('theme:emerald');
  });

  it('devolve tudo com a pesquisa vazia', () => {
    expect(filterCommands(commands, '')).toHaveLength(commands.length);
  });

  it('devolve vazio quando nada corresponde', () => {
    expect(filterCommands(commands, 'zzzzzzz')).toHaveLength(0);
  });

  it('procura também pelo nome do grupo', () => {
    expect(filterCommands(commands, 'temas').length).toBe(THEMES.length);
  });
});

describe('execução', () => {
  const commands = buildCommands();

  it('cada comando chama a ação certa', () => {
    const actions = createActions();

    commands.find((c) => c.id === 'app:assistant')?.run(actions);
    commands.find((c) => c.id === 'theme:solar')?.run(actions);
    commands.find((c) => c.id === 'system:microphone')?.run(actions);

    expect(actions.calls).toEqual(['launch:assistant', 'theme:solar', 'mic']);
  });

  it('nenhum comando executa nada só por ser construído', () => {
    const actions = createActions();
    const spy = vi.spyOn(actions, 'launchApp');
    buildCommands();
    expect(spy).not.toHaveBeenCalled();
  });
});
