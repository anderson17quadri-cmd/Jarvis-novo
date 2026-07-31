import { DEFAULT_THEME, THEMES, type ThemeId, type ThemeOverrides } from '@/design-system/tokens';
import { deriveOverrides, isCustomThemeId, type CustomTheme } from '@/types/custom-theme';
import { storageService, STORAGE_KEYS, type StorageService } from './storage-service';

/**
 * As variáveis CSS que um tema personalizado escreve, e o nome de cada uma.
 *
 * Um tema oficial vive no `themes.css`, num bloco `[data-theme="…"]`. Um tema
 * feito agora não pode viver lá — não existia quando o CSS foi escrito — por
 * isso escreve-se em linha no `<html>`, onde ganha aos blocos por
 * especificidade. É a única diferença entre os dois; o resto do sistema não
 * distingue um do outro.
 */
const CSS_VARIABLES: Readonly<Record<keyof ThemeOverrides, string>> = {
  bg: '--bg',
  bg2: '--bg-2',
  card: '--card',
  cardHover: '--card-hover',
  accent: '--accent',
  neon: '--neon',
  glow: '--glow',
  line: '--line',
  line2: '--line-2',
  t1: '--t1',
  t2: '--t2',
  t3: '--t3',
  tintRgb: '--tint-rgb',
  glassRgb: '--glass-rgb',
  glassDeepRgb: '--glass-deep-rgb',
};

/**
 * Temas.
 *
 * O tema aplica-se num único sítio — o atributo `data-theme` no `<html>`. Todo
 * o resto do sistema já aponta para variáveis CSS, por isso a troca é
 * instantânea e não obriga a repintar nada à mão.
 */
export class ThemeService {
  constructor(private readonly storage: StorageService = storageService) {}

  /**
   * O tema base não leva atributo — é o `:root`.
   *
   * `custom` é passado por quem o conhece: o serviço não importa a store dos
   * temas personalizados, pela mesma razão que não importa nenhuma outra.
   */
  apply(theme: ThemeId, custom: CustomTheme | null = null): void {
    const root = document.documentElement;

    // Limpar sempre o que um tema personalizado anterior escreveu: sem isto,
    // voltar a um oficial deixava metade das cores do antigo em vigor.
    for (const variable of Object.values(CSS_VARIABLES)) root.style.removeProperty(variable);

    if (isCustomThemeId(theme) && custom) {
      // `data-theme="custom"` para o CSS poder reagir ao facto de haver um,
      // sem precisar de saber qual.
      root.dataset['theme'] = 'custom';

      const overrides = deriveOverrides(custom);
      for (const [key, variable] of Object.entries(CSS_VARIABLES)) {
        const value = overrides[key as keyof ThemeOverrides];
        if (value !== undefined) root.style.setProperty(variable, value);
      }
      return;
    }

    if (theme === DEFAULT_THEME) delete root.dataset['theme'];
    else root.dataset['theme'] = theme;
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

/**
 * `true` para um tema oficial ou para um identificador de tema personalizado.
 *
 * Não verifica se o personalizado ainda existe — quem lê a preferência tem a
 * lista à mão e faz essa verificação; aqui só se valida a forma.
 */
export function isThemeId(value: string): value is ThemeId {
  return isCustomThemeId(value) || THEMES.some((theme) => theme.id === value);
}

export const themeService = new ThemeService();
