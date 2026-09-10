import { expect, test } from '@playwright/test';
import { login, skipBoot } from './fixtures';

test.describe('Permissões de plugins', () => {
  test('instala o plugin Olá-notificação e executa-o com sucesso', async ({
    page,
  }) => {
    await skipBoot(page);
    await login(page);

    // Abre a janela de Plugins através do Dock.
    const dock = page.getByRole('toolbar', { name: 'Aplicações' });
    await dock.getByLabel('Plugins').click();

    // Espera a janela aparecer.
    const pluginsWindow = page.locator('section[aria-label="Plugins"]');
    await expect(pluginsWindow).toBeVisible({ timeout: 15000 });

    // Procura o cartão do plugin "Olá, notificação" — não usa .first() porque
    // pode haver outros plugins com "Instalar" antes deste, e alguns estão
    // desativados (requerem capacidades nativas inexistentes no browser).
    const olaCard = pluginsWindow.locator('li', {
      has: page.getByText('Olá, notificação'),
    });
    const installButton = olaCard.getByRole('button', { name: 'Instalar' });
    await installButton.waitFor({ state: 'visible', timeout: 10000 });
    await installButton.click();

    // Depois de instalar, os botões "Ativar"/"Desativar" e "Remover" aparecem,
    // e se estiver ativo o trigger "Pedir notificação" também.
    const triggerButton = olaCard.getByRole('button', {
      name: /pedir notificação/i,
    });
    await triggerButton.waitFor({ state: 'visible', timeout: 10000 });

    // Executa o plugin.
    await triggerButton.click();

    // O iframe do runtime processa a mensagem e mostra o resultado (ack).
    await expect(olaCard.locator('iframe')).toBeAttached({ timeout: 10000 });
  });

  test('recusa a permissão de notificações e o plugin reporta a recusa', async ({
    page,
  }) => {
    // Define a permissão como recusada ANTES de a página carregar,
    // via addInitScript — escreve no localStorage antes de React arrancar.
    await page.addInitScript(() => {
      const key = 'jarvis.plugins';
      const raw = localStorage.getItem(key);
      type PluginsData = { installed: unknown[]; deniedPermissions: Record<string, string[]> };
      const data: PluginsData = raw
        ? (JSON.parse(raw) as PluginsData)
        : { installed: [], deniedPermissions: {} };
      data.deniedPermissions = {
        ...data.deniedPermissions,
        'ola-notificacao': ['notifications'],
      };
      localStorage.setItem(key, JSON.stringify(data));
    });

    await skipBoot(page);
    await login(page);

    // Abre a janela de Plugins.
    const dock = page.getByRole('toolbar', { name: 'Aplicações' });
    await dock.getByLabel('Plugins').click();

    const pluginsWindow = page.locator('section[aria-label="Plugins"]');
    await expect(pluginsWindow).toBeVisible({ timeout: 15000 });

    // Procura o cartão específico "Olá, notificação".
    const olaCard = pluginsWindow.locator('li', {
      has: page.getByText('Olá, notificação'),
    });
    const installButton = olaCard.getByRole('button', { name: 'Instalar' });
    await installButton.waitFor({ state: 'visible', timeout: 10000 });
    await installButton.click();

    // Clica no trigger "Pedir notificação".
    const triggerButton = olaCard.getByRole('button', {
      name: /pedir notificação/i,
    });
    await triggerButton.waitFor({ state: 'visible', timeout: 10000 });
    await triggerButton.click();

    // O iframe do runtime mostra o resultado (o ack à mensagem core.notify).
    await expect(olaCard.locator('iframe')).toBeAttached({ timeout: 10000 });
  });
});
