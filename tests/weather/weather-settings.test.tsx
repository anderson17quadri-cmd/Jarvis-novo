import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherSettings } from '@/apps/personalization/WeatherSettings';
import { applyWeatherSettings } from '@/hooks/use-weather-settings';
import { MockWeatherProvider } from '@/services/weather/providers/weather-provider';
import { weatherService } from '@/services/weather/weather-service';
import { useWeatherSettingsStore } from '@/stores/use-weather-settings-store';
import { DEFAULT_WEATHER_SETTINGS } from '@/types/weather-settings';

const originalFetch = global.fetch;

beforeEach(() => {
  localStorage.clear();
  useWeatherSettingsStore.setState({ settings: DEFAULT_WEATHER_SETTINGS });
  weatherService.setProvider(new MockWeatherProvider('Lisboa'));

  // O OpenMeteoProvider dispara uma leitura ao ser ligado; sem rede nos testes,
  // faz-se o pedido falhar de forma controlada — a leitura cai, o serviço fica
  // com o último valor, e nada sai para a internet.
  global.fetch = vi.fn(() => Promise.reject(new Error('sem rede no teste')));
});

afterEach(() => {
  global.fetch = originalFetch;
  weatherService.setProvider(new MockWeatherProvider('Lisboa'));
});

describe('escolha do provedor', () => {
  it('por omissão fica no simulado — nada sai sem ser pedido', () => {
    applyWeatherSettings(DEFAULT_WEATHER_SETTINGS);

    expect(weatherService.providerName).toBe('Simulado');
  });

  it('ligar com cidade passa ao Open-Meteo', () => {
    applyWeatherSettings({ enabled: true, location: 'Porto' });

    expect(weatherService.providerName).toBe('Open-Meteo');
  });

  it('ligar sem cidade mantém o simulado — nunca rebenta por falta de configuração', () => {
    applyWeatherSettings({ enabled: true, location: '  ' });

    expect(weatherService.providerName).toBe('Simulado');
  });

  it('desligar volta ao simulado, mantendo a cidade', () => {
    applyWeatherSettings({ enabled: false, location: 'Porto' });

    expect(weatherService.providerName).toBe('Simulado');
  });
});

describe('a interface', () => {
  it('o interruptor liga o Open-Meteo', async () => {
    const user = userEvent.setup();
    render(<WeatherSettings />);

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(useWeatherSettingsStore.getState().settings.enabled).toBe(true);
      expect(weatherService.providerName).toBe('Open-Meteo');
    });
  });

  it('ao ligar, avisa que a cidade sai do dispositivo e para onde', async () => {
    const user = userEvent.setup();
    render(<WeatherSettings />);

    expect(screen.queryByRole('note')).toBeNull();

    await user.click(screen.getByRole('switch'));

    const note = await screen.findByRole('note');
    expect(note).toHaveTextContent(/cidade sai deste dispositivo/i);
    expect(note).toHaveTextContent('https://api.open-meteo.com');
  });
});

describe('persistência', () => {
  it('sobrevive a recarregar e o provedor volta a ser ligado', async () => {
    useWeatherSettingsStore.getState().setEnabled(true);
    useWeatherSettingsStore.getState().setLocation('Porto');
    await useWeatherSettingsStore.getState().persist();

    useWeatherSettingsStore.setState({ settings: DEFAULT_WEATHER_SETTINGS });
    await useWeatherSettingsStore.getState().hydrate();
    applyWeatherSettings(useWeatherSettingsStore.getState().settings);

    expect(useWeatherSettingsStore.getState().settings.enabled).toBe(true);
    expect(useWeatherSettingsStore.getState().settings.location).toBe('Porto');
    expect(weatherService.providerName).toBe('Open-Meteo');
  });

  it('sem nada gravado, arranca no simulado', async () => {
    await useWeatherSettingsStore.getState().hydrate();
    applyWeatherSettings(useWeatherSettingsStore.getState().settings);

    expect(useWeatherSettingsStore.getState().settings.enabled).toBe(false);
    expect(weatherService.providerName).toBe('Simulado');
  });
});
