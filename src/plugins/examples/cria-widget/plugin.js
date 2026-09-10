// Plugin de exemplo — "Cria widget".
//
// Décima prova da sandbox: cria um widget simples, só título e texto,
// usando `core.widget.create` (via SDK, `window.core.widget.create`).
// Nunca código nem markup — o Core mostra o texto tal como chega, sem o
// interpretar.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  var criado = await window.core.widget.create(
    'resumo',
    'Resumo do plugin',
    'Este widget foi criado por um plugin isolado, sem acesso a nada além do que pediu.',
  );

  if (!criado) {
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'cria-widget-err-' + Date.now(),
        payload: { titulo: 'Erro', corpo: 'A permissão de widgets está recusada.' },
      },
      '*',
    );
  }
});
