import type { Automation } from '@/types/automation';

/**
 * Automações de exemplo (Parte 13 §Templates oficiais).
 *
 * Todas usam gatilhos e ações que o sistema cumpre mesmo — nenhuma promete
 * abrir o Spotify nem ler uma pasta. **As cinco vêm desligadas por omissão,
 * sem exceção nenhuma** — incluindo a do arranque: uma regra que corre sem
 * ninguém a ter ligado é uma surpresa, e uma surpresa num sistema é sempre
 * má, mesmo a mais bem-intencionada das cinco. Reavaliado em 10/08/2026
 * (Parte 13 §Templates): mantido de propósito, não por esquecimento — abrir
 * duas janelas e falar sozinho no primeiro arranque, antes de a pessoa saber
 * que automações existem, seria pior do que a pequena fricção de as ligar à
 * mão uma vez.
 */
export function seedAutomations(now: number = Date.now()): readonly Automation[] {
  return [
    {
      id: 'rotina-matinal',
      name: 'Rotina matinal',
      description: 'Ao carregar o ambiente, abre a agenda e os emails e dá o ponto de situação.',
      trigger: { kind: 'evento', event: 'desktop:carregado' },
      conditions: [{ kind: 'faixa-horaria', fromHour: 6, toHour: 12 }],
      actions: [
        { kind: 'abrir-janela', appId: 'calendar' },
        { kind: 'abrir-janela', appId: 'emails' },
        { kind: 'falar', text: 'Bom dia. A agenda e a caixa de entrada estão abertas.' },
      ],
      isEnabled: false,
      createdAt: now,
      lastRunAt: null,
      runCount: 0,
    },
    {
      id: 'modo-noite',
      name: 'Modo noite',
      description: 'A partir das 22h passa ao tema OLED e ao modo Economia.',
      trigger: { kind: 'hora', hour: 22, minute: 0 },
      conditions: [],
      actions: [
        { kind: 'tema', theme: 'oled' },
        { kind: 'estado-sistema', state: 'economia' },
        { kind: 'notificar', title: 'Modo noite', description: 'Tema OLED e consumo reduzido.' },
      ],
      isEnabled: false,
      createdAt: now,
      lastRunAt: null,
      runCount: 0,
    },
    {
      id: 'foco-de-trabalho',
      name: 'Foco de trabalho',
      description: 'Nos dias de semana, às 9h, entra em modo Foco e esconde as notícias.',
      trigger: { kind: 'hora', hour: 9, minute: 0 },
      conditions: [{ kind: 'dia-da-semana', days: [1, 2, 3, 4, 5] }],
      actions: [
        { kind: 'estado-sistema', state: 'foco' },
        { kind: 'widget', widget: 'news', show: false },
      ],
      isEnabled: false,
      createdAt: now,
      lastRunAt: null,
      runCount: 0,
    },
    {
      id: 'aviso-de-email',
      name: 'Aviso de email',
      description: 'Sempre que chega um email, anuncia-o em voz alta.',
      trigger: { kind: 'evento', event: 'email:novo' },
      conditions: [{ kind: 'estado-sistema', state: 'normal' }],
      actions: [{ kind: 'falar', text: 'Chegou um email novo.' }],
      isEnabled: false,
      createdAt: now,
      lastRunAt: null,
      runCount: 0,
    },
    {
      id: 'ponto-de-situacao',
      name: 'Ponto de situação',
      description: 'De hora a hora, mostra o monitor de recursos.',
      trigger: { kind: 'intervalo', everyMinutes: 60 },
      conditions: [],
      actions: [
        {
          kind: 'notificar',
          title: 'Ponto de situação',
          description: 'O sistema continua dentro dos valores normais.',
        },
      ],
      isEnabled: false,
      createdAt: now,
      lastRunAt: null,
      runCount: 0,
    },
  ];
}
