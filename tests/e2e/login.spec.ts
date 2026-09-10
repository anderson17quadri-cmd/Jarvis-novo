import { expect, test } from '@playwright/test';
import { login, skipBoot } from './fixtures';

test.describe('Login', () => {
  test('com palavra-passe válida, entra no desktop', async ({ page }) => {
    await skipBoot(page);
    await login(page);

    // O desktop está ativo: o Wallpaper renderiza (camada nebula sempre visível).
    await expect(page.locator('div.wp-nebula')).toBeAttached({ timeout: 15000 });
  });

  test('com palavra-passe vazia, mostra erro e não entra', async ({ page }) => {
    await skipBoot(page);
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const passwordInput = page.getByRole('textbox', { name: 'Palavra-passe' });
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    // Deixa o campo vazio e submete.
    await passwordInput.fill('');
    await passwordInput.press('Enter');

    // A mensagem de erro aparece.
    await expect(page.getByText('Não foi possível verificar a identidade')).toBeVisible({ timeout: 5000 });
  });
});
