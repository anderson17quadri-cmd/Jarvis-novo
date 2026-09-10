import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AiWidget from '@/widgets/ai/AiWidget';
import CalendarWidget from '@/widgets/calendar/CalendarWidget';
import TasksWidget from '@/widgets/tasks/TasksWidget';
import { memoryService } from '@/services/assistant/memory-service';
import { useAssistantStore } from '@/stores/use-assistant-store';
import { useTaskStore } from '@/stores/use-task-store';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

/** Põe o relógio do sistema numa hora conhecida. */
function setNow(hours: number, minutes = 0): void {
  vi.setSystemTime(new Date(2026, 6, 28, hours, minutes));
}

describe('widget de Calendário', () => {
  it('diz o que está a decorrer', async () => {
    setNow(10, 30);
    render(<CalendarWidget />);

    expect(await screen.findByText('Reunião de projeto')).toBeInTheDocument();
    expect(screen.getByText('a decorrer agora')).toBeInTheDocument();
  });

  it('fora de um compromisso, conta o que falta para o próximo', async () => {
    setNow(9, 20);
    render(<CalendarWidget />);

    expect(await screen.findByText('40m')).toBeInTheDocument();
    expect(screen.getByText(/até Reunião de projeto/)).toBeInTheDocument();
  });

  it('mais de uma hora aparece em horas e minutos', async () => {
    setNow(7, 45);
    render(<CalendarWidget />);

    expect(await screen.findByText('2h 15m')).toBeInTheDocument();
  });

  it('depois do último compromisso diz que o dia está feito', async () => {
    setNow(22);
    render(<CalendarWidget />);

    expect(await screen.findByText('O dia está feito')).toBeInTheDocument();
  });

  it('assume que a agenda é simulada, em vez de a fazer passar por real', async () => {
    setNow(12);
    render(<CalendarWidget />);

    expect(await screen.findByText('Agenda simulada')).toBeInTheDocument();
  });
});

describe('widget de Tarefas', () => {
  it('conta as que faltam', async () => {
    render(<TasksWidget />);

    await waitFor(() => {
      expect(useTaskStore.getState().isHydrated).toBe(true);
    });

    const pending = useTaskStore.getState().tasks.filter((task) => !task.isDone).length;
    expect(await screen.findByText(String(pending))).toBeInTheDocument();
    expect(screen.getByText('por fazer')).toBeInTheDocument();
  });

  it('hidrata sozinho — a janela pode nunca ter sido aberta', async () => {
    useTaskStore.setState({ tasks: [], isHydrated: false });
    render(<TasksWidget />);

    await waitFor(() => {
      expect(useTaskStore.getState().tasks.length).toBeGreaterThan(0);
    });
  });

  it('concluir aqui conclui no mesmo sítio que a janela', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<TasksWidget />);

    await waitFor(() => {
      expect(useTaskStore.getState().isHydrated).toBe(true);
    });

    const [first] = useTaskStore.getState().tasks.filter((task) => !task.isDone);
    expect(first).toBeDefined();

    await user.click(await screen.findByLabelText(`Concluir: ${first!.title}`));

    expect(useTaskStore.getState().tasks.find((task) => task.id === first!.id)?.isDone).toBe(true);
  });

  it('as atrasadas vêm à frente das que só têm prioridade alta', async () => {
    useTaskStore.setState({
      isHydrated: true,
      tasks: [
        {
          id: 'urgente',
          title: 'Prioridade alta sem prazo',
          priority: 'alta',
          dueAt: null,
          tags: [],
          subtasks: [],
          isDone: false,
          createdAt: 0,
          attachments: [],
        },
        {
          id: 'atrasada',
          title: 'Prazo que já passou',
          priority: 'baixa',
          dueAt: Date.now() - 86_400_000,
          tags: [],
          subtasks: [],
          isDone: false,
          createdAt: 0,
          attachments: [],
        },
      ],
    });

    render(<TasksWidget />);

    const items = await screen.findAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Prazo que já passou');
    expect(screen.getByText('atrasada')).toBeInTheDocument();
  });

  it('com tudo feito, diz isso em vez de mostrar uma lista vazia', async () => {
    useTaskStore.setState({
      isHydrated: true,
      tasks: [
        {
          id: 'feita',
          title: 'Já está',
          priority: 'baixa',
          dueAt: null,
          tags: [],
          subtasks: [],
          isDone: true,
          createdAt: 0,
          attachments: [],
        },
      ],
    });

    render(<TasksWidget />);
    expect(await screen.findByText('Está tudo feito.')).toBeInTheDocument();
  });
});

describe('widget de IA', () => {
  beforeEach(() => {
    memoryService.clear();
    useAssistantStore.getState().reset();
    useAssistantStore.setState({ mode: 'idle' });
  });

  it('mostra o estado do assistente', async () => {
    render(<AiWidget />);
    expect(await screen.findByText('Em espera')).toBeInTheDocument();
  });

  it('acompanha a mudança de estado', async () => {
    render(<AiWidget />);
    useAssistantStore.setState({ mode: 'thinking' });

    expect(await screen.findByText('A analisar')).toBeInTheDocument();
  });

  it('diz qual é o provedor ligado, e que não há modelo de linguagem', async () => {
    render(<AiWidget />);

    expect(await screen.findByText('Contexto local')).toBeInTheDocument();
    expect(screen.getByText('Sem modelo de linguagem ligado')).toBeInTheDocument();
  });

  it('lista os últimos pedidos vindos da memória', async () => {
    memoryService.observe('abre os emails');
    render(<AiWidget />);

    expect(await screen.findByText('abre os emails')).toBeInTheDocument();
  });

  it('sem pedidos nenhuns, explica como aparecem', async () => {
    render(<AiWidget />);
    expect(await screen.findByText(/Ainda não pediu nada/)).toBeInTheDocument();
  });
});
