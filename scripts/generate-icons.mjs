/**
 * Gera os ícones da aplicação sem dependências externas.
 *
 * Desenha o núcleo do JARVIS — fundo escuro, anéis concêntricos em ciano e um
 * ponto central — com as cores de `src/design-system/tokens.ts`, e escreve:
 *
 * - `src-tauri/icons/` — os PNG e o ICO que o Tauri exige
 * - `public/` — os PNG do manifesto da PWA (192, 512 e a versão `maskable`)
 *
 * Sem dependências de propósito: um gerador de ícones que precisasse de
 * ImageMagick ou de um browser deixava de correr no primeiro ambiente onde
 * eles não existissem, e os ícones ficavam desatualizados sem ninguém dar por
 * isso. Aqui é PNG escrito à mão — cabeçalho, `deflate` e CRC.
 *
 * Correr com: `node scripts/generate-icons.mjs`
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src-tauri', 'icons');
const PUBLIC_DIR = join(ROOT, 'public');

// Tokens do design system (COLORS.bg, COLORS.accent, COLORS.neon).
const BG = [0x05, 0x07, 0x0a];
const ACCENT = [0x00, 0xcf, 0xff];
const NEON = [0x00, 0xa2, 0xff];

/** Anéis do núcleo, em fração do raio: [raio, espessura, opacidade, cor]. */
const RINGS = [
  [0.92, 0.035, 0.35, NEON],
  [0.74, 0.055, 0.85, ACCENT],
  [0.54, 0.03, 0.55, ACCENT],
  [0.36, 0.05, 0.7, NEON],
];

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Mistura `fg` sobre `bg` com opacidade `a`. */
function blend(bg, fg, a) {
  return [
    Math.round(bg[0] + (fg[0] - bg[0]) * a),
    Math.round(bg[1] + (fg[1] - bg[1]) * a),
    Math.round(bg[2] + (fg[2] - bg[2]) * a),
  ];
}

/**
 * Desenha um ícone.
 *
 * `fullBleed` enche o quadrado com o fundo em vez de deixar os cantos
 * transparentes, e `coreScale` encolhe o desenho — as duas coisas de que a
 * variante `maskable` do Android precisa, porque o sistema recorta o ícone à
 * forma que quiser e só garante os 80% centrais.
 */
function renderIcon(size, { fullBleed = false, coreScale = 1 } = {}) {
  const center = (size - 1) / 2;
  const radius = (size / 2) * coreScale;
  // RGBA, uma linha de filtro (0) por scanline.
  const raw = Buffer.alloc(size * (size * 4 + 1));

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;

    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.hypot(dx, dy) / radius;

      let color = BG;
      let alpha = 0;

      // Disco de fundo, com uma borda suave para não ficar serrilhado. Em
      // `fullBleed` não há borda nenhuma: o fundo vai até aos cantos.
      if (fullBleed) alpha = 1;
      else if (dist <= 1) alpha = Math.min(1, (1 - dist) * size * 0.5);

      if (alpha > 0) {
        for (const [r, thickness, opacity, ringColor] of RINGS) {
          const edge = Math.abs(dist - r);
          if (edge < thickness) {
            const strength = (1 - edge / thickness) * opacity;
            color = blend(color, ringColor, strength);
          }
        }
        // Núcleo central.
        if (dist < 0.16) color = blend(color, [0xf2, 0xfe, 0xff], 1 - dist / 0.16);
      }

      const p = rowStart + 1 + x * 4;
      raw[p] = color[0];
      raw[p + 1] = color[1];
      raw[p + 2] = color[2];
      raw[p + 3] = Math.round(alpha * 255);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profundidade de bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO com carga PNG — suportado pelo Windows desde o Vista. */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // tipo: ícone
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // 0 significa 256
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0; // paleta
    entry[3] = 0;
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por pixel
    entry.writeUInt32BE(data.length, 8);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

mkdirSync(OUT_DIR, { recursive: true });

const sizes = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon.png', 512],
  ['Square30x30Logo.png', 30],
  ['Square44x44Logo.png', 44],
  ['Square71x71Logo.png', 71],
  ['Square89x89Logo.png', 89],
  ['Square107x107Logo.png', 107],
  ['Square142x142Logo.png', 142],
  ['Square150x150Logo.png', 150],
  ['Square284x284Logo.png', 284],
  ['Square310x310Logo.png', 310],
  ['StoreLogo.png', 50],
];

for (const [name, size] of sizes) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size));
}

writeFileSync(
  join(OUT_DIR, 'icon.ico'),
  buildIco([16, 32, 48, 256].map((size) => ({ size, data: renderIcon(size) }))),
);

/*
 * Ícones do manifesto da PWA.
 *
 * Os dois `any` mantêm os cantos transparentes — é assim que ficam bem numa
 * barra de tarefas. O `maskable` enche o quadrado e encolhe o núcleo para 62%,
 * dentro da zona segura de 80% que o Android garante.
 */
writeFileSync(join(PUBLIC_DIR, 'icon-192.png'), renderIcon(192));
writeFileSync(join(PUBLIC_DIR, 'icon-512.png'), renderIcon(512));
writeFileSync(
  join(PUBLIC_DIR, 'icon-maskable-512.png'),
  renderIcon(512, { fullBleed: true, coreScale: 0.62 }),
);

console.log(`Ícones escritos em ${OUT_DIR} e em ${PUBLIC_DIR}`);
