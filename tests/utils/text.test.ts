import { describe, expect, it } from 'vitest';

import { normalizeSearch } from '@/utils/text';

describe('normalização para pesquisa', () => {
  it('tira acentos', () => {
    expect(normalizeSearch('Personalização')).toBe('personalizacao');
    expect(normalizeSearch('Notificações')).toBe('notificacoes');
    expect(normalizeSearch('Automações')).toBe('automacoes');
  });

  it('ignora caixa e espaços à volta', () => {
    expect(normalizeSearch('  EMERALD ')).toBe('emerald');
  });

  it('mantém os espaços do meio, para pesquisas de duas palavras', () => {
    expect(normalizeSearch('Ciência Hoje')).toBe('ciencia hoje');
  });

  it('o cedilha também cai, e é isso que se quer', () => {
    // O NFD decompõe o "ç" em "c" + cedilha, e a cedilha entra na mesma gama
    // dos acentos. Resultado: quem escreve "acao" encontra "ação".
    expect(normalizeSearch('ação')).toBe('acao');
  });

  it('texto sem acentos passa incólume', () => {
    expect(normalizeSearch('spotify')).toBe('spotify');
  });
});
