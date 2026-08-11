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
  var eventListeners = {};
  var nextId = 1;

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;

    // Resposta a um pedido do plugin (core.ack).
    if (data.type === 'core.ack') {
      var cb = callbacks[data.requestId];
      if (cb) {
        delete callbacks[data.requestId];
        cb(data);
      }
      return;
    }

    // Evento empurrado pelo Core (core.event) — o plugin subscreveu com core.event.on().
    if (data.type === 'core.event') {
      var listeners = eventListeners[data.evento];
      if (listeners) {
        for (var i = 0; i < listeners.length; i++) {
          try { listeners[i](data.payload); } catch (e) { /* não estraga os outros */ }
        }
      }
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

    /** Abre uma janela do sistema — `plugins.windows`. */
    window: {
      open: function (app, titulo) {
        return pedir('core.window.open', { app: app, titulo: titulo || undefined }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'window.open falhou');
          return ack.data.windowId;
        });
      },
    },

    /** Regista um comando na paleta — `plugins.commands`. */
    command: {
      register: function (id, nome, descricao) {
        return pedir('core.command.register', { id: id, nome: nome, descricao: descricao }).then(function (ack) {
          return ack.ok;
        });
      },
    },

    /** Subscreve um evento do sistema — `plugins.events`. */
    event: {
      /**
       * @param {string} evento — nome do evento (ex.: 'tarefa:concluida')
       * @param {function} callback — chamado com o payload do evento
       * @returns {Promise<function>} — devolve a função para cancelar a subscrição
       */
      on: function (evento, callback) {
        return pedir('core.event.subscribe', { evento: evento }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'event.on falhou');

          // Regista o callback local para quando o Core empurrar core.event.
          if (!eventListeners[evento]) eventListeners[evento] = [];
          eventListeners[evento].push(callback);

          // Devolve a função que remove este callback.
          return function () {
            var list = eventListeners[evento];
            if (!list) return;
            var idx = list.indexOf(callback);
            if (idx >= 0) list.splice(idx, 1);
            if (list.length === 0) delete eventListeners[evento];
          };
        });
      },
    },

    /** Preferências com prefixo isolado — `plugins.storage`. */
    storage: {
      set: function (chave, valor) {
        return pedir('core.storage.set', { chave: chave, valor: valor }).then(function (ack) {
          return ack.ok;
        });
      },

      get: function (chave, fallback) {
        return pedir('core.storage.get', { chave: chave, fallback: fallback }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'storage.get falhou');
          return ack.data.valor;
        });
      },

      remove: function (chave) {
        return pedir('core.storage.remove', { chave: chave }).then(function (ack) {
          return ack.ok;
        });
      },
    },

    /** Widgets simples — título + texto, nunca código nem markup. `plugins.widgets`. */
    widget: {
      create: function (id, titulo, texto) {
        return pedir('core.widget.create', { id: id, titulo: titulo, texto: texto }).then(
          function (ack) {
            return ack.ok;
          },
        );
      },
    },

    /** Itens no menu de contexto do ambiente de trabalho — `plugins.menus`. */
    menu: {
      /**
       * @param {string} id — identificador único do item, dentro do próprio plugin
       * @param {string} rotulo — texto mostrado no menu
       * @param {function} callback — chamado quando a pessoa clica no item
       * @returns {Promise<function>} — devolve a função para deixar de ouvir
       */
      add: function (id, rotulo, callback) {
        return pedir('core.menu.add', { id: id, rotulo: rotulo }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'menu.add falhou');

          var handler = function (event) {
            if (
              event.data &&
              event.data.type === 'core.menu.triggered' &&
              event.data.id === id
            ) {
              try { callback(); } catch (e) { /* não estraga os outros */ }
            }
          };
          window.addEventListener('message', handler);
          return function () { window.removeEventListener('message', handler); };
        });
      },
    },

    /** Definições editáveis, guardadas no armazenamento do plugin — `plugins.settings`. */
    setting: {
      /**
       * @param {string} chave
       * @param {string} rotulo
       * @param {'boolean'|'texto'} tipo
       * @param {boolean|string} valorOmissao
       */
      register: function (chave, rotulo, tipo, valorOmissao) {
        return pedir('core.setting.register', {
          chave: chave,
          rotulo: rotulo,
          tipo: tipo,
          valorOmissao: valorOmissao,
        }).then(function (ack) {
          return ack.ok;
        });
      },
    },

    /** Correr a um intervalo em segundo plano — `plugins.services`. */
    service: {
      /**
       * @param {string} id
       * @param {number} intervalMs — o Core aplica um mínimo (5s)
       * @param {function} callback — chamado a cada "tick"
       * @returns {Promise<function>} — devolve a função para deixar de ouvir
       */
      register: function (id, intervalMs, callback) {
        return pedir('core.service.register', { id: id, intervalMs: intervalMs }).then(
          function (ack) {
            if (!ack.ok) throw new Error(ack.reason || 'service.register falhou');

            var handler = function (event) {
              if (
                event.data &&
                event.data.type === 'core.service.tick' &&
                event.data.id === id
              ) {
                try { callback(); } catch (e) { /* não estraga os outros */ }
              }
            };
            window.addEventListener('message', handler);
            return function () { window.removeEventListener('message', handler); };
          },
        );
      },
    },

    /** Painel de texto expansível, ao lado do plugin na Loja — `plugins.panels`. */
    panel: {
      add: function (id, titulo, texto) {
        return pedir('core.panel.add', { id: id, titulo: titulo, texto: texto }).then(
          function (ack) {
            return ack.ok;
          },
        );
      },
    },

    /** Atalhos de teclado — `plugins.shortcuts`. */
    shortcut: {
      /**
       * @param {string} id — identificador único do atalho
       * @param {string} key — tecla principal (ex.: 's', 'F1')
       * @param {object} modifiers — { ctrlOrMeta, shift, alt }
       * @param {function} callback — chamado quando o atalho é premido
       * @returns {Promise<function>} — devolve a função para cancelar o registo
       */
      register: function (id, key, modifiers, callback) {
        modifiers = modifiers || {};
        return pedir('core.shortcut.register', {
          id: id,
          key: key,
          ctrlOrMeta: modifiers.ctrlOrMeta || false,
          shift: modifiers.shift || false,
          alt: modifiers.alt || false,
        }).then(function (ack) {
          if (!ack.ok) throw new Error(ack.reason || 'shortcut.register falhou');

          // Ouve o evento empurrado pelo Core quando o atalho é premido.
          var handler = function (event) {
            if (
              event.data &&
              event.data.type === 'core.shortcut.triggered' &&
              event.data.id === id
            ) {
              try { callback(); } catch (e) { /* não estraga os outros */ }
            }
          };
          window.addEventListener('message', handler);
          return function () { window.removeEventListener('message', handler); };
        });
      },
    },
  };
})();
