import { expect, test } from '@playwright/test';
import { closeWindow, login, openCommandPalette, openWindow, skipBoot } from './fixtures';

test.describe('Janelas', () => {
  test.beforeEach(async ({ page }) => {
    await skipBoot(page);
    await login(page);
  });

  test('abre Tarefas pelo Dock e fecha pelo botão da janela', async ({ page }) => {
    await openWindow(page, 'Email');

    // A janela aparece.
    const windowElement = page.locator('section[aria-label="Emails"]');
    await expect(windowElement).toBeVisible({ timeout: 5000 });

    // Fecha pelo botão X.
    await closeWindow(page, 'Emails');
    await expect(windowElement).not.toBeVisible({ timeout: 5000 });
  });

  test('abre uma janela pela Command Palette', async ({ page }) => {
    await openCommandPalette(page);

    // Escreve "abrir tarefas" — mais específico que só "tarefas", que podia
    // bater em emails ou notificações com a mesma palavra.
    const searchInput = page.getByPlaceholder(/pesquisar/i);
    await searchInput.fill('tarefas');

    // Seleciona o comando específico "Abrir Tarefas" da lista.
    const tasksOption = page.getByRole('option', { name: /Abrir Tarefas/i });
    await expect(tasksOption).toBeVisible({ timeout: 5000 });
    await tasksOption.click();

    // Aguarda um frame para a janela ter tempo de aparecer.
    await page.waitForTimeout(300);

    // A janela de Tarefas aparece.
    await expect(page.locator('section[aria-label="Tarefas"]')).toBeVisible({ timeout: 10000 });
  });
});
