/** Formatação partilhada. Tudo em pt-PT, como o resto da interface. */

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Bytes em unidade legível: 5_872_025_600 → "5,5 GB". */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  const unit = BYTE_UNITS[exponent] ?? 'B';

  return `${value.toFixed(exponent === 0 ? 0 : decimals).replace('.', ',')} ${unit}`;
}

/** Ritmo de rede: 11_000_000 → "11,0 MB/s". */
export function formatBytesPerSecond(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatPercent(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals).replace('.', ',')}%`;
}

const timeFormatter = new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' });

const longDateFormatter = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const shortDateFormatter = new Intl.DateTimeFormat('pt-PT', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatLongDate(date: Date): string {
  return longDateFormatter.format(date);
}

/** Data curta em maiúsculas para o header: "DOM 27 JUL". */
export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date).replace(/\./g, '').toUpperCase();
}
