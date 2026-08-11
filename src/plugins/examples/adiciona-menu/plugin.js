// Plugin de exemplo — "Adiciona menu".
//
// Décima primeira prova da sandbox: adiciona um item ao menu de contexto
// do ambiente de trabalho (botão direito no fundo do ecrã), usando
// `core.menu.add`. Clicar no item mostra uma notificação — a prova de
// que o clique, feito fora da sandbox, chega mesmo de volta ao plugin
// isolado lá dentro.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    await window.core.menu.add('saudacao', 'Saudação do plugin', function () {
      parent.postMessage(
        {
          type: 'core.notify',
          requestId: 'adiciona-menu-clique-' + Date.now(),
          payload: {
            titulo: 'Olá do menu',
            corpo: 'O item "Saudação do plugin" foi clicado no menu de contexto.',
          },
        },
        '*',
      );
    });

    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'adiciona-menu-registo-' + Date.now(),
        payload: {
          titulo: 'Adiciona menu',
          corpo: 'Item adicionado. Clique com o botão direito no ambiente para o ver.',
        },
      },
      '*',
    );
  } catch (e) {
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'adiciona-menu-err-' + Date.now(),
        payload: {
          titulo: 'Erro',
          corpo: 'Não deu para adicionar o item: ' + (e.message || 'permissão recusada'),
        },
      },
      '*',
    );
  }
});
