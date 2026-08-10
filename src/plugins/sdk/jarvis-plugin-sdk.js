/**
 * JARVIS Plugin SDK — v0.1
 *
 * Corre dentro de um `<iframe sandbox="allow-scripts">`, sem acesso a nada
 * do Core além do que chegar por `postMessage`. Cada chamada a `core.*`
 * manda uma mensagem tipada e espera por `core.ack`.
 *
 * NÃO importar com `<script type="module">` dentro do iframe — o sandbox
 * não tem `allow-same-origin` e o `srcDoc` não suporta módulos ES sem
 * construir primeiro. Basta `<script src="...">` ou injetar o código.
 */
(function () {
  'use strict';

  var callbacks = {};
  var nextId = 1;

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'core.ack') return;
    var cb = callbacks[data.requestId];
    if (cb) {
      delete callbacks[data.requestId];
      cb(data);
    }
  });

  /**
   * Manda um pedido ao Core e espera pela resposta.
   * @param {string} type — tipo da mensagem (ex.: 'core.notify')
   * @param {object} payload — dados do pedido
   * @returns {Promise<{ok: boolean, reason?: string, data?: any}>}
   */
  function pedir(type, payload) {
    var requestId = 'plugin-' + Date.now() + '-' + (nextId++);
    return new Promise(function (resolve) {
      callbacks[requestId] = resolve;
      parent.postMessage(
        { type: type, requestId: requestId, payload: payload },
        '*',
      );
    });
  }

  /**
   * SDK público — a única API que um plugin vê.
   *
   * Cada função segue o protocolo em `plugins/runtime/protocol.ts`. O Core
   * verifica a permissão antes de cumprir — o plugin nunca sabe se tem ou
   * não acesso; simplesmente recebe `ok: false`.
   */
  window.core = {
    /** Notificações — `plugins.notifications`. */
    notify: function (titulo, corpo) {
      return pedir('core.notify', { titulo: titulo, corpo: corpo }).then(function (ack) {
        return ack.ok;
      });
    },

    /** Lê um ficheiro dentro da pasta declarada no manifesto — `plugins.filesystem`. */
    fs: {
      read: function (caminho) {
        return pedir('core.fs.read', { caminho: caminho }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'fs.read falhou');
          return ack.data.conteudo;
        });
      },

      write: function (caminho, conteudo) {
        return pedir('core.fs.write', { caminho: caminho, conteudo: conteudo }).then(function (ack) {
          return ack.ok;
        });
      },

      list: function (caminho) {
        return pedir('core.fs.list', { caminho: caminho !== null && caminho !== undefined ? caminho : '' }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'fs.list falhou');
          return ack.data.ficheiros;
        });
      },
    },

    /** Rede — domínios autorizados no manifesto — `plugins.network`. */
    fetch: function (url, opcoes) {
      opcoes = opcoes || {};
      return pedir('core.fetch', {
        url: url,
        metodo: opcoes.method || 'GET',
        cabecalhos: opcoes.headers,
        corpo: opcoes.body,
      }).then(function (ack) {
        if (!ack.ok) throw new Error(ack.reason || 'fetch falhou');
        return { status: ack.data.status, body: ack.data.corpo };
      });
    },

    /** Dispara uma automação já existente (nunca cria) — `plugins.notifications`. */
    automation: {
      run: function (nome) {
        return pedir('core.automation.run', { nome: nome }).then(function (ack) {
          return ack.ok;
        });
      },
    },
  };
})();
