// Plugin de exemplo — "Dispara automação".
//
// Usa o JARVIS Plugin SDK (`window.core`) em vez de `parent.postMessage`
// diretamente. Demonstra como um plugin pode disparar uma automação existente
// — nunca criar, só as que já estão configuradas na janela de Automações.
//
// O SDK (`jarvis-plugin-sdk.js`) é injetado automaticamente pelo
// `PluginRuntime` antes deste código correr — o plugin não precisa de o
// importar.
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    // Tenta disparar uma automação que não existe — só para mostrar a recusa.
    var ok = await core.automation.run('automação-de-teste');
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'dispara-automacao-' + Date.now(),
        payload: {
          titulo: ok ? 'Automação disparada' : 'Automação não encontrada',
          corpo: ok
            ? 'A automação foi disparada com sucesso.'
            : 'A automação "automação-de-teste" não existe — era de esperar, é só um exemplo.',
        },
      },
      '*',
    );
  } catch (erro) {
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'dispara-automacao-erro-' + Date.now(),
        payload: {
          titulo: 'Erro ao disparar',
          corpo: erro instanceof Error ? erro.message : 'Erro desconhecido.',
        },
      },
      '*',
    );
  }
});
