import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mapWmoCode,
  OpenMeteoProvider,
} from '@/services/weather/providers/open-meteo-provider';
import type { WeatherCondition } from '@/types/weather';

/** Resposta do geocoder para "Porto". */
function geoResponse() {
  return new Response(
    JSON.stringify({
      results: [
        { name: 'Porto', country: 'Portugal', latitude: 41.1496, longitude: -8.611 },
      ],
    }),
    { status: 200 },
  );
}

/** Resposta da previsão com 7 dias. */
function forecastResponse() {
  return new Response(
    JSON.stringify({
      current: {
        temperature_2m: 18.4,
        relative_humidity_2m: 71,
        apparent_temperature: 17.9,
        weather_code: 3,
        wind_speed_10m: 12.3,
        surface_pressure: 1012.4,
      },
      daily: {
        time: ['2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19'],
        weather_code: [3, 61, 0, 2, 95, 45, 71],
        temperature_2m_max: [24, 22, 26, 27, 25, 20, 18],
        temperature_2m_min: [15, 14, 16, 17, 16, 12, 10],
        sunrise: ['2026-08-13T06:45', '2026-08-14T06:46', '2026-08-15T06:47', '2026-08-16T06:48', '2026-08-17T06:49', '2026-08-18T06:50', '2026-08-19T06:51'],
        sunset: ['2026-08-13T20:30', '2026-08-14T20:28', '2026-08-15T20:27', '2026-08-16T20:25', '2026-08-17T20:24', '2026-08-18T20:22', '2026-08-19T20:21'],
        precipitation_probability_max: [10, 80, 0, 20, 60, 5, 40],
      },
    }),
    { status: 200 },
  );
}

/** O `fetch` pode receber string, URL ou Request — devolve a URL em qualquer caso. */
function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

/** O mesmo mock que os testes de voz usam: geocoder e previsão a responder. */
function mockFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = urlDe(input);
    if (url.includes('/v1/search')) return Promise.resolve(geoResponse());
    if (url.includes('/v1/forecast')) return Promise.resolve(forecastResponse());
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
}

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = mockFetch();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('mapWmoCode', () => {
  const casos: readonly [number, WeatherCondition][] = [
    [0, 'clear'],
    [1, 'partly-cloudy'],
    [2, 'partly-cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [48, 'fog'],
    [51, 'drizzle'],
    [57, 'drizzle'],
    [61, 'rain'],
    [67, 'rain'],
    [71, 'snow'],
    [77, 'snow'],
    [80, 'rain'],
    [82, 'rain'],
    [85, 'snow'],
    [95, 'thunderstorm'],
    [99, 'thunderstorm'],
  ];

  it.each(casos)('código WMO %i → %s', (code, condition) => {
    expect(mapWmoCode(code)).toBe(condition);
  });

  it('códigos raros caem no nublado em vez de falhar', () => {
    expect(mapWmoCode(7)).toBe('cloudy');
  });
});

describe('OpenMeteoProvider', () => {
  it('sem cidade, não está configurado', () => {
    expect(new OpenMeteoProvider('').isConfigured()).toBe(false);
    expect(new OpenMeteoProvider('   ').isConfigured()).toBe(false);
  });

  it('com cidade, está configurado', () => {
    expect(new OpenMeteoProvider('Porto').isConfigured()).toBe(true);
  });

  it('resolve a cidade e devolve a previsão a 7 dias como real', async () => {
    const snapshot = await new OpenMeteoProvider('Porto').fetch();

    expect(snapshot).not.toBeNull();
    expect(snapshot!.location).toBe('Porto, Portugal');
    expect(snapshot!.isSimulated).toBe(false);
    expect(snapshot!.forecast).toHaveLength(7);
  });

  it('mapeia o estado atual para os campos da interface', async () => {
    const snapshot = await new OpenMeteoProvider('Porto').fetch();

    expect(snapshot!.now.condition).toBe('cloudy');
    expect(snapshot!.now.temperatureC).toBe(18.4);
    expect(snapshot!.now.feelsLikeC).toBe(17.9);
    expect(snapshot!.now.humidityPercent).toBe(71);
    expect(snapshot!.now.windKph).toBe(12.3);
    expect(snapshot!.now.pressureHpa).toBe(1012.4);
    expect(snapshot!.now.sunrise).toBeLessThan(snapshot!.now.sunset);
  });

  it('a previsão mantém os mínimos, máximos e chuva por dia', async () => {
    const snapshot = await new OpenMeteoProvider('Porto').fetch();
    const primeiro = snapshot!.forecast[0]!;

    expect(primeiro.minC).toBe(15);
    expect(primeiro.maxC).toBe(24);
    expect(primeiro.precipitationChance).toBe(10);
    expect(snapshot!.forecast[1]!.condition).toBe('rain');
  });

  it('pede as coordenadas resolvidas ao geocoder', async () => {
    const urls: string[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = urlDe(input);
      urls.push(url);
      if (url.includes('/v1/search')) return Promise.resolve(geoResponse());
      if (url.includes('/v1/forecast')) return Promise.resolve(forecastResponse());
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    await new OpenMeteoProvider('Porto').fetch();

    const geoUrl = urls.find((url) => url.includes('/v1/search'));
    expect(geoUrl).toContain('name=Porto');
    expect(geoUrl).toContain('count=1');

    const forecastUrl = urls.find((url) => url.includes('/v1/forecast'));
    expect(forecastUrl).toContain('latitude=41.1496');
    expect(forecastUrl).toContain('longitude=-8.611');
    expect(forecastUrl).toContain('forecast_days=7');
  });

  it('sem resultado no geocoder, devolve null', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 })),
    );

    await expect(new OpenMeteoProvider('Atlântida').fetch()).resolves.toBeNull();
  });

  it('um erro do servidor propaga-se, em vez de inventar dados', async () => {
    global.fetch = vi.fn(() => Promise.resolve(new Response('erro', { status: 500 })));

    await expect(new OpenMeteoProvider('Porto').fetch()).rejects.toThrow();
  });
});
