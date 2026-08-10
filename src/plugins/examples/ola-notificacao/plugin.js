// Plugin de exemplo — "Olá, notificação".
//
// Corre dentro de um <iframe sandbox="allow-scripts"> (sem allow-same-origin),
// por isso não tem acesso a `window.parent` a não ser por postMessage, não lê
// cookies nem localStorage do Core, e não navega a página de fora. A única
// forma de pedir seja o que for ao sistema é mandar uma mensagem e esperar.
//
// Fica à espera de 'core.run' (o botão "Pedir notificação" na Loja de
// plugins) em vez de disparar sozinho ao carregar — assim o mesmo plugin
// corre várias vezes na mesma sessão, para testar a recusar e a permitir sem
// recarregar o iframe.
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  parent.postMessage(
    {
      type: 'core.notify',
      requestId: `ola-notificacao-${Date.now()}`,
      payload: {
        titulo: 'Olá do plugin',
        corpo: 'Isto foi pedido de dentro da sandbox, sem acesso direto ao Core.',
      },
    },
    '*',
  );
});
