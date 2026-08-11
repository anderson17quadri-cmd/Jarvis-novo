// Plugin de exemplo — "Regista definição".
//
// Décima segunda prova da sandbox: declara uma definição editável com
// `core.setting.register`. O valor não volta ao plugin por aqui — vive
// no armazenamento do próprio plugin, e edita-se diretamente na Loja,
// ao lado deste botão.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  var registada = await window.core.setting.register(
    'maiusculas',
    'Avisar em maiúsculas',
    'boolean',
    false,
  );

  parent.postMessage(
    {
      type: 'core.notify',
      requestId: 'regista-definicao-' + Date.now(),
      payload: registada
        ? {
            titulo: 'Regista definição',
            corpo: 'Definição registada — vê e muda "Avisar em maiúsculas" aqui ao lado.',
          }
        : { titulo: 'Erro', corpo: 'A permissão de definições está recusada.' },
    },
    '*',
  );
});
