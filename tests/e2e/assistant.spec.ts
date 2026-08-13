import { expect, test } from '@playwright/test';
import { login, openWindow, skipBoot } from './fixtures';

test.describe('Assistente', () => {
  test.beforeEach(async ({ page }) => {
    await skipBoot(page);
    await login(page);
  });

  test('abre a janela e responde a uma pergunta pelo provedor local', async ({ page }) => {
    await openWindow(page, 'Assistente');

    const assistantWindow = page.locator('section[aria-label="Assistente JARVIS"]');
    await expect(assistantWindow).toBeVisible({ timeout: 10000 });

    // Sem provedor configurado, o RuleProvider responde a sério às horas — é
    // o único fluxo do assistente exercitável no browser, onde não há chave
    // nem rede para o modelo pedir ferramentas.
    const input = page.getByRole('textbox', { name: 'Comando para o assistente' });
    await input.fill('que horas são');
    await input.press('Enter');

    await expect(assistantWindow.getByText(/São \d{2}:\d{2}\./)).toBeVisible({ timeout: 15000 });
  });
});
