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
    toggleWidget: (widgetId) => calls.push(`widget:${widgetId}`),
    resetWidgets: () => calls.push('reset-widgets'),
    openNotifications: () => calls.push('notificacoes'),
    openExternal: (url) => calls.push(`abrir:${url}`),
    markMailRead: (id) => calls.push(`lido:${id}`),
    setSystemState: (stateId) => calls.push(`estado:${stateId}`),
    goToDesktop: (desktop) => calls.push(`desktop:${desktop}`),
    applyLayout: (layoutId) => calls.push(`layout:${layoutId}`),
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

describe('pesquisa global no conteúdo', () => {
  const content = {
    mail: [
      {
        id: 'm1',
        from: 'Barbearia Silva',
        fromAddress: 'geral@barbeariasilva.pt',
        subject: 'Pedido de demonstração',
        preview: 'Gostaríamos de ver o sistema.',
        folder: 'inbox',
        priority: 'acao',
        receivedAt: Date.now(),
        isRead: false,
        isStarred: false,
        hasAttachments: false,
      },
    ],
    news: [
      {
        id: 'n1',
        title: 'Modelos locais aproximam-se da nuvem',
        summary: 'Testes independentes mostram diferenças menores.',
        source: 'Ciência Hoje',
        category: 'ciencia',
        publishedAt: Date.now(),
        url: 'https://exemplo.pt/a',
        isRead: false,
        isFavorite: false,
      },
    ],
    notifications: [
      {
        id: 'x1',
        title: 'Automação concluída',
        description: 'Prospecção terminada.',
        kind: 'ok',
        category: 'automacao',
        createdAt: Date.now(),
        durationMs: null,
        isRead: false,
        isDismissed: true,
        actions: [],
      },
    ],
  } as unknown as Parameters<typeof buildCommands>[0];

  const commands = buildCommands(content);

  it('sem pesquisa, o conteúdo não aparece', () => {
    // Abrir a paleta e ver cinquenta emails antes dos comandos seria inútil.
    const visible = filterCommands(commands, '');
    expect(visible.some((command) => command.group === 'Emails')).toBe(false);
    expect(visible.some((command) => command.group === 'Notícias')).toBe(false);
  });

  it('encontra um email pelo assunto', () => {
    const results = filterCommands(commands, 'demonstracao');
    expect(results.some((command) => command.id === 'mail:m1')).toBe(true);
  });

  it('encontra um email pelo remetente, que não está na etiqueta', () => {
    const results = filterCommands(commands, 'barbearia');
    expect(results.some((command) => command.id === 'mail:m1')).toBe(true);
  });

  it('encontra uma notícia pelo resumo', () => {
    const results = filterCommands(commands, 'diferencas menores');
    expect(results.some((command) => command.id === 'news:n1')).toBe(true);
  });

  it('encontra uma notificação pela descrição', () => {
    const results = filterCommands(commands, 'prospeccao');
    expect(results.some((command) => command.id === 'notif:x1')).toBe(true);
  });

  it('o conteúdo vem antes dos comandos nos resultados', () => {
    const results = filterCommands(commands, 'a');
    const firstContent = results.findIndex((command) =>
      ['Emails', 'Notícias', 'Notificações'].includes(command.group),
    );
    const firstCommand = results.findIndex((command) =>
      ['Aplicações', 'Sistema', 'Temas'].includes(command.group),
    );

    expect(firstContent).toBeGreaterThanOrEqual(0);
    expect(firstContent).toBeLessThan(firstCommand);
  });

  it('abrir uma notícia passa pelo adapter, não pelo componente', () => {
    const actions = createActions();
    commands.find((command) => command.id === 'news:n1')?.run(actions);

    expect(actions.calls).toEqual(['abrir:https://exemplo.pt/a']);
  });

  it('abrir um email marca-o como lido e abre a janela', () => {
    const actions = createActions();
    commands.find((command) => command.id === 'mail:m1')?.run(actions);

    expect(actions.calls).toEqual(['lido:m1', 'launch:emails']);
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
