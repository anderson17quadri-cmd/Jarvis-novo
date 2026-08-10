import { describe, expect, it } from 'vitest';

import { describeIntent, isCritical, parseSpeech } from '@/services/voice/intents';
import { normalizeSearch } from '@/utils/text';
import type { VoiceIntent } from '@/services/voice/intents';

/** Atalho: interpreta uma frase e devolve as intenções. */
function intents(phrase: string): readonly VoiceIntent[] {
  return parseSpeech(phrase).intents;
}

/** A primeira intenção de uma frase. */
function first(phrase: string): VoiceIntent {
  const [intent] = parseSpeech(phrase).intents;
  if (!intent) throw new Error(`"${phrase}" não deu intenção nenhuma.`);
  return intent;
}

describe('comandos de sistema', () => {
  it('fechar as janelas', () => {
    expect(first('Fecha todas as janelas.').kind).toBe('fechar-janelas');
    expect(first('fechar janelas').kind).toBe('fechar-janelas');
  });

  it('reiniciar a interface', () => {
    expect(first('Reinicia a interface.').kind).toBe('reiniciar-interface');
  });

  it('as duas pedem confirmação — não se desfazem', () => {
    expect(isCritical(first('Fecha todas as janelas.'))).toBe(true);
    expect(isCritical(first('Reinicia a interface.'))).toBe(true);
  });

  it('abrir uma janela não pede confirmação', () => {
    expect(isCritical(first('Abre o calendário.'))).toBe(false);
  });
});

describe('aplicações', () => {
  it.each([
    ['Abre o calendário.', 'calendar'],
    ['Mostra os emails.', 'emails'],
    ['Abre o gestor de tarefas.', 'tasks'],
    ['Abre o navegador.', 'browser'],
    ['Abre as configurações.', 'themes'],
    ['Mostra os projetos.', 'projects'],
    ['Abre o explorador.', 'files'],
  ])('%s abre %s', (phrase, appId) => {
    const intent = first(phrase);
    expect(intent.kind).toBe('abrir-janela');
    expect(intent.kind === 'abrir-janela' && intent.appId).toBe(appId);
  });

  it('o nome sozinho chega', () => {
    expect(first('Calendário').kind).toBe('abrir-janela');
  });

  it('uma pergunta sobre a agenda não abre a agenda — vai ao assistente', () => {
    // Sem verbo de abertura e com frase longa, é conversa, não comando.
    expect(first('o que tenho hoje no calendario da semana').kind).toBe('perguntar');
  });
});

describe('produtividade', () => {
  it('criar uma tarefa guarda o título', () => {
    const intent = first('Cria uma tarefa comprar cabo HDMI.');
    expect(intent.kind).toBe('criar-tarefa');
    expect(intent.kind === 'criar-tarefa' && intent.title).toBe('comprar cabo hdmi');
  });

  it('"lembra-me de" também cria', () => {
    const intent = first('Lembra-me de ligar ao contabilista.');
    expect(intent.kind === 'criar-tarefa' && intent.title).toBe('ligar ao contabilista');
  });

  it('pedir uma tarefa sem dizer qual abre a janela', () => {
    const intent = first('Cria uma tarefa');
    expect(intent.kind).toBe('abrir-janela');
  });
});

describe('pesquisa', () => {
  it('guarda o que se procura', () => {
    const intent = first('Procura o ficheiro orçamento.');
    expect(intent.kind).toBe('pesquisar');
    expect(intent.kind === 'pesquisar' && intent.query).toContain('ficheiro orcamento');
  });

  it('aceita as várias formas de pedir', () => {
    for (const phrase of ['Pesquisa notas de marketing', 'Encontra conversas sobre IA']) {
      expect(first(phrase).kind).toBe('pesquisar');
    }
  });
});

describe('multimédia', () => {
  it.each([
    ['Próxima faixa.', 'proxima'],
    ['Faixa anterior.', 'anterior'],
    ['Pausa.', 'pausar'],
    ['Reproduz música.', 'tocar'],
  ])('%s', (phrase, action) => {
    const intent = first(phrase);
    expect(intent.kind).toBe('musica');
    expect(intent.kind === 'musica' && intent.action).toBe(action);
  });
});

describe('desktop', () => {
  it('trocar de tema', () => {
    const intent = first('Altera para o tema OLED Black.');
    expect(intent.kind).toBe('tema');
    expect(intent.kind === 'tema' && intent.theme).toBe('oled');
  });

  it('ativar um estado do sistema', () => {
    const intent = first('Ativa o modo foco.');
    expect(intent.kind).toBe('estado');
    expect(intent.kind === 'estado' && intent.state).toBe('foco');
  });

  it('esconder os widgets', () => {
    expect(first('Esconde os widgets.').kind).toBe('esconder-widgets');
  });

  it('mostrar um widget concreto', () => {
    const intent = first('Mostra o widget de Disco.');
    expect(intent.kind).toBe('widget');
    expect(intent.kind === 'widget' && intent.widget).toBe('disk');
    expect(intent.kind === 'widget' && intent.show).toBe(true);
  });
});

describe('comandos compostos', () => {
  it('duas ordens numa frase dão duas intenções', () => {
    const parsed = parseSpeech('Abre o calendário e ativa o modo foco.');

    expect(parsed.intents).toHaveLength(2);
    expect(parsed.intents[0]?.kind).toBe('abrir-janela');
    expect(parsed.intents[1]?.kind).toBe('estado');
  });

  it('três também', () => {
    const parsed = parseSpeech('Abre os emails, mostra os projetos e pausa');
    expect(parsed.intents).toHaveLength(3);
  });

  it('um "e" dentro de um título não parte o comando', () => {
    // Este é o caso que estraga tudo se a divisão for ingénua: dividir daria
    // uma tarefa "comprar pao" e um comando perdido chamado "leite".
    const parsed = parseSpeech('Cria uma tarefa comprar pão e leite');

    expect(parsed.intents).toHaveLength(1);
    const [intent] = parsed.intents;
    expect(intent?.kind === 'criar-tarefa' && intent.title).toBe('comprar pao e leite');
  });
});

