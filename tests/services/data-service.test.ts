import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PollingDataService } from '@/services/data-service';
import { MockWeatherProvider } from '@/services/weather/providers/weather-provider';
import { MockNewsProvider } from '@/services/news/providers/news-provider';
import { MockMailProvider } from '@/services/mail/providers/mail-provider';
import { MockMusicProvider } from '@/services/music/providers/music-provider';
import { WeatherService } from '@/services/weather/weather-service';
import { NewsService } from '@/services/news/news-service';
import { MailService } from '@/services/mail/mail-service';
import { MusicService } from '@/services/music/music-service';
import { CalendarService } from '@/services/calendar/calendar-service';

/** Serviço mínimo, para exercitar a base sem depender de nenhum domínio. */
class CounterService extends PollingDataService<number> {
  fetchCount = 0;
  shouldFail = false;

  constructor(intervalMs = 10_000) {
    super({ intervalMs });
  }

  protected async fetch(): Promise<number | null> {
    this.fetchCount += 1;
    if (this.shouldFail) throw new Error('falha simulada');
    return this.fetchCount;
  }
}

describe('PollingDataService', () => {
  it('entrega o valor atual a quem subscreve depois da primeira leitura', async () => {
    const service = new CounterService();
    await service.refresh();

    const received: number[] = [];
    service.subscribe((value) => received.push(value));

    expect(received[0]).toBe(1);
  });

  it('uma leitura alimenta todos os subscritores', async () => {
    const service = new CounterService();
    const a: number[] = [];
    const b: number[] = [];

    service.subscribe((value) => a.push(value));
    service.subscribe((value) => b.push(value));
    await service.refresh();

    expect(a.at(-1)).toBe(b.at(-1));
  });

  it('pedidos simultâneos partilham a mesma leitura', async () => {
    const service = new CounterService();

    // Três widgets a montar ao mesmo tempo não podem dar três pedidos.
    const [first, second, third] = await Promise.all([
      service.refresh(),
      service.refresh(),
      service.refresh(),
    ]);

    expect(service.fetchCount).toBe(1);
    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('um erro no fetch não propaga nem apaga o último valor', async () => {
    const service = new CounterService();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await service.refresh();
    const good = service.current;

    service.shouldFail = true;
    await expect(service.refresh()).resolves.toBeNull();

    expect(service.current).toBe(good);
  });

  it('cancelar a última subscrição pára a sondagem', async () => {
    const service = new CounterService(20);
    const unsubscribe = service.subscribe(() => undefined);
    await service.refresh();

    unsubscribe();
    const afterStop = service.fetchCount;
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(service.fetchCount).toBe(afterStop);
  });

  it('suspender pára as leituras e retomar volta a ler', async () => {
    const service = new CounterService(20);
    service.subscribe(() => undefined);
    service.setPaused(true);

    const paused = service.fetchCount;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(service.fetchCount).toBe(paused);

    service.setPaused(false);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(service.fetchCount).toBeGreaterThan(paused);
  });
});

describe('provedores simulados', () => {
  it('a meteorologia devolve 7 dias e marca-se como simulada', async () => {
    const snapshot = await new MockWeatherProvider().fetch();

    expect(snapshot.forecast).toHaveLength(7);
    expect(snapshot.isSimulated).toBe(true);
    expect(snapshot.now.temperatureC).toBeGreaterThan(-30);
    expect(snapshot.now.temperatureC).toBeLessThan(50);
  });

  it('o nascer do sol vem antes do pôr do sol', async () => {
    const { now } = await new MockWeatherProvider().fetch();
    expect(now.sunrise).toBeLessThan(now.sunset);
  });

  it('as notícias vêm da mais recente para a mais antiga', async () => {
    const feed = await new MockNewsProvider().fetch();
    const dates = feed.articles.map((article) => article.publishedAt);

    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('os endereços das notícias são https, como a política exige', async () => {
    const feed = await new MockNewsProvider().fetch();
    for (const article of feed.articles) {
      expect(new URL(article.url).protocol).toBe('https:');
    }
  });

  it('marcar como lida persiste entre leituras', async () => {
    const provider = new MockNewsProvider();
    await provider.markRead('n1', true);
    const feed = await provider.fetch();

    expect(feed.articles.find((a) => a.id === 'n1')?.isRead).toBe(true);
  });

  it('o email conta por ler e a pedir ação de forma coerente', async () => {
    const snapshot = await new MockMailProvider().fetch();

    expect(snapshot.unreadCount).toBe(
      snapshot.messages.filter((message) => !message.isRead).length,
    );
    // Uma mensagem já lida foi tratada: não conta para "pede ação".
    expect(snapshot.actionCount).toBeLessThanOrEqual(snapshot.unreadCount);
  });

  it('ler um email baixa o contador de por ler', async () => {
    const provider = new MockMailProvider();
    const before = (await provider.fetch()).unreadCount;

    const unread = (await provider.fetch()).messages.find((m) => !m.isRead);
    await provider.markRead(unread!.id, true);

    expect((await provider.fetch()).unreadCount).toBe(before - 1);
  });
});

describe('MusicService', () => {
  let service: MusicService;

  beforeEach(() => {
    service = new MusicService(new MockMusicProvider());
  });

  it('começa em pausa, com uma faixa carregada', async () => {
    const state = await service.refresh();

    expect(state?.status).toBe('paused');
    expect(state?.track).not.toBeNull();
  });

  it('alternar reprodução muda o estado nos dois sentidos', async () => {
    await service.togglePlay();
    expect(service.current?.status).toBe('playing');

    await service.togglePlay();
    expect(service.current?.status).toBe('paused');
  });

  it('avançar muda de faixa e repõe a posição', async () => {
    await service.refresh();
    const first = service.current?.track?.id;

    await service.next();

    expect(service.current?.track?.id).not.toBe(first);
    expect(service.current?.positionSec).toBe(0);
  });

  it('recuar a meio da faixa volta ao início em vez de mudar de faixa', async () => {
    await service.refresh();
    await service.seek(60);
    const current = service.current?.track?.id;

    await service.previous();

    expect(service.current?.track?.id).toBe(current);
    expect(service.current?.positionSec).toBe(0);
  });

  it('o volume fica sempre entre 0 e 1', async () => {
    await service.setVolume(5);
    expect(service.current?.volume).toBe(1);

    await service.setVolume(-3);
    expect(service.current?.volume).toBe(0);
  });

  it('procurar além do fim da faixa trava na duração', async () => {
    await service.refresh();
    const duration = service.current?.track?.durationSec ?? 0;

    await service.seek(duration + 500);
    expect(service.current?.positionSec).toBeLessThanOrEqual(duration);
  });
});

describe('os serviços expõem que os dados são simulados', () => {
  it.each([
    ['meteorologia', new WeatherService()],
    ['notícias', new NewsService()],
    ['email', new MailService()],
    ['música', new MusicService()],
    ['calendário', new CalendarService()],
  ])('%s', async (_name, service) => {
    await service.refresh();
    // A interface precisa disto para o dizer ao utilizador em vez de fingir.
    expect(service.isSimulated).toBe(true);
    expect(service.providerName).toBe('Simulado');
  });
});
