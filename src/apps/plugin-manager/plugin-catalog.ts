import {
  Bell,
  Bot,
  Calendar,
  Cloud,
  Code,
  FolderOpen,
  Gamepad2,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Menu,
  Music,
  PanelRight,
  Puzzle,
  Server,
  SlidersHorizontal,
  Terminal,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { PluginManifest, PluginPermissions } from '@/plugins/plugin';
import type { PlatformCapabilities } from '@/types/platform';

/**
 * Catálogo de plugins da loja.
 *
 * Instalar continua a só mudar um estado local — nenhum destes descarrega
 * código de lado nenhum. A sandbox de execução (`plugins/runtime/`) já existe
 * e já corre quatro plugins a sério (`ola-notificacao`, `ola-ficheiro`,
 * `ola-rede`, `dispara-automacao` — notificações, ficheiros, rede e disparar
 * automações); os outros do catálogo continuam só interface. Desenho em
 * `docs/spec/plugins-sandbox.md`.
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
  /**
   * Pasta raiz para ficheiros — declarada no manifesto, nunca o disco
   * inteiro. Todos os caminhos que o plugin pede (`core.fs.read`,
   * `core.fs.write`, `core.fs.list`) são relativos a esta raiz.
   */
  readonly filesystemRoot?: string;
  /**
   * Domínios que o plugin pode contactar via `core.fetch`. Vazio ou
   * omisso significa "nenhum". Cada entrada é um domínio exato
   * (ex.: `"api.github.com"`), validado pelo Core antes de cada pedido.
   */
  readonly allowedDomains?: readonly string[];
  /**
   * Assinatura Ed25519 do manifesto (64 bytes raw) em base64.
   *
   * Se ausente, o plugin é tratado como "não assinado" — aceite no catálogo
   * local (confia-se na origem), mas recusado se vier de uma fonte externa.
   * Ver `src/plugins/signature.ts`.
   */
  readonly signature?: string;
  /**
   * Chave pública Ed25519 do signatário (32 bytes raw) em base64.
   *
   * Só tem significado se `signature` também existir. Usada para verificar a
   * assinatura e para cruzar com a lista de revogação.
   */
  readonly signerPublicKey?: string;
  /**
   * Nome legível do signatário — só para mostrar no cartão, não participa na
   * verificação criptográfica.
   */
  readonly signerName?: string;
}

/**
 * Constrói um `PluginManifest` a partir de uma entrada do catálogo.
 *
 * O catálogo tem mais campos do que o manifesto (ícone, categoria, etc.) —
 * esta função extrai só o subconjunto que interessa para a assinatura.
 */
export function toManifest(entry: CatalogEntry): PluginManifest {
  return {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    description: entry.description,
    author: entry.author,
    permissions: entry.permissions,
    platforms: ['desktop'],
  };
}

