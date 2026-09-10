import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    /**
     * O Vitest 4 reescreveu o sistema de spies — o vi.spyOn já não restaura
     * automaticamente o espião anterior quando se cria outro sobre o mesmo
     * método. Com restoreMocks: true, o framework chama vi.restoreAllMocks()
     * após cada teste, repondo o método original para o teste seguinte.
     *
     * Sem isto, o histórico de chamadas acumula entre testes dentro do mesmo
     * ficheiro (login-sound, boot-sound), e testes que confirmam a AUSÊNCIA
     * de um som falham porque o som TINHA sido chamado no teste anterior.
     */
    restoreMocks: true,
  },
});
