// Plugin de exemplo — "Regista comando".
//
// Usa a capacidade `plugins.commands` para registar um comando na paleta.
// Depois de registado, o comando aparece na Command Palette (Ctrl+K) no
// grupo "Plugins".
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  parent.postMessage(
    {
      type: 'core.command.register',
      requestId: `regista-comando-${Date.now()}`,
      payload: {
        id: 'exemplo-comando',
        nome: 'Comando de exemplo do plugin',
        descricao: 'Registado via core.command.register()',
      },
    },
    '*',
  );
});