const NO_PERMISSIONS: PluginPermissions = {
  filesystem: false,
  network: false,
  systemMetrics: false,
  notifications: false,
  shell: false,
  windows: false,
  commands: false,
  events: false,
  storage: false,
  shortcuts: false,
  widgets: false,
  menus: false,
  settings: false,
  services: false,
  panels: false,
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
    id: 'ola-notificacao',
    name: 'Olá, notificação',
    tagline: 'Plugin de exemplo — código a sério, isolado numa sandbox.',
    description:
      'Não faz nada de útil: existe para provar que a execução de plugins funciona a sério. Corre num iframe restrito, sem acesso a nada do sistema além do que o Core autorizar, e pede uma notificação para mostrar que a permissão é verificada de verdade.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Bell,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'ola-ficheiro',
    name: 'Olá, ficheiro',
    tagline: 'Plugin de exemplo — escreve e lê dentro da própria pasta.',
    description:
      'Segunda prova da sandbox: escreve uma nota de teste e lê-a de volta, sempre dentro da pasta que declarou (nunca o disco inteiro). Recusar a permissão de ficheiros bloqueia as duas ações.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: FolderOpen,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, filesystem: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
    filesystemRoot: 'ola-ficheiro',
  },
  {
    id: 'ola-rede',
    name: 'Olá, rede',
    tagline: 'Plugin de exemplo — um pedido a um domínio autorizado.',
    description:
      'Terceira prova da sandbox: um GET a um único domínio, declarado à partida no catálogo. Qualquer outro domínio é recusado pelo Core, mesmo que o plugin tente — a lista não vem do próprio plugin.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Wifi,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, network: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
    allowedDomains: ['jsonplaceholder.typicode.com'],
  },
  {
    id: 'dispara-automacao',
    name: 'Dispara automação',
    tagline: 'Plugin de exemplo — dispara uma automação existente.',
    description:
      'Quarta prova da sandbox: tenta disparar uma automação pelo nome, usando o SDK. O plugin nunca pode criar ou alterar automações — só disparar as que já existem, e a verificação de permissão impede-o de o fazer se a permissão estiver recusada.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Zap,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'abre-janela',
    name: 'Abre janela',
    tagline: 'Plugin de exemplo — abre uma janela do sistema.',
    description:
      'Quinta prova da sandbox: pede ao Core para abrir a janela de Tarefas. A permissão `windows` controla se o pedido é cumprido ou recusado.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: LayoutGrid,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, windows: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: ['windowManagement'],
  },
  {
    id: 'regista-comando',
    name: 'Regista comando',
    tagline: 'Plugin de exemplo — regista um comando na paleta.',
    description:
      'Sexta prova da sandbox: regista um comando que aparece na Command Palette (Ctrl+K). A permissão `commands` controla se o registo é aceite.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Puzzle,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, commands: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'escuta-eventos',
    name: 'Escuta eventos',
    tagline: 'Plugin de exemplo — subscreve eventos do sistema.',
    description:
      'Sétima prova da sandbox: subscreve o evento `tema:alterado` e mostra uma notificação sempre que o tema muda. A permissão `events` controla se a subscrição é aceite.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Bell,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, events: true, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
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
  {
    id: 'guarda-preferencias',
    name: 'Guarda preferências',
    tagline: 'Plugin de exemplo — guarda e lê com core.storage.',
    description:
      'Oitava prova da sandbox: conta quantas vezes foi aberto, usando o armazenamento isolado do Core. A permissão `storage` controla se as leituras e escritas são cumpridas.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: FolderOpen,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, storage: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: ['nativeStorage'],
  },
  {
    id: 'regista-atalho',
    name: 'Regista atalho',
    tagline: 'Plugin de exemplo — regista um atalho de teclado.',
    description:
      'Nona prova da sandbox: regista Ctrl+Shift+H para mostrar uma notificação, usando `core.shortcut.register`. A permissão `shortcuts` controla se o registo é aceite.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Zap,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, shortcuts: true, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'cria-widget',
    name: 'Cria widget',
    tagline: 'Plugin de exemplo — cria um widget simples.',
    description:
      'Décima prova da sandbox: cria um widget de título e texto, com `core.widget.create`. Nunca código nem markup — só as duas cadeias de texto que o Core mostra num cartão de confiança.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: LayoutDashboard,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, widgets: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'adiciona-menu',
    name: 'Adiciona menu',
    tagline: 'Plugin de exemplo — item no menu de contexto do ambiente.',
    description:
      'Décima primeira prova da sandbox: adiciona "Saudação do plugin" ao menu de contexto do ambiente de trabalho (botão direito). Clicar mostra uma notificação — a prova de que o clique chega mesmo ao plugin isolado.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Menu,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, menus: true, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'regista-definicao',
    name: 'Regista definição',
    tagline: 'Plugin de exemplo — declara uma definição editável.',
    description:
      'Décima segunda prova da sandbox: declara "Avisar em maiúsculas" (ligado/desligado) com `core.setting.register`. O valor edita-se na própria Loja e fica guardado no armazenamento do plugin.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: SlidersHorizontal,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, settings: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'cria-servico',
    name: 'Cria serviço',
    tagline: 'Plugin de exemplo — corre em segundo plano a um intervalo.',
    description:
      'Décima terceira prova da sandbox: regista um serviço que conta quantas vezes o Core o "acordou", com `core.service.register`. O intervalo mínimo é 5 segundos, para nenhum plugin martelar o Core.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: Server,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, services: true, notifications: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
  {
    id: 'adiciona-painel',
    name: 'Adiciona painel',
    tagline: 'Plugin de exemplo — painel de texto expansível.',
    description:
      'Décima quarta prova da sandbox: adiciona um painel com mais texto do que cabe num widget, com `core.panel.add` — expande e recolhe na própria Loja.',
    author: 'Project ARC',
    version: '0.1.0',
    icon: PanelRight,
    category: 'desenvolvimento',
    permissions: { ...NO_PERMISSIONS, panels: true },
    installs: 1,
    rating: 5,
    isBuiltIn: false,
    requires: [],
  },
];

/** Etiquetas legíveis das permissões, para o cartão as explicar. */
export const PERMISSION_LABELS: Record<keyof PluginPermissions, string> = {
  filesystem: 'Ficheiros',
  network: 'Rede',
  systemMetrics: 'Métricas do sistema',
  notifications: 'Notificações',
  shell: 'Executar comandos',
  windows: 'Janelas',
  commands: 'Comandos na paleta',
  events: 'Subscrever eventos',
  storage: 'Guardar preferências',
  shortcuts: 'Atalhos de teclado',
  widgets: 'Criar widgets',
  menus: 'Adicionar itens de menu',
  settings: 'Adicionar definições',
  services: 'Correr em segundo plano',
  panels: 'Adicionar painéis',
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
  terminal: 'terminal',
  secretVault: 'cofre de segredos',
  fileWatcher: 'observador de pastas',
  usbMonitor: 'monitor USB',
  batteryMonitor: 'monitor de bateria',
  realFilesystem: 'sistema de ficheiros real',
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
