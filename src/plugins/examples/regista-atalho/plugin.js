// Plugin de exemplo — "Regista atalho".
//
// Nona prova da sandbox: regista Ctrl+Shift+H para mostrar uma notificação,
// usando `core.shortcut.register`. A permissão `shortcuts` controla se o
// registo é aceite; o Core valida que o atalho não colide com os do sistema.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins)
// em vez de disparar sozinho ao carregar.
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    await window.core.shortcut.register(
      'mostrar-hora',
      'h',
      { ctrlOrMeta: true, shift: true, alt: false },
      function () {
        parent.postMessage(
          {
            type: 'core.notify',
            requestId: 'atalho-hora-' + Date.now(),
            payload: {
              titulo: 'Atalho premido',
              corpo: 'Ctrl+Shift+H foi premido às ' + new Date().toLocaleTimeString() + '.',
            },
          },
          '*',
        );
      },
    );

    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'atalho-registo-' + Date.now(),
        payload: {
          titulo: 'Regista atalho',
          corpo: 'Atalho Ctrl+Shift+H registado — prime-o para ver esta notificação.',
        },
      },
      '*',
    );
  } catch (e) {
    // Se a permissão 'shortcuts' foi recusada, ou o atalho é reservado.
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'atalho-err-' + Date.now(),
        payload: {
          titulo: 'Erro',
          corpo: 'Não deu para registar o atalho: ' + (e.message || 'permissão recusada'),
        },
      },
      '*',
    );
  }
});
