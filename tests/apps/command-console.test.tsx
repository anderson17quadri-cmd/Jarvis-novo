import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { CommandConsole } from '@/apps/developer-center/CommandConsole';
import { setToolExecutor, type ToolExecutor } from '@/services/assistant/tool-runner';

/**
 * A consola de comandos (Parte 16 §Consola de comandos).
 *
 * O parser já se testou sozinho; isto prova que a consola liga tudo — a
 * caixa, o histórico, a confirmação — ao mesmo `runTool` que o assistente
 * usa, através de um executor falso que só regista o que lhe chega.
 */

function makeExecutor(): ToolExecutor & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    openWindow: (app) => void calls.push(`abrir:${app}`),
    closeWindow: (app) => void calls.push(`fechar:${app}`),
    closeAllWindows: () => void calls.push('fechar-tudo'),
    setTheme: (theme) => void calls.push(`tema:${theme}`),
    setWallpaper: (wallpaper) => void calls.push(`papel:${wallpaper}`),
    setSystemState: (state) => void calls.push(`estado:${state}`),
    setWidgetVisible: (widget, show) => void calls.push(`widget:${widget}:${show ? 'on' : 'off'}`),
    goToDesktop: (desktop) => void calls.push(`desktop:${desktop}`),
    applyLayout: (layout) => {
      calls.push(`layout:${layout}`);
      return layout !== 'inexistente';
    },
    saveLayout: (name) => void calls.push(`guardar-layout:${name}`),
    createTask: (title, priority) => void calls.push(`tarefa:${title}:${priority}`),
    completeTask: (title) => {
      calls.push(`concluir:${title}`);
      return title !== 'inexistente';
    },
    clearDoneTasks: () => {
      calls.push('limpar-concluidas');
      return 3;
    },
    notify: (title) => void calls.push(`notificar:${title}`),
    search: (query) => void calls.push(`procurar:${query}`),
    searchFiles: (query) => {
      calls.push(`procurar-ficheiro:${query}`);
      return query === 'inexistente' ? [] : [{ name: query, pathNames: [] }];
    },
    openFileLocation: (query) => {
      calls.push(`abrir-ficheiro:${query}`);
      return query !== 'inexistente';
    },
    searchNotes: async (query) => {
      calls.push(`procurar-nota:${query}`);
      return query === 'inexistente' ? [] : [{ title: query, path: `${query}.md` }];
    },
    readNote: async (query) => {
      calls.push(`ler-nota:${query}`);
      return query === 'inexistente' ? null : `conteúdo de ${query}`;
    },
    writeNote: async (title, content) => {
      calls.push(`guardar-nota:${title}:${content}`);
      return title !== 'falha';
    },
    searchWeb: async (query) => {
      calls.push(`pesquisar-web:${query}`);
      return { isSimulated: false, results: [] };
    },
    openWebPage: async (url) => {
      calls.push(`abrir-pagina:${url}`);
      return `conteúdo de ${url}`;
    },
    openExternalUrl: async (url) => {
      calls.push(`abrir-navegador:${url}`);
      return `navegador aberto em ${url}`;
    },
    openPath: (path) => {
      calls.push(`abrir-aplicacao:${path}`);
      return `pedido:${path}`;
    },
    moveMouse: (x, y) => {
      calls.push(`mover-rato:${x},${y}`);
      return `pedido:${x},${y}`;
    },
    clickAt: (x, y) => {
      calls.push(`clicar:${x},${y}`);
      return `pedido:${x},${y}`;
    },
    typeText: (text) => {
      calls.push(`escrever:${text}`);
      return `pedido:${text}`;
    },
    seeScreen: async () => {
      calls.push('ver-ecra');
      return 'ecrã descrito';
    },
    music: (action) => void calls.push(`musica:${action}`),
    speak: (text) => void calls.push(`falar:${text}`),
    setAutomationEnabled: (name, enabled) => {
      calls.push(`automacao:${name}:${enabled ? 'on' : 'off'}`);
      return name !== 'inexistente';
    },
    runAutomation: (name) => {
      calls.push(`correr:${name}`);
      return name !== 'inexistente';
    },
    clearConversations: () => void calls.push('apagar-conversas'),
    forgetMemory: () => void calls.push('esquecer'),
    resetWidgets: () => void calls.push('repor-widgets'),
  };
}

