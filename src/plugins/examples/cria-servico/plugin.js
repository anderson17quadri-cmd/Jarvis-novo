// Plugin de exemplo — "Cria serviço".
//
// Décima terceira prova da sandbox: regista um serviço que corre em
// segundo plano com `core.service.register`. O Core "acorda" o plugin a
// cada intervalo (mínimo 5s, mesmo que se peça menos) e conta quantas
// vezes isso já aconteceu.
//
// Fica à espera de 'core.run' (o botão "Executar" na Loja de plugins).
// Ao contrário dos outros exemplos, este só regista uma vez por sessão —
// registar duas vezes com o mesmo ID é recusado de propósito.
var contador = 0;

window.addEventListener('message', async (event) => {
  if (!event.data || event.data.type !== 'core.run') return;

  try {
    await window.core.service.register('contador', 5000, function () {
      contador += 1;
      parent.postMessage(
        {
          type: 'core.notify',
          requestId: 'cria-servico-tick-' + Date.now(),
          payload: {
            titulo: 'Serviço em segundo plano',
            corpo: 'O Core acordou-me ' + contador + (contador === 1 ? ' vez.' : ' vezes.'),
          },
        },
        '*',
      );
    });

    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'cria-servico-registo-' + Date.now(),
        payload: {
          titulo: 'Cria serviço',
          corpo: 'Serviço registado — a próxima notificação chega dentro de 5 segundos.',
        },
      },
      '*',
    );
  } catch (e) {
    parent.postMessage(
      {
        type: 'core.notify',
        requestId: 'cria-servico-err-' + Date.now(),
        payload: {
          titulo: 'Erro',
          corpo: 'Não deu para registar o serviço: ' + (e.message || 'permissão recusada'),
        },
      },
      '*',
    );
  }
});
