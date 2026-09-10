// Plugin de exemplo — "Olá, ficheiro".
//
// Escreve uma nota na pasta que declarou (`filesystemRoot` no catálogo,
// nunca o disco inteiro), e lê-a de volta para confirmar. As duas ações
// pedem a mesma permissão ('filesystem'), por isso um só interruptor em
// Privacidade governa as duas.
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'core.run') {
    parent.postMessage(
      {
        type: 'core.fs.write',
        requestId: 'ola-ficheiro-write',
        payload: {
          caminho: 'nota.txt',
          conteudo: `Escrito pelo plugin de exemplo em ${new Date().toISOString()}`,
        },
      },
      '*',
    );
    return;
  }

  if (data.type === 'core.ack' && data.requestId === 'ola-ficheiro-write' && data.ok) {
    parent.postMessage(
      { type: 'core.fs.read', requestId: 'ola-ficheiro-read', payload: { caminho: 'nota.txt' } },
      '*',
    );
  }
});
