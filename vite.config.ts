import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * O Tauri define TAURI_ENV_* quando corre `tauri dev`/`tauri build`.
 * Usamo-los para escolher o alvo de compilação e o host do servidor de
 * desenvolvimento (o Android precisa de escutar em 0.0.0.0).
 */
const host = process.env['TAURI_DEV_HOST'];
const platform = process.env['TAURI_ENV_PLATFORM'];
const isDebug = process.env['TAURI_ENV_DEBUG'] === 'true';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  // O Tauri espera um porto fixo e falha se não estiver disponível.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host ?? false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // O Vite não deve vigiar o lado Rust — o `cargo` trata disso. Também
      // não deve vigiar worktrees isolados de forks (`.claude/worktrees/`,
      // cada um uma cópia completa do repositório, com o seu próprio
      // `index.html`/`tsconfig.json`) — sem isto, uma edição nesse worktree
      // isolado disparava um full-reload aqui com o tsconfig errado,
      // deixando a app a servir um estado partido até se reiniciar.
      ignored: ['**/src-tauri/**', '**/.claude/worktrees/**'],
    },
  },

  envPrefix: ['VITE_', 'TAURI_ENV_'],

  build: {
    // O WebView do Windows suporta ES2021; o do Android é mais recente.
    target: platform === 'windows' ? 'chrome105' : 'safari15',
    minify: isDebug ? false : 'esbuild',
    sourcemap: isDebug,
    rollupOptions: {
      output: {
        // Os módulos pesados saem em chunks próprios para o lazy loading valer.
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
