import { expect, test } from '@playwright/test';
import { closeWindow, login, openWindow, skipBoot } from './fixtures';

test.describe('Temas', () => {
  test.beforeEach(async ({ page }) => {
    await skipBoot(page);
    await login(page);
  });

  test('muda para o tema OLED Black e verifica o atributo data-theme', async ({ page }) => {
    // Abre a janela de Personalização.
    await openWindow(page, 'Personalização');

    const themesWindow = page.locator('section[aria-label="Personalização"]');
    await expect(themesWindow).toBeVisible({ timeout: 5000 });

    // Clica no tema OLED Black dentro do radiogroup.
    const oledRadio = page.getByRole('radio', { name: 'OLED Black' });
    await oledRadio.scrollIntoViewIfNeeded();
    await oledRadio.click();

    // O tema é aplicado como data-theme no <html>.
    await expect(page.locator('html[data-theme="oled"]')).toBeAttached({ timeout: 5000 });

    // Volta ao tema clássico. O tema Classic é o DEFAULT — o serviço remove
    // o atributo data-theme (delete root.dataset['theme']) em vez de o pôr a
    // "classic". Por isso verificamos a AUSÊNCIA do atributo de tema.
    const classicRadio = page.getByRole('radio', { name: 'JARVIS Classic' });
    await classicRadio.scrollIntoViewIfNeeded();
    await classicRadio.click();

    await expect(page.locator('html:not([data-theme])')).toBeAttached({ timeout: 5000 });

    // Fecha.
    await closeWindow(page, 'Personalização');
  });

  test('tema claro (Arctic White) aplica-se corretamente', async ({ page }) => {
    await openWindow(page, 'Personalização');

    const arcticRadio = page.getByRole('radio', { name: 'Arctic White' });
    await arcticRadio.scrollIntoViewIfNeeded();
    await arcticRadio.click();

    await expect(page.locator('html[data-theme="arctic"]')).toBeAttached({ timeout: 5000 });
  });
});
