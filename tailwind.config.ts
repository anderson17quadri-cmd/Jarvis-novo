import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';
import { RADIUS, SPACING, LAYOUT, EASING, DURATION, SHADOW, BREAKPOINTS } from './src/design-system/tokens';

/**
 * Tema do Tailwind gerado a partir de `src/design-system/tokens.ts`.
 *
 * As cores apontam para variáveis CSS em vez de valores literais: é isso que
 * permite trocar de tema em runtime com `data-theme` sem recompilar nada.
 * Os tokens que não mudam por tema (raios, espaços, durações, curvas) vêm
 * diretamente do ficheiro de tokens.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    /**
     * Pontos de quebra em `max-width`, como no protótipo: o desktop é a base e
     * cada variante retira coisas à medida que o ecrã encolhe. Com os `min-width`
     * do Tailwind por omissão, `compact:` significaria "ecrã grande" — o oposto.
     */
    screens: {
      rail: { max: `${BREAKPOINTS.rail}px` },
      compact: { max: `${BREAKPOINTS.compact}px` },
      tight: { max: `${BREAKPOINTS.tight}px` },
    },
    extend: {
      colors: {
        bg: 'var(--bg)',
        bg2: 'var(--bg2)',
        card: 'var(--card)',
        'card-hover': 'var(--card-hover)',
        line: 'var(--line)',
        'line-2': 'var(--line-2)',
        t1: 'var(--t1)',
        t2: 'var(--t2)',
        t3: 'var(--t3)',
        accent: 'var(--accent)',
        neon: 'var(--neon)',
        ok: 'var(--green)',
        warn: 'var(--yellow)',
        danger: 'var(--red)',
      },
      borderRadius: {
        btn: RADIUS.btn,
        card: RADIUS.card,
        modal: RADIUS.modal,
        input: RADIUS.input,
      },
      spacing: {
        s1: SPACING.s1,
        s2: SPACING.s2,
        s3: SPACING.s3,
        s4: SPACING.s4,
        s5: SPACING.s5,
        s6: SPACING.s6,
        header: LAYOUT.headerHeight,
        rail: LAYOUT.railWidth,
        'rail-open': LAYOUT.railWidthOpen,
        // Respeitar o notch e a barra inferior no Android.
        'safe-t': 'env(safe-area-inset-top, 0px)',
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-l': 'env(safe-area-inset-left, 0px)',
        'safe-r': 'env(safe-area-inset-right, 0px)',
      },
      height: { header: 'var(--header-h)' },
      width: { rail: 'var(--rail-w)', 'rail-open': 'var(--rail-w-open)' },
      transitionTimingFunction: {
        out: EASING.out,
        io: EASING.inOut,
      },
      transitionDuration: {
        hover: DURATION.hover,
        click: DURATION.click,
        panel: DURATION.panel,
        window: DURATION.window,
        theme: DURATION.theme,
        screen: DURATION.screen,
      },
      boxShadow: {
        1: SHADOW.sh1,
        2: SHADOW.sh2,
        glow: 'var(--glow)',
      },
      backdropBlur: {
        panel: '30px',
        glass: '40px',
        soft: '12px',
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        h1: ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '300' }],
        h2: ['36px', { letterSpacing: '-0.015em', fontWeight: '300' }],
        h3: ['22px', { letterSpacing: '-0.01em', fontWeight: '600' }],
        sub: ['18px', { fontWeight: '400' }],
        body: ['16px', {}],
        desc: ['14px', {}],
        cap: ['12px', { letterSpacing: '0.06em' }],
        label: ['11px', { letterSpacing: '0.16em', fontWeight: '600' }],
      },
      zIndex: {
        wallpaper: '0',
        desktop: '10',
        stage: '15',
        rail: '35',
        header: '40',
        dock: '45',
        // A gaveta do compacto e o seu scrim ficam acima do dock: com a gaveta
        // aberta, nada por baixo é clicável.
        scrim: '46',
        drawer: '47',
        window: '50',
        toast: '150',
        palette: '200',
        context: '300',
        login: '500',
        boot: '600',
        cursor: '9999',
      },
      keyframes: {
        breathe: {
          '0%,100%': { opacity: '.5', transform: 'scale(.85)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        'window-in': {
          from: { opacity: '0', transform: 'scale(.95)', filter: 'blur(6px)' },
          to: { opacity: '1', transform: 'none', filter: 'none' },
        },
        'window-out': {
          to: { opacity: '0', transform: 'scale(.95)', filter: 'blur(6px)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateX(44px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'toast-out': {
          to: { opacity: '0', transform: 'translateX(44px)' },
        },
        shake: {
          '10%,90%': { transform: 'translateX(-2px)' },
          '30%,70%': { transform: 'translateX(5px)' },
          '50%': { transform: 'translateX(-7px)' },
        },
        blink: { '50%': { opacity: '0' } },
      },
      animation: {
        breathe: `breathe 2.6s ${EASING.inOut} infinite`,
        'window-in': `window-in ${DURATION.window} ${EASING.out}`,
        'window-out': `window-out ${DURATION.panel} ${EASING.inOut} forwards`,
        'toast-in': `toast-in 250ms ${EASING.out}`,
        'toast-out': `toast-out 250ms ${EASING.inOut} forwards`,
        shake: `shake 420ms ${EASING.inOut}`,
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
