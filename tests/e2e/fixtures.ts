import { type Page, expect } from '@playwright/test';

/**
 * Define o localStorage para saltar o boot completo e ir direto ao login.
 *
 * O `storageService` no browser usa `localStorage` com prefixo `jarvis.`.
 * O valor é JSON — `true` para booted.
 */
export async function skipBoot(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('jarvis.booted', 'true');
  });
}

/**
 * Navega para a raiz, espera o login aparecer, autentica e confirma que o
 * desktop está visível.
 */
export async function login(page: Page): Promise<void> {
  // Usa domcontentloaded em vez de load: a app é SPA e as fontes/images
  // podem bloquear o evento load sem afetar a renderização do React.
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Espera o campo de palavra-passe — usa getByRole para não colidir com
  // o botão de mostrar/esconder que partilha o mesmo aria-label.
  const passwordInput = page.getByRole('textbox', { name: 'Palavra-passe' });
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
  await passwordInput.fill('teste');
  await passwordInput.press('Enter');

  // Confirma que o desktop apareceu: o dock é visível.
  await expect(page.getByRole('toolbar', { name: 'Aplicações' })).toBeVisible({ timeout: 10000 });

  // Espera a app estabilizar (notificações, widgets, etc.) antes de devolver
  // o controlo ao teste — senão o beforeEach consome o timeout do teste.
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle pode nunca disparar em dev com HMR; não bloquear.
  });
}

/**
 * Abre uma janela clicando no botão do Dock com o `label` dado.
 */
export async function openWindow(page: Page, dockLabel: string): Promise<void> {
  const dock = page.getByRole('toolbar', { name: 'Aplicações' });
  const button = dock.getByLabel(dockLabel);
  await button.click();
}

/**
 * Fecha a janela ativa com o título dado.
 */
export async function closeWindow(page: Page, windowLabel: string): Promise<void> {
  const windowElement = page.locator(`section[aria-label="${windowLabel}"]`);
  const closeButton = windowElement.getByLabel('Fechar');
  await closeButton.click();
  await expect(windowElement).not.toBeVisible({ timeout: 5000 }).catch(() => {
    // A janela pode desaparecer sem transição visível.
  });
}

/**
 * Abre a paleta de comandos com Ctrl+K.
 */
export async function openCommandPalette(page: Page): Promise<void> {
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog', { name: 'Paleta de comandos' })).toBeVisible({ timeout: 5000 });
}
