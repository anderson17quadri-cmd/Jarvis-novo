/**
 * Indicador de força da palavra-passe (Parte 5 §Campo de senha).
 *
 * Heurística deliberadamente simples e local: nunca sai do dispositivo, não
 * consulta listas e não bloqueia a entrada. Serve para informar, não para impor.
 */

export type PasswordStrength = 'vazia' | 'fraca' | 'media' | 'forte' | 'excelente';

export interface StrengthResult {
  readonly level: PasswordStrength;
  readonly label: string;
  /** 0 a 100, para a barra. */
  readonly percent: number;
  /** Token de cor do design system. */
  readonly color: 'danger' | 'warn' | 'accent' | 'ok';
}

export function measurePasswordStrength(password: string): StrengthResult {
  if (password.length === 0) {
    return { level: 'vazia', label: '', percent: 0, color: 'danger' };
  }

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;

  if (score <= 1) return { level: 'fraca', label: 'Fraca', percent: 25, color: 'danger' };
  if (score === 2) return { level: 'media', label: 'Média', percent: 50, color: 'warn' };
  if (score === 3) return { level: 'forte', label: 'Forte', percent: 75, color: 'accent' };
  return { level: 'excelente', label: 'Excelente', percent: 100, color: 'ok' };
}
