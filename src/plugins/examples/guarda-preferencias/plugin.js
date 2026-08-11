// Plugin de exemplo — "Guarda preferências".
//
// Oitava prova da sandbox: conta quantas vezes foi aberto, usando o
// armazenamento isolado do Core (`core.storage`). As chaves recebem
// automaticamente o prefixo `plugins:guarda-preferencias:` — um plugin
// nunca lê as preferências de outro.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins)
// em vez de disparar sozinho ao carregar — assim o mesmo plugin corre
// várias vezes na mesma sessão, para testar a recusar e a permitir sem
// recarregar o iframe.
window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    // Ler a contagem anterior (ou 0 se for a primeira vez).
    var contagem = (await window.core.storage.get('visitas', 0)) + 1;
    await window.core.storage.set('visitas', contagem);

    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'guarda-prefs-' + Date.now(),
        payload: {
          titulo: 'Guarda preferências',
          corpo: 'Esta é a ' + contagem + 'ª vez que corres este plugin.',
        },
      },
      '*',
    );
  } catch (e) {
    // Se a permissão 'storage' foi recusada, o Core devolve ok:false.
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'guarda-prefs-err-' + Date.now(),
        payload: {
          titulo: 'Erro',
          corpo: 'Não deu para guardar: ' + (e.message || 'permissão recusada'),
        },
      },
      '*',
    );
  }
});
