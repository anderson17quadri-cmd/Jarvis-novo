import {
  Bot,
  Calendar,
  Cloud,
  Code,
  Gamepad2,
  Globe,
  Music,
  Terminal,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { PluginPermissions } from '@/plugins/plugin';
import type { PlatformCapabilities } from '@/types/platform';

/**
 * Catálogo de plugins da loja.
 *
 * **Só interface.** Nada aqui carrega código: instalar muda um estado local e
 * mais nada. O carregamento real exige sandbox, verificação de assinatura e
 * acesso ao sistema de ficheiros — tudo bloqueado até haver PC.
 * Ver `SPEC.md` §Estado de verificação.
 */

export type PluginCategory = 'produtividade' | 'desenvolvimento' | 'media' | 'integracao' | 'ia';

export const PLUGIN_CATEGORY_LABELS: Record<PluginCategory, string> = {
  produtividade: 'Produtividade',
  desenvolvimento: 'Desenvolvimento',
  media: 'Media',
  integracao: 'Integrações',
  ia: 'Inteligência Artificial',
};

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly author: string;
  readonly version: string;
  readonly icon: LucideIcon;
  readonly category: PluginCategory;
  readonly permissions: PluginPermissions;
  /** Instalações, para dar noção de adoção. */
  readonly installs: number;
  readonly rating: number;
  /** `true` para os que vêm com o sistema e não se removem. */
  readonly isBuiltIn: boolean;
  /**
   * Capacidades da plataforma sem as quais o plugin não funciona.
   *
   * Deliberadamente **não** é uma lista de plataformas: a loja compara isto com
   * `useCapabilities()` e nunca pergunta em que sistema está. Um plugin que
   * precisa de ver processos fica indisponível onde não os há, seja no Android,
   * seja no browser, sem que ninguém escreva o nome da plataforma.
   */
  readonly requires: readonly (keyof PlatformCapabilities)[];
}

const NO_PERMISSIONS: PluginPermissions = {
  filesystem: false,
  network: false,
  systemMetrics: false,
  notifications: false,
  shell: false,
};

