import { DEFAULT_THEME, THEMES, type ThemeId } from '@/design-system/tokens';
import { storageService, STORAGE_KEYS, type StorageService } from './storage-service';

/**
 * Temas.
 *
 * O tema aplica-se num único sítio — o atributo `data-theme` no `<html>`. Todo
 * o resto do sistema já aponta para variáveis CSS, por isso a troca é
 * instantânea e não obriga a repintar nada à mão.
 */
export class ThemeService {
  constructor(private readonly storage: StorageService = storageService) {}

  /** O tema base não leva atributo — é o `:root`. */
  apply(theme: ThemeId): void {
    if (theme === DEFAULT_THEME) {
      delete document.documentElement.dataset['theme'];
    } else {
      document.documentElement.dataset['theme'] = theme;
    }
  }

  async load(): Promise<ThemeId> {
    const stored = await this.storage.get<string>(STORAGE_KEYS.theme, DEFAULT_THEME);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  }

  async save(theme: ThemeId): Promise<void> {
    await this.storage.set(STORAGE_KEYS.theme, theme);
  }

  /**
   * Lê a cor de acento em vigor.
   *
   * O canvas do AI Core precisa dela como valor concreto: um `<canvas>` não
   * resolve `var(--accent)` sozinho.
   */
  readAccentColor(): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    return value.length > 0 ? value : '#00CFFF';
  }
}

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export const themeService = new ThemeService();