describe('o que não é comando', () => {
  it('uma pergunta vai para o assistente em vez de falhar', () => {
    const parsed = parseSpeech('Qual é a capital da Austrália?');

    expect(parsed.intents).toHaveLength(1);
    expect(parsed.intents[0]?.kind).toBe('perguntar');
    // Vai o texto original, com acentos e pontuação — quem responde é a IA.
    expect(parsed.intents[0]?.kind === 'perguntar' && parsed.intents[0].text).toBe(
      'Qual é a capital da Austrália?',
    );
  });

  it('silêncio não dá intenção nenhuma', () => {
    expect(intents('   ')).toHaveLength(0);
  });
});

describe('robustez', () => {
  it('os acentos e a pontuação são indiferentes', () => {
    expect(first('ABRE O CALENDÁRIO!!!').kind).toBe('abrir-janela');
    expect(first('abre o calendario').kind).toBe('abrir-janela');
  });

  it('a frase ouvida é devolvida tal como veio, para se poder corrigir', () => {
    const parsed = parseSpeech('Abre o Calendário');
    expect(parsed.transcript).toBe('Abre o Calendário');
    expect(normalizeSearch(parsed.transcript)).toBe('abre o calendario');
  });

  it('toda a intenção sabe descrever-se', () => {
    const frases = [
      'Fecha todas as janelas',
      'Abre o calendário',
      'Ativa o modo foco',
      'Altera para o tema solar',
      'Cria uma tarefa teste',
      'Procura relatório',
      'Pausa',
      'Esconde os widgets',
      'Reinicia a interface',
      'Que horas são no Japão',
    ];

    for (const frase of frases) {
      expect(describeIntent(first(frase)).length, frase).toBeGreaterThan(0);
    }
  });

  it('descreve com nomes, e não com identificadores internos', () => {
    // Os identificadores são minúsculos e sem acentos; os nomes não. Cada uma
    // destas linhas já saiu do sistema com o `id` cru lá dentro.
    expect(describeIntent(first('Abre os emails'))).toBe('Abrir Emails');
    expect(describeIntent(first('Abre a personalização'))).toBe('Abrir Personalização');
    expect(describeIntent(first('Muda para o tema oled'))).toBe('Aplicar o tema OLED Black');
    expect(describeIntent(first('Mostra o widget de cpu'))).toBe('Mostrar o widget CPU');
  });
});

describe('cortesia — "podes", "por favor", "consegues"', () => {
  it.each([
    'Abre os emails.',
    'Podes abrir os emails?',
    'Pode abrir os emails.',
    'Por favor abre os emails.',
    'Consegues abrir os emails?',
    'Podes por favor abrir os emails?',
  ])('%s', (phrase) => {
    const intent = first(phrase);
    expect(intent.kind).toBe('abrir-janela');
    expect(intent.kind === 'abrir-janela' && intent.appId).toBe('emails');
  });

  it('a cortesia sozinha, sem pedido nenhum a seguir, não vira comando', () => {
    // "podes" sem mais nada não é "abrir" nem nada — vai para o assistente,
    // como qualquer frase que não bata com um comando conhecido.
    expect(first('Podes').kind).toBe('perguntar');
  });
});

describe('mais variações do mesmo pedido', () => {
  it.each([
    ['Entra no calendário.', 'calendar'],
    ['Vai para o calendário.', 'calendar'],
    ['Inicia o calendário.', 'calendar'],
    ['Quero abrir o calendário.', 'calendar'],
  ])('%s', (phrase, appId) => {
    const intent = first(phrase);
    expect(intent.kind).toBe('abrir-janela');
    expect(intent.kind === 'abrir-janela' && intent.appId).toBe(appId);
  });

  it('remover/ocultar são sinónimos de esconder, para widgets', () => {
    expect(first('Remove o widget de cpu.').kind).toBe('widget');
    expect(first('Ocultar o widget de cpu.').kind).toBe('widget');
  });

  it('busca é sinónimo de procurar', () => {
    const intent = first('Busca relatório mensal.');
    expect(intent.kind).toBe('pesquisar');
    expect(intent.kind === 'pesquisar' && intent.query).toBe('relatorio mensal');
  });

  it('anotar é sinónimo de criar tarefa', () => {
    const intent = first('Anota comprar leite.');
    expect(intent.kind).toBe('criar-tarefa');
    expect(intent.kind === 'criar-tarefa' && intent.title).toBe('comprar leite');
  });

  it('"fecha tudo" fecha as janelas, sem precisar de dizer "janelas"', () => {
    expect(first('Fecha tudo.').kind).toBe('fechar-janelas');
  });

  it('reiniciar aceita "app" e "jarvis", não só "interface"/"sistema"', () => {
    expect(first('Reinicia a app.').kind).toBe('reiniciar-interface');
    expect(first('Reinicia o jarvis.').kind).toBe('reiniciar-interface');
  });

  it('continuar/retomar a música é sinónimo de tocar', () => {
    const intent = first('Continua a música.');
    expect(intent.kind).toBe('musica');
    expect(intent.kind === 'musica' && intent.action).toBe('tocar');
  });
});
