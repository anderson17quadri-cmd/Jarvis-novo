// Plugin de exemplo — "Executa voz".
//
// Décima quinta prova da sandbox: manda o assistente dizer uma frase em voz
// alta, com `core.voice.speak`. A decisão de permissão vive no Core — o
// plugin nunca sabe se tem voz; só recebe `ok: false` e mostra o resultado.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins), como
// os outros exemplos, para se poder recusar e permitir sem recarregar.
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  var falou = await window.core.voice.speak(
    'Olá — esta frase veio de um plugin, pela porta de voz do Core.',
  );

  parent.postMessage(
    {
      type: 'core.notify',
      requestId: 'executa-voz-' + Date.now(),
      payload: falou
        ? { titulo: 'Executa voz', corpo: 'O assistente falou a frase do plugin.' }
        : { titulo: 'Executa voz', corpo: 'Sem voz disponível ou permissão recusada.' },
    },
    '*',
  );
});
