// Plugin de exemplo — "Escuta eventos".
//
// Usa a capacidade `plugins.events` para subscrever o evento 'tema:alterado'.
// Sempre que o tema muda, o plugin recebe uma notificação assíncrona do Core.
//
// Usa o SDK (`window.core`) para subscrever — é o único exemplo que testa a
// comunicação assimétrica: o Core empurra eventos para o plugin, em vez de o
// plugin pedir e esperar.
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  // O SDK já foi injetado — usa-o diretamente.
  window.core.event.on('tema:alterado', function (payload) {
    window.core.notify(
      'Tema alterado',
      'O plugin detetou a mudança de tema para: ' + payload.theme,
    );
  });
});