let executor: ReturnType<typeof makeExecutor>;

beforeEach(() => {
  executor = makeExecutor();
  setToolExecutor(executor);
});

function type(text: string): void {
  const input = screen.getByLabelText('Comando');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('a consola', () => {
  it('começa vazia, com a dica de como se usa', () => {
    render(<CommandConsole />);
    expect(screen.getByText(/Escreva um comando/)).toBeInTheDocument();
  });

  it('uma ferramenta livre corre de imediato, e chega ao executor', () => {
    render(<CommandConsole />);
    type('abrir_janela app=emails');

    expect(executor.calls).toEqual(['abrir:emails']);
    expect(screen.getByText('abrir_janela app=emails')).toBeInTheDocument();
  });

  it('limpa a caixa depois de correr', () => {
    render(<CommandConsole />);
    type('fechar_todas_as_janelas');

    expect(screen.getByLabelText('Comando')).toHaveValue('');
  });

  it('um erro de sintaxe fica na consola, e não chega ao executor', () => {
    render(<CommandConsole />);
    type('abrir_janela sem_igual');

    expect(executor.calls).toEqual([]);
    expect(screen.getByText(/Argumento inválido/)).toBeInTheDocument();
  });

  it('uma ferramenta desconhecida diz que não a conhece', () => {
    render(<CommandConsole />);
    type('apagar_tudo');

    expect(executor.calls).toEqual([]);
    expect(screen.getByText(/Não conheço a ferramenta "apagar_tudo"/)).toBeInTheDocument();
  });

  it('uma destrutiva pede confirmação, e não corre sozinha', async () => {
    render(<CommandConsole />);
    type('apagar_conversas');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog', { name: 'Confirmar ação' })).toBeInTheDocument();
    });
    expect(executor.calls).toEqual([]);
  });

  it('confirmar corre a ferramenta, e a caixa de confirmação desaparece', async () => {
    render(<CommandConsole />);
    type('apagar_conversas');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog', { name: 'Confirmar ação' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Sim, fazer' }));

    await waitFor(() => {
      expect(executor.calls).toEqual(['apagar-conversas']);
    });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('recusar não corre nada, e some da consola', async () => {
    render(<CommandConsole />);
    type('apagar_conversas');

    await waitFor(() => {
      expect(screen.getByRole('alertdialog', { name: 'Confirmar ação' })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Não' }));

    expect(executor.calls).toEqual([]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Cancelado.')).toBeInTheDocument();
  });

  it('"ajuda" lista o catálogo, sem tocar no executor', () => {
    render(<CommandConsole />);
    type('ajuda');

    expect(executor.calls).toEqual([]);
    expect(screen.getByText(/Sintaxe: ferramenta chave=valor/)).toBeInTheDocument();
    expect(screen.getByText(/abrir_janela.*—/)).toBeInTheDocument();
  });

  it('"ajuda <ferramenta>" detalha os parâmetros dessa ferramenta', () => {
    render(<CommandConsole />);
    type('ajuda criar_tarefa');

    expect(screen.getByText(/criar_tarefa — Cria uma tarefa/)).toBeInTheDocument();
    expect(screen.getByText(/Parâmetros: titulo/)).toBeInTheDocument();
  });

  it('"limpar" esvazia o histórico', async () => {
    render(<CommandConsole />);
    type('fechar_todas_as_janelas');
    await waitFor(() => {
      expect(screen.getByText('fechar_todas_as_janelas')).toBeInTheDocument();
    });

    type('limpar');

    expect(screen.queryByText('fechar_todas_as_janelas')).toBeNull();
    expect(screen.getByText(/Escreva um comando/)).toBeInTheDocument();
  });

  it('seta para cima traz o último comando de volta à caixa', async () => {
    render(<CommandConsole />);
    type('abrir_janela app=emails');
    await waitFor(() => {
      expect(executor.calls).toEqual(['abrir:emails']);
    });

    fireEvent.keyDown(screen.getByLabelText('Comando'), { key: 'ArrowUp' });

    expect(screen.getByLabelText('Comando')).toHaveValue('abrir_janela app=emails');
  });

  it('uma linha em branco não faz nada', () => {
    render(<CommandConsole />);
    type('   ');

    expect(executor.calls).toEqual([]);
    expect(screen.getByText(/Escreva um comando/)).toBeInTheDocument();
  });
});
