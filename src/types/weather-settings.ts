/**
 * Escolha do provedor de meteorologia (Peça 8, lote 2).
 *
 * Ao contrário da IA, aqui **não há segredo nenhum**: o Open-Meteo não precisa
 * de chave, e a única preferência é o nome de uma cidade. Vai para o storage
 * normal, não para o cofre — guardar uma localização como se fosse um segredo
 * seria teatro. A decisão de privacidade é a que conta: por omissão a
 * meteorologia continua simulada, e só passa a real quando a pessoa a liga.
 */

export interface WeatherSettings {
  /** Ligar o provedor real. Desligado por omissão — nada sai sem ser pedido. */
  readonly enabled: boolean;
  /** Nome da cidade, resolvido pelo geocoder do Open-Meteo. */
  readonly location: string;
}

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  enabled: false,
  // A mesma localização do simulado, para a transição não mudar o que se vê.
  location: 'Lisboa',
};
