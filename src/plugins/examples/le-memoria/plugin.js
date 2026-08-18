// Plugin de exemplo — "Lê memória".
//
// Décima sexta prova da sandbox: lê a memória que o assistente guardou sobre
// a pessoa (preferências ditas em voz alta e últimos pedidos), com
// `core.memory.read`. A decisão de permissão vive no Core.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    var memoria = await window.core.memory.read();
    var chaves = Object.keys(memoria.preferences);
    var corpo = chaves.length
      ? 'O assistente guarda ' + chaves.length + ' preferência(s): ' + chaves.join(', ') + '.'
      : 'O assistente não guardou nenhuma preferência ainda.';

    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'le-memoria-' + Date.now(),
        payload: { titulo: 'Lê memória', corpo: corpo },
      },
      '*',
    );
  } catch (e) {
    // Se a permissão 'memory' foi recusada, o Core devolve ok:false e a
    // SDK lança — mostramos o erro em vez de fingir que lemos.
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'le-memoria-err-' + Date.now(),
        payload: {
          titulo: 'Erro',
          corpo: 'Não deu para ler a memória: ' + (e.message || 'permissão recusada'),
        },
      },
      '*',
    );
  }
});
