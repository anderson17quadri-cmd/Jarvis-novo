// Plugin de exemplo — "Abre janela".
//
// Usa a capacidade `plugins.windows` para abrir uma janela do sistema.
// A recusa da permissão devolve `ok: false` com razão 'permissao-negada'.
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  parent.postMessage(
    {
      type: 'core.window.open',
      requestId: `abre-janela-${Date.now()}`,
      payload: {
        app: 'tasks',
        titulo: 'Tarefas (aberto pelo plugin)',
      },
    },
    '*',
  );
});