export const PLUGIN_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'core-assistant',
    name: 'Assistente JARVIS',
    tagline: 'O assistente conversacional do sistema.',
    description:
      'Conversa, comandos por voz e ligação aos provedores de IA. Vem instalado e não pode ser removido.',
    author: 'Project ARC',
    version: '1.0.0',
    icon: Bot,
    category: 'ia',
    permissions: { ...NO_PERMISSIONS, network: true, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: true,
    requires: [],
  },
  {
    id: 'terminal',
    name: 'Terminal integrado',
    tagline: 'Uma shell dentro do ambiente de trabalho.',
    description:
      'Executa comandos sem sair do JARVIS, com histórico e realce de sintaxe. Exige permissão de shell.',
    author: 'Project ARC',
    version: '0.9.2',
    icon: Terminal,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, shell: true, filesystem: true },
    installs: 8_420,
    rating: 4.6,
    isBuiltIn: false,
    // Sem processos nem ficheiros não há terminal — é o que exclui o telemóvel
    // e o browser, sem nomear nenhum dos dois.
    requires: ['processList', 'fileDialogs'],
  },
  {
    id: 'browser',
    name: 'Navegador',
    tagline: 'Navegação web em painel lateral ou janela.',
    description: 'Abre páginas dentro do sistema, com separadores e marcadores próprios.',
    author: 'Comunidade',
    version: '0.7.0',
    icon: Globe,
    category: 'produtividade',
    permissions: { ...NO_PERMISSIONS, network: true },
    installs: 12_105,
    rating: 4.2,
    isBuiltIn: false,
    requires: ['shellOpen'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    tagline: 'Controla a reprodução sem sair do ambiente.',
    description:
      'Liga o widget de música à tua conta, com pesquisa, listas e controlo de reprodução real.',
    author: 'Comunidade',
    version: '2.1.4',
    icon: Music,
    category: 'media',
    permissions: { ...NO_PERMISSIONS, network: true },
    installs: 31_870,
    rating: 4.8,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    tagline: 'Sincroniza a agenda com a tua conta Google.',
    description: 'Eventos, lembretes e convites no widget de calendário e na janela da agenda.',
    author: 'Comunidade',
    version: '1.5.0',
    icon: Calendar,
    category: 'integracao',
    permissions: { ...NO_PERMISSIONS, network: true, notifications: true },
    installs: 24_330,
    rating: 4.5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'automations',
    name: 'Motor de automações',
    tagline: 'Regras que correm sozinhas.',
    description:
      'Gatilhos por hora ou por evento, com ações encadeadas. Base do resumo matinal e da prospecção semanal.',
    author: 'Project ARC',
    version: '0.4.1',
    icon: Zap,
    category: 'produtividade',
    permissions: { ...NO_PERMISSIONS, network: true, notifications: true, filesystem: true },
    installs: 6_940,
    rating: 4.4,
    isBuiltIn: false,
    // Um motor de regras que as esquece ao limpar a cache não é um motor de regras.
    requires: ['nativeStorage'],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    tagline: 'Modelos de IA a correr na tua máquina.',
    description:
      'Liga o assistente a modelos locais, sem enviar nada para a nuvem. Requer o Ollama instalado.',
    author: 'Comunidade',
    version: '1.2.0',
    icon: Cloud,
    category: 'ia',
    permissions: { ...NO_PERMISSIONS, network: true, shell: true },
    installs: 18_260,
    rating: 4.7,
    isBuiltIn: false,
    // Precisa de um servidor local a correr ao lado.
    requires: ['processList'],
  },
  {
    id: 'git',
    name: 'Git',
    tagline: 'Estado dos repositórios em tempo real.',
    description: 'Ramos, commits por enviar e estado das ações de integração contínua.',
    author: 'Comunidade',
    version: '0.6.3',
    icon: Code,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, filesystem: true, shell: true, network: true },
    installs: 9_510,
    rating: 4.3,
    isBuiltIn: false,
    requires: ['processList', 'fileDialogs'],
  },
  {
    id: 'game-mode',
    name: 'Modo de jogo',
    tagline: 'Reduz o consumo do ambiente durante o jogo.',
    description:
      'Suspende animações pesadas, baixa a sondagem de métricas e silencia notificações não urgentes.',
    author: 'Comunidade',
    version: '0.3.0',
    icon: Gamepad2,
    category: 'produtividade',
    permissions: { ...NO_PERMISSIONS, systemMetrics: true },
    installs: 4_120,
    rating: 4.0,
    isBuiltIn: false,
    requires: ['systemMetrics', 'windowManagement'],
  },
];

/** Etiquetas legíveis das permissões, para o cartão as explicar. */
export const PERMISSION_LABELS: Record<keyof PluginPermissions, string> = {
  filesystem: 'Ficheiros',
  network: 'Rede',
  systemMetrics: 'Métricas do sistema',
  notifications: 'Notificações',
  shell: 'Executar comandos',
};

/** As permissões pedidas, já em texto. */
export function listPermissions(permissions: PluginPermissions): readonly string[] {
  return (Object.keys(PERMISSION_LABELS) as (keyof PluginPermissions)[])
    .filter((key) => permissions[key])
    .map((key) => PERMISSION_LABELS[key]);
}

/** Etiquetas das capacidades, para explicar porque é que um plugin não está disponível. */
export const CAPABILITY_LABELS: Record<keyof PlatformCapabilities, string> = {
  systemMetrics: 'métricas do sistema',
  processList: 'lista de processos',
  systemTray: 'bandeja do sistema',
  globalShortcut: 'atalho global',
  windowManagement: 'gestão de janelas',
  nativeNotifications: 'notificações nativas',
  shellOpen: 'abrir ligações no sistema',
  fileDialogs: 'acesso a ficheiros',
  nativeStorage: 'armazenamento nativo',
  voice: 'voz',
  biometrics: 'biometria',
};

/**
 * O que falta a esta plataforma para o plugin funcionar.
 *
 * Lista vazia significa disponível. Devolver os nomes em falta — e não um
 * booleano — permite ao cartão dizer *porquê*, em vez de mostrar um botão
 * desligado sem explicação.
 */
export function missingCapabilities(
  entry: CatalogEntry,
  capabilities: PlatformCapabilities,
): readonly string[] {
  return entry.requires
    .filter((capability) => !capabilities[capability])
    .map((capability) => CAPABILITY_LABELS[capability]);
}
