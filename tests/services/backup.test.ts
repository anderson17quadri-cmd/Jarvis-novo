import { beforeEach, describe, expect, it } from 'vitest';

import { createBackup, restoreBackup, serializeBackup } from '@/services/backup-service';
import { storageService, STORAGE_KEYS } from '@/services/storage-service';
import { useTaskStore } from '@/stores/use-task-store';
import { useThemeStore } from '@/stores/use-theme-store';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupFilename,
  readBackup,
  withoutSecrets,
} from '@/types/backup';

/**
 * Cópias de segurança (Parte 14 §Backups e restauro).
 *
 * O que se prova aqui: que a chave da API não sai no ficheiro, que repor uma
 * cópia antiga não apaga o que ela não conhece, e que um ficheiro que não seja
 * uma cópia é recusado antes de tocar em nada.
 */

beforeEach(() => {
  localStorage.clear();
});

describe('criar', () => {
  it('leva o que está guardado', async () => {
    await storageService.set(STORAGE_KEYS.theme, 'oled');
    await storageService.set(STORAGE_KEYS.tasks, [{ id: 't1', title: 'testar' }]);

    const backup = await createBackup(1_700_000_000_000);

    expect(backup.format).toBe(BACKUP_FORMAT);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.createdAt).toBe(1_700_000_000_000);
    expect(backup.data[STORAGE_KEYS.theme]).toBe('oled');
    expect(backup.data[STORAGE_KEYS.tasks]).toEqual([{ id: 't1', title: 'testar' }]);
  });

  it('não leva chaves que nunca foram escritas', async () => {
    await storageService.set(STORAGE_KEYS.theme, 'solar');

    const backup = await createBackup();

    expect(Object.keys(backup.data)).toEqual([STORAGE_KEYS.theme]);
  });

  it('**não leva a chave da API**, e leva o resto das definições de IA', async () => {
    await storageService.set(STORAGE_KEYS.aiSettings, {
      provider: 'deepseek',
      apiKey: 'sk-um-segredo-a-sério',
      model: 'deepseek-chat',
    });

    const backup = await createBackup();
    const settings = backup.data[STORAGE_KEYS.aiSettings];

    expect(settings).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
    // A prova que interessa: o segredo não está no ficheiro, escreva-se ele
    // onde se escrever.
    expect(serializeBackup(backup)).not.toContain('sk-um-segredo');
  });

  it('não leva a chave da NewsAPI quando a plataforma não tem cofre', async () => {
    // No browser e no Android não há cofre: a chave fica no storage normal
    // (`useNewsSettingsStore`), e a cópia de segurança tem de a apagar à mesma.
    await storageService.set(STORAGE_KEYS.newsSettings, {
      apiKey: '0123456789abcdef0123456789abcdef',
      country: 'pt',
    });

    const backup = await createBackup();

    expect(backup.data[STORAGE_KEYS.newsSettings]).toEqual({ country: 'pt' });
    expect(serializeBackup(backup)).not.toContain('0123456789abcdef');
  });

  it('o mesmo para a chave da Brave Search e a palavra-passe do correio', async () => {
    await storageService.set(STORAGE_KEYS.webSearchSettings, {
      apiKey: 'chave-brave-a-sério',
    });
    await storageService.set(STORAGE_KEYS.mailSettings, {
      imapServer: 'imap.exemplo.pt',
      imapPort: 993,
      smtpServer: 'smtp.exemplo.pt',
      smtpPort: 587,
      username: 'eu@exemplo.pt',
      password: 'palavra-passe-a-sério',
    });

    const texto = serializeBackup(await createBackup());

    expect(texto).not.toContain('chave-brave-a-sério');
    expect(texto).not.toContain('palavra-passe-a-sério');
    expect((await createBackup()).data[STORAGE_KEYS.mailSettings]).not.toHaveProperty('password');
  });

  it('o campo do segredo é apagado, e não posto a vazio', () => {
    const clean = withoutSecrets(STORAGE_KEYS.aiSettings, {
      provider: 'deepseek',
      apiKey: 'sk-abc',
    });

    // Uma string vazia parecia uma chave definida e por definir. Ausente diz o
    // que é: não veio na cópia.
    expect(Object.keys(clean as object)).not.toContain('apiKey');
  });

  it('o ficheiro sai sempre com as chaves pela mesma ordem', async () => {
    await storageService.set(STORAGE_KEYS.workspace, { a: 1 });
    await storageService.set(STORAGE_KEYS.theme, 'classic');
    await storageService.set(STORAGE_KEYS.appearance, { b: 2 });

    const first = serializeBackup(await createBackup(0));
    const second = serializeBackup(await createBackup(0));

    expect(first).toBe(second);
    expect(Object.keys((await createBackup()).data)).toEqual(
      [...Object.keys((await createBackup()).data)].sort(),
    );
  });
});

