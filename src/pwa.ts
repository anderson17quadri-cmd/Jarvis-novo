import { detectPlatform } from '@/platform/detect-platform';

/**
 * Registo do service worker.
 *
 * Só na versão compilada e só fora do Tauri:
 *
 * - Em desenvolvimento, um service worker serviria versões em cache do bundle
 *   e daria a impressão de que uma alteração não pegou.
 * - Dentro do Tauri não faz sentido nenhum — a aplicação já está instalada, e
 *   os ficheiros vêm do próprio pacote, não da rede.
 *
 * Falhar aqui não pode partir o arranque: sem service worker a aplicação
 * funciona toda, só não se instala nem abre sem rede.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // A deteção de plataforma vive num sítio só — não se repete o teste do
  // `__TAURI_INTERNALS__` aqui.
  if (detectPlatform() !== 'web') return;

  // Depois do `load`: registar durante o arranque disputa largura de banda com
  // o próprio bundle, e atrasa o primeiro pintar.
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
