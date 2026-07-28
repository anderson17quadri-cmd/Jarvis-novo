import type { PlatformCapabilities } from './platform';

/**
 * O que cada capacidade significa para a privacidade (Parte 14 §Painel).
 *
 * Um painel de privacidade que só listasse `systemMetrics: true` não informava
 * ninguém. O que interessa é o que isso quer dizer na prática, e o que muda
 * quando a plataforma o recusa.
 */
export interface CapabilityPrivacyNote {
  readonly capability: keyof PlatformCapabilities;
  readonly label: string;
  readonly whenGranted: string;
  readonly whenDenied: string;
}

export const CAPABILITY_PRIVACY: readonly CapabilityPrivacyNote[] = [
  {
    capability: 'systemMetrics',
    label: 'Métricas do computador',
    whenGranted: 'Lê CPU, memória, disco e rede. Os valores ficam no dispositivo.',
    whenDenied: 'Os widgets de sistema mostram valores simulados, e dizem-no.',
  },
  {
    capability: 'processList',
    label: 'Lista de processos',
    whenGranted: 'Vê que aplicações estão a correr.',
    whenDenied: 'Não vê nenhuma. É o caso do Android e do browser.',
  },
  {
    capability: 'fileDialogs',
    label: 'Ficheiros',
    whenGranted: 'Pode pedir ficheiros através do diálogo do sistema — nunca sozinho.',
    whenDenied: 'Não alcança o disco de forma nenhuma.',
  },
  {
    capability: 'nativeNotifications',
    label: 'Notificações do sistema',
    whenGranted: 'Pode mostrar avisos fora da janela.',
    whenDenied: 'Os avisos ficam dentro do JARVIS.',
  },
  {
    capability: 'shellOpen',
    label: 'Abrir ligações',
    whenGranted: 'Abre endereços no navegador predefinido. Só `https:` e `mailto:`.',
    whenDenied: 'Não abre nada fora da aplicação.',
  },
  {
    capability: 'voice',
    label: 'Microfone',
    whenGranted: 'Só escuta enquanto o botão estiver ativo. Não há escuta contínua.',
    whenDenied: 'O microfone não é usado.',
  },
  {
    capability: 'nativeStorage',
    label: 'Armazenamento',
    whenGranted: 'Guarda as preferências num ficheiro da aplicação.',
    whenDenied: 'Guarda no armazenamento do browser, que outra página do mesmo domínio pode ler.',
  },
  {
    capability: 'biometrics',
    label: 'Biometria',
    whenGranted: 'Pode pedir impressão digital ou rosto.',
    whenDenied: 'A biometria do ecrã de entrada é uma simulação, e não autentica nada.',
  },
];
