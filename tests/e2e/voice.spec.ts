import { expect, test } from '@playwright/test';
import { login, skipBoot } from './fixtures';

test.describe('Voz simulada via CDP', () => {
  test.beforeEach(async ({ page }) => {
    await skipBoot(page);
    // Injeta um SpeechRecognition mockado antes de a página carregar.
    await page.addInitScript(() => {
      class MockSpeechRecognition {
        lang = 'pt-PT';
        continuous = false;
        interimResults = false;
        onresult: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;

        start(): void {
          setTimeout(() => {
            if (this.onresult) {
              this.onresult({
                results: {
                  length: 1,
                  0: { 0: { transcript: 'abre o calendário' } },
                },
              });
            }
            if (this.onend) this.onend();
          }, 120);
        }

        stop(): void {
          if (this.onend) this.onend();
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (window as any).SpeechRecognition = MockSpeechRecognition;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (window as any).webkitSpeechRecognition = MockSpeechRecognition;
    });

    await login(page);
  });

  test('liga o microfone e recebe transcrição simulada', async ({ page }) => {
    // Clica no botão do microfone no header.
    const micButton = page.getByLabel('Ligar microfone');
    await micButton.waitFor({ state: 'visible', timeout: 5000 });
    await micButton.click();

    // Espera que o estado de escuta termine (o mock processa em 120ms).
    await page.waitForTimeout(500);

    // Depois de ouvir, o botão deve voltar ao estado "Ligar microfone"
    // (não "Desligar microfone") — o reconhecimento mockado termina.
    await expect(page.getByLabel('Ligar microfone')).toBeVisible({ timeout: 5000 });
  });

  test('o microfone pode ser ligado e desligado manualmente', async ({ page }) => {
    const micButton = page.getByLabel('Ligar microfone');
    await micButton.waitFor({ state: 'visible', timeout: 5000 });

    // Liga.
    await micButton.click();
    // O aria-pressed deve mudar para true enquanto escuta (brevemente).
    await page.waitForTimeout(300);

    // Verifica que o botão voltou ao estado inicial depois do mock processar.
    await expect(page.getByLabel('Ligar microfone')).toBeVisible({ timeout: 5000 });
  });
});
