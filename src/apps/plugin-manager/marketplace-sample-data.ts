import type { PluginCategory } from './plugin-catalog';

/**
 * Esboço do Marketplace — dados de exemplo, escritos à mão.
 *
 * Nada aqui vem de lado nenhum: não há pedido de rede, não há registo
 * remoto, não há autores a sério por trás destes nomes. É só a interface
 * de como um catálogo de terceiros poderia aparecer, para haver algo
 * concreto a discutir antes de decidir ligar a uma fonte real — ver
 * `docs/spec/plugins-marketplace.md` para o que falta decidir primeiro.
 */

export type MarketplacePricing = 'gratuito' | 'pago';

export interface MarketplaceListing {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly author: string;
  readonly category: PluginCategory;
  readonly downloads: number;
  readonly rating: number;
  readonly pricing: MarketplacePricing;
  /** Texto livre — "há 3 dias", "há 2 meses". Exemplo, não uma data real. */
  readonly publishedAgo: string;
}

export const MARKETPLACE_LISTINGS: readonly MarketplaceListing[] = [
  {
    id: 'clima-avancado',
    name: 'Clima Avançado',
    tagline: 'Radar de precipitação e alertas de tempo severo.',
    author: 'Estúdio Vento Norte',
    category: 'produtividade',
    downloads: 41_200,
    rating: 4.6,
    pricing: 'gratuito',
    publishedAgo: 'há 3 semanas',
  },
  {
    id: 'notion-sync',
    name: 'Notion Sync',
    tagline: 'Espelha páginas do Notion nas Notas do sistema.',
    author: 'Comunidade',
    category: 'integracao',
    downloads: 15_780,
    rating: 4.1,
    pricing: 'gratuito',
    publishedAgo: 'há 2 meses',
  },
  {
    id: 'kanban-pro',
    name: 'Kanban Pro',
    tagline: 'Quadros com colunas e arrastar-e-largar para Projetos.',
    author: 'Nortelabs',
    category: 'produtividade',
    downloads: 9_340,
    rating: 4.4,
    pricing: 'pago',
    publishedAgo: 'há 5 dias',
  },
  {
    id: 'gpt-resumo',
    name: 'Resumo IA de Reuniões',
    tagline: 'Transcreve e resume chamadas do Navegador.',
    author: 'Comunidade',
    category: 'ia',
    downloads: 27_650,
    rating: 4.3,
    pricing: 'pago',
    publishedAgo: 'há 1 mês',
  },
  {
    id: 'tema-retro',
    name: 'Tema Retro Terminal',
    tagline: 'Verde fósforo, fonte monoespaçada, scanlines opcionais.',
    author: 'pixelforge',
    category: 'desenvolvimento',
    downloads: 6_020,
    rating: 4.8,
    pricing: 'gratuito',
    publishedAgo: 'há 4 dias',
  },
  {
    id: 'podcasts',
    name: 'Podcasts',
    tagline: 'Subscrições e reprodução dentro do widget de Música.',
    author: 'Comunidade',
    category: 'media',
    downloads: 18_910,
    rating: 4.0,
    pricing: 'gratuito',
    publishedAgo: 'há 6 meses',
  },
];
