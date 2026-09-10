/**
 * Normalização de texto para pesquisa.
 *
 * Tira acentos e caixa, para "personalizacao" encontrar "Personalização" e
 * "notificacoes" encontrar "Notificações". Sem isto, quem escreve depressa —
 * ou num teclado de telemóvel sem acentos — não encontra nada.
 *
 * Vive aqui porque a Command Palette, o painel de notificações e a loja de
 * plugins pesquisam todos da mesma maneira; três cópias divergiriam.
 */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
