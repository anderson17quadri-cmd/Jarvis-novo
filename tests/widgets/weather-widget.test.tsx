import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import WeatherWidget from '@/widgets/weather/WeatherWidget';
import { weatherService } from '@/services/weather/weather-service';
import { MockWeatherProvider, type WeatherProvider } from '@/services/weather/providers/weather-provider';
import { useWeatherStore } from '@/stores/use-weather-store';

/** Provedor que falha sempre — para provar o caminho de erro sem mexer em rede. */
class FailingWeatherProvider implements WeatherProvider {
  readonly id = 'failing';
  readonly name = 'Falha';
  isConfigured(): boolean {
    return true;
  }
  fetch(): Promise<never> {
    return Promise.reject(new Error('sem rede'));
  }
}

beforeEach(() => {
  useWeatherStore.setState({ snapshot: null, isLoading: true, error: null });
});

afterEach(() => {
  weatherService.setProvider(new MockWeatherProvider());
});

describe('widget de Clima — erro de rede não fica em silêncio', () => {
  it('sem nenhuma leitura boa ainda, uma falha mostra o estado de erro com "tentar novamente"', async () => {
    weatherService.setProvider(new FailingWeatherProvider());

    render(<WeatherWidget />);

    expect(await screen.findByText('Não consegui obter o clima.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('com dados antigos já mostrados, uma falha seguinte avisa mas não esconde os dados', async () => {
    weatherService.setProvider(new MockWeatherProvider());
    render(<WeatherWidget />);

    // Espera a primeira leitura boa (simulada) aparecer.
    await screen.findByText('Dados simulados');

    weatherService.setProvider(new FailingWeatherProvider());
    await useWeatherStore.getState().refresh();

    expect(await screen.findByText('Não consegui atualizar — a mostrar os últimos dados.')).toBeInTheDocument();
    // Os dados antigos continuam visíveis — não é substituído pelo ecrã de erro.
    expect(screen.getByText('Dados simulados')).toBeInTheDocument();
  });
});
