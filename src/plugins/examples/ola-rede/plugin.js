// Plugin de exemplo — "Olá, rede".
//
// Pede um único GET a um domínio que declarou à partida no catálogo
// (`allowedDomains`). O Core recusa qualquer outro domínio, mesmo que o
// código do plugin tente — a verificação não confia no que o plugin diz
// de si próprio, confia na lista guardada no lado do Core.
window.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  parent.postMessage(
    {
      type: 'core.fetch',
      requestId: `ola-rede-${Date.now()}`,
      payload: { url: 'https://jsonplaceholder.typicode.com/todos/1' },
    },
    '*',
  );
});