describe('ler um ficheiro', () => {
  it('aceita uma cópia a sério', async () => {
    await storageService.set(STORAGE_KEYS.theme, 'aurora');
    const result = readBackup(serializeBackup(await createBackup()));

    expect(result.ok).toBe(true);
    expect(result.ok && result.backup.data[STORAGE_KEYS.theme]).toBe('aurora');
  });

  it.each([
    ['isto não é json {{{', 'nao-e-json'],
    ['null', 'nao-e-uma-copia'],
    ['{"format":"outra-coisa","version":1,"data":{}}', 'nao-e-uma-copia'],
    ['{"format":"jarvis-backup","version":99,"data":{"theme":"oled"}}', 'versao-mais-recente'],
    ['{"format":"jarvis-backup","version":1,"data":{}}', 'sem-dados'],
  ])('recusa %s', (text, problem) => {
    const result = readBackup(text);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toBe(problem);
  });

  it('descarta chaves que esta versão não conhece', () => {
    const result = readBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        version: 1,
        data: { theme: 'oled', 'coisa-do-futuro': { x: 1 } },
      }),
    );

    expect(result.ok).toBe(true);
    expect(result.ok && Object.keys(result.backup.data)).toEqual([STORAGE_KEYS.theme]);
  });

  it('uma cópia só com chaves desconhecidas não tem nada para repor', () => {
    const result = readBackup(
      JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: { 'coisa-do-futuro': 1 } }),
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toBe('sem-dados');
  });
});

describe('repor', () => {
  it('escreve o que a cópia traz e volta a ler para as stores', async () => {
    await storageService.set(STORAGE_KEYS.theme, 'oled');
    const backup = await createBackup();

    await storageService.set(STORAGE_KEYS.theme, 'solar');
    useThemeStore.setState({ theme: 'solar' });

    const sections = await restoreBackup(backup);

    expect(sections).toBe(1);
    expect(await storageService.get(STORAGE_KEYS.theme, null)).toBe('oled');
    // A parte que interessa: a store viva também mudou, sem recarregar nada.
    expect(useThemeStore.getState().theme).toBe('oled');
  });

  it('não apaga o que a cópia não conhece', async () => {
    // Uma cópia antiga, de quando ainda não havia tarefas guardadas.
    await storageService.set(STORAGE_KEYS.theme, 'midnight');
    const antiga = await createBackup();

    await storageService.set(STORAGE_KEYS.tasks, [{ id: 't1', title: 'não me apagues' }]);

    await restoreBackup(antiga);

    expect(await storageService.get(STORAGE_KEYS.tasks, null)).toEqual([
      { id: 't1', title: 'não me apagues' },
    ]);
  });

  it('as tarefas voltam mesmo depois de a store já ter sido lida uma vez', async () => {
    await storageService.set(STORAGE_KEYS.tasks, [
      { id: 't1', title: 'da cópia', isDone: false, priority: 'media', createdAt: 0 },
    ]);
    const backup = await createBackup();

    // A store de tarefas lê-se sozinha à primeira, e depois não repete. Sem
    // ela na lista do `hydrateAll`, repor uma cópia não trazia as tarefas de
    // volta até se recarregar a aplicação.
    await useTaskStore.getState().hydrate();
    await storageService.set(STORAGE_KEYS.tasks, []);
    await useTaskStore.getState().hydrate();

    await restoreBackup(backup);

    expect(useTaskStore.getState().tasks.map((task) => task.title)).toContain('da cópia');
  });

  it('uma cópia dá para ir e voltar sem perder nada', async () => {
    await storageService.set(STORAGE_KEYS.theme, 'graphite');
    await storageService.set(STORAGE_KEYS.appearance, { wallpaper: 'liso', uiScale: 1.15 });

    const texto = serializeBackup(await createBackup());
    localStorage.clear();

    const result = readBackup(texto);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await restoreBackup(result.backup);

    expect(await storageService.get(STORAGE_KEYS.theme, null)).toBe('graphite');
    expect(await storageService.get(STORAGE_KEYS.appearance, null)).toMatchObject({
      wallpaper: 'liso',
      uiScale: 1.15,
    });
  });
});

describe('o nome do ficheiro', () => {
  it('leva a data, com dois dígitos', () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe('jarvis-2026-01-05.json');
    expect(backupFilename(new Date(2026, 11, 31))).toBe('jarvis-2026-12-31.json');
  });
});
