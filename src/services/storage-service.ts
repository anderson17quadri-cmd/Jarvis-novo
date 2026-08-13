import { getPlatformAdapter } from '@/platform';
import type { PlatformAdapter } from '@/platform';

/**
 * Chaves persistidas. Centralizadas para não haver strings soltas pelo código
 * nem colisões entre módulos.
 */
export const STORAGE_KEYS = {
  theme: 'theme',
  booted: 'booted',
  windowLayout: 'window-layout',
  widgetLayout: 'widget-layout',
  notifications: 'notifications',
  plugins: 'plugins',
  tasks: 'tasks',
  systemState: 'system-state',
  sound: 'sound',
  automations: 'automations',
  appearance: 'appearance',
  lastUser: 'last-user',
  reducedMotion: 'reduced-motion',
  conversations: 'conversations',
  assistantMemory: 'assistant-memory',
  workspace: 'workspace',
  customThemes: 'custom-themes',
  aiSettings: 'ai-settings',
  voiceSettings: 'voice-settings',
  weatherSettings: 'weather-settings',
  newsSettings: 'news-settings',
  newsMarks: 'news-marks',
  webSearchSettings: 'web-search-settings',
  mailSettings: 'mail-settings',
  musicSettings: 'music-settings',
  obsidianSettings: 'obsidian-settings',
  browserToolSettings: 'browser-tool-settings',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Persistência.
 *
 * No desktop e no Android usa o plugin `store` do Tauri; no browser, o
 * `localStorage`. Quem chama não sabe a diferença — o adapter trata disso.
 */
export class StorageService {
  constructor(private readonly adapter: PlatformAdapter = getPlatformAdapter()) {}

  get<T>(key: StorageKey, fallback: T): Promise<T> {
    return this.adapter.storageGet<T>(key, fallback);
  }

  set<T>(key: StorageKey, value: T): Promise<void> {
    return this.adapter.storageSet<T>(key, value);
  }

  remove(key: StorageKey): Promise<void> {
    return this.adapter.storageRemove(key);
  }
}

export const storageService = new StorageService();
