// Plugin de exemplo — "Regista comando".
//
// Usa a capacidade `plugins.commands` para registar um comando na paleta.
// Depois de registado, o comando aparece na Command Palette (Ctrl+K) no
// grupo "Plugins". Quando a pessoa o executa na paleta, o Core empurra
// `core.command.triggered` — é aqui que o plugin reage, sem pedir mais
// nenhuma capacidade.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;

  if (data.type === 'core.run') {
    parent.postMessage(
      {
        type: 'core.command.register',
        requestId: `regista-comando-${Date.now()}`,
        payload: {
          id: 'exemplo-comando',
          nome: 'Comando de exemplo do plugin',
          descricao: 'Executa ao ser escolhido na paleta',
        },
      },
      '*',
    );
    return;
  }

  if (data.type === 'core.command.triggered' && data.id === 'exemplo-comando') {
    document.body.textContent = 'Comando de exemplo executado.';
  }
});
