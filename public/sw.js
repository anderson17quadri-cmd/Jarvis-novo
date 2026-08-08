/**
 * Service worker do JARVIS AI OS.
 *
 * Mínimo por decisão. Faz duas coisas:
 *
 * 1. Existe e responde a `fetch` — sem isso o browser não oferece "Adicionar
 *    ao ecrã principal", por muito correto que o manifesto esteja.
 * 2. Guarda o casco da aplicação, para abrir sem rede depois da primeira
 *    visita.
 *
 * O que **não** faz: cache de dados, sincronização em segundo plano, notificações
 * push, estratégias por rota. Isso entra quando houver dados reais para
 * guardar — hoje tudo o que a aplicação mostra é simulado no cliente, e uma
 * cache sofisticada só serviria para servir versões velhas do bundle.
 *
 * Estratégia: rede primeiro, cache como rede de segurança. Ao contrário de
 * cache-primeiro, isto nunca deixa o utilizador preso a uma versão antiga —
 * o custo é uma ida à rede quando ela existe, que é o caso normal.
 */

/** Mudar a versão invalida tudo o que ficou para trás. */
const CACHE = 'jarvis-v3';

/** O suficiente para o primeiro pintar. O resto entra à medida que é pedido. */
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon-192.png',
  // As fontes entram no casco: sem elas, a primeira abertura offline mostrava
  // o sistema inteiro numa fonte de sistema. As três famílias, não só a
  // predefinida — trocar de fonte é uma preferência que pode já estar
  // guardada antes da primeira visita offline.
  '/fonts/inter-latin.woff2',
  '/fonts/inter-latin-ext.woff2',
  '/fonts/space-grotesk-latin.woff2',
  '/fonts/space-grotesk-latin-ext.woff2',
  '/fonts/plex-sans-latin.woff2',
  '/fonts/plex-sans-latin-ext.woff2',
];

self.addEventListener('install', (event) => {
  // `addAll` falha inteiro se um recurso falhar; daí o `catch`. Um casco
  // incompleto é melhor do que uma instalação recusada.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Só GET, e só o que é nosso. Um POST não se guarda, e um pedido para outro
  // domínio não é da nossa conta.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Só o que veio bem da rede entra na cache. Guardar um 404 fá-lo-ia
        // sobreviver ao próprio erro.
        if (response.ok) {
          const copy = response.clone();
          void caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Navegação sem rede e sem cache do URL exato: devolve-se o casco, que
        // é uma aplicação de página única — o router trata do resto.
        if (request.mode === 'navigate') {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }

        return Response.error();
      }),
  );
});
