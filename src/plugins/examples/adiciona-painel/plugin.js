// Plugin de exemplo — "Adiciona painel".
//
// Décima quarta prova da sandbox: adiciona um painel de texto expansível
// com `core.panel.add` — mais espaço do que um widget, para o que não
// cabe num título e numa linha.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  var adicionado = await window.core.panel.add(
    'detalhes',
    'Detalhes deste plugin',
    'Este painel foi criado por um plugin isolado, dentro de um iframe sandboxed, ' +
      'sem acesso a nada do sistema além do que o Core autorizar explicitamente. ' +
      'Expande e recolhe sem recarregar nada.',
  );

  if (!adicionado) {
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'adiciona-painel-err-' + Date.now(),
        payload: { titulo: 'Erro', corpo: 'A permissão de painéis está recusada.' },
      },
      '*',
    );
  }
});
