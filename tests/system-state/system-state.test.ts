import { beforeEach, describe, expect, it } from 'vitest';

import { pickParticleCount, PARTICLE_COUNTS } from '@/components/ai-core/particle-field';
import { notificationService } from '@/services/notification-service';
import { systemService, DEFAULT_POLL_INTERVAL_MS } from '@/services/system-service';
import { useNotificationStore } from '@/stores/use-notification-store';
import { useSystemStateStore } from '@/stores/use-system-state-store';
import { allowsToast, SYSTEM_STATES } from '@/types/system-state';

beforeEach(async () => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [] });
  useSystemStateStore.getState().set('normal');
});

describe('definições dos estados', () => {
  it('em Apresentação nada interrompe, nem os erros', () => {
    for (const kind of ['info', 'ok', 'warn', 'err']) {
      expect(allowsToast(SYSTEM_STATES.apresentacao, kind)).toBe(false);
    }
  });

  it('em Foco e Economia só passa o que for grave', () => {
    for (const state of [SYSTEM_STATES.foco, SYSTEM_STATES.economia]) {
      expect(allowsToast(state, 'info')).toBe(false);
      expect(allowsToast(state, 'ok')).toBe(false);
      expect(allowsToast(state, 'warn')).toBe(true);
      expect(allowsToast(state, 'err')).toBe(true);
    }
  });

  it('em Normal passa tudo', () => {
    for (const kind of ['info', 'ok', 'warn', 'err']) {
      expect(allowsToast(SYSTEM_STATES.normal, kind)).toBe(true);
    }
  });
});

describe('o estado aplica-se mesmo', () => {
  it('muda o ritmo da sondagem de métricas', () => {
    useSystemStateStore.getState().set('economia');
    expect(systemService.pollIntervalMs).toBe(SYSTEM_STATES.economia.metricsIntervalMs);

    useSystemStateStore.getState().set('performance');
    expect(systemService.pollIntervalMs).toBe(1_000);

    useSystemStateStore.getState().set('normal');
    expect(systemService.pollIntervalMs).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  it('marca o `<html>`, e o normal não deixa marca nenhuma', () => {
    useSystemStateStore.getState().set('foco');
    expect(document.documentElement.dataset['systemState']).toBe('foco');

    useSystemStateStore.getState().set('normal');
    expect(document.documentElement.dataset['systemState']).toBeUndefined();
  });

  it('a escolha sobrevive a recarregar', async () => {
    useSystemStateStore.getState().set('apresentacao');
    await useSystemStateStore.getState().persist();

    useSystemStateStore.getState().set('normal');
    await useSystemStateStore.getState().hydrate();

    expect(useSystemStateStore.getState().current).toBe('apresentacao');
  });

  it('um estado guardado que já não exista cai no normal', async () => {
    localStorage.setItem('jarvis.system-state', JSON.stringify('modo-que-nao-existe'));
    await useSystemStateStore.getState().hydrate();

    expect(useSystemStateStore.getState().current).toBe('normal');
  });
});

describe('avisos silenciados continuam a existir', () => {
  it('em Apresentação, a notificação entra no painel mas não no ecrã', () => {
    useSystemStateStore.getState().set('apresentacao');
    notificationService.info('Silenciosa', 'Não deve interromper.');

    const [notification] = useNotificationStore.getState().notifications;
    expect(notification?.title).toBe('Silenciosa');
    // Continua no histórico — o que se corta é a interrupção, não a informação.
    expect(notification?.isDismissed).toBe(true);
  });

  it('em Foco, um erro passa e uma informação não', () => {
    useSystemStateStore.getState().set('foco');

    notificationService.info('Informação', 'Pode esperar.');
    notificationService.error('Falha', 'Não pode esperar.');

    const byTitle = new Map(
      useNotificationStore.getState().notifications.map((item) => [item.title, item]),
    );

    expect(byTitle.get('Informação')?.isDismissed).toBe(true);
    expect(byTitle.get('Falha')?.isDismissed).toBe(false);
  });

  it('em Normal, tudo aparece', () => {
    notificationService.info('Visível', 'Aparece.');
    expect(useNotificationStore.getState().notifications[0]?.isDismissed).toBe(false);
  });
});

describe('partículas do núcleo', () => {
  it('a escala do estado reduz a contagem', () => {
    const normal = pickParticleCount(1_500, false, 1);
    const economia = pickParticleCount(1_500, false, SYSTEM_STATES.economia.particleScale);

    expect(economia).toBeLessThan(normal);
  });

  it('nunca desce abaixo do mínimo — um núcleo vazio parece avariado', () => {
    expect(pickParticleCount(400, false, 0)).toBe(PARTICLE_COUNTS.reduced);
    expect(pickParticleCount(1_500, false, 0.001)).toBe(PARTICLE_COUNTS.reduced);
  });

  it('a preferência de movimento manda sobre o estado', () => {
    // Quem pediu menos movimento não recupera partículas por estar em
    // Performance.
    expect(pickParticleCount(1_500, true, 1)).toBe(PARTICLE_COUNTS.reduced);
  });
});
