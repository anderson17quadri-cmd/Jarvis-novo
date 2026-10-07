import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.env.JARVIS_VOICE_PREVIEW_URL ?? 'http://127.0.0.1:1422';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const requests = [];
await page.addInitScript(() => localStorage.setItem('jarvis.booted', 'true'));
await page.route('https://api.openai.com/**', async route => {
  requests.push(route.request().postDataJSON());
  const samples = 24000 / 2;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  await route.fulfill({ status: 200, contentType: 'audio/wav', body: wav });
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const password = page.getByRole('textbox', { name: 'Palavra-passe' });
  await password.fill('teste');
  await password.press('Enter');
  await page.getByRole('toolbar', { name: 'Aplicações' }).getByLabel('Personalização', { exact: true }).click();
  const voices = page.getByRole('radiogroup', { name: 'Voz OpenAI' });
  await expect(voices.getByRole('radio', { name: 'Cedar' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Testar a voz Cedar' })).toBeDisabled();
  await expect(page.getByText('Gravar a minha voz', { exact: true })).toHaveCount(0);
  await page.getByLabel('Chave API OpenAI', { exact: true }).fill('chave-ficticia-para-teste');
  await page.getByRole('button', { name: 'Guardar chave', exact: true }).click();
  await expect(page.getByLabel('Chave API OpenAI', { exact: true })).toHaveValue('');
  await voices.getByRole('radio', { name: 'Marin' }).click();
  await page.getByRole('button', { name: 'Testar a voz Cedar' }).click();
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Testar a voz Cedar' })).toBeEnabled();
  await expect(voices.getByRole('radio', { name: 'Marin' })).toBeChecked();
  expect(requests[0].voice).toBe('cedar');
  expect(requests[0].instructions).toContain('português brasileiro');
  const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  expect(storage).not.toContain('chave-ficticia-para-teste');
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/voz-openai-interface.png' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await password.fill('teste');
  await password.press('Enter');
  await page.getByRole('toolbar', { name: 'Aplicações' }).getByLabel('Personalização', { exact: true }).click();
  await expect(voices.getByRole('radio', { name: 'Marin' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Testar a voz Cedar' })).toBeDisabled();
  expect(errors).toEqual([]);
  console.log('Interface verificada no Edge: escolha, teste sem mudar preferência, chave só na sessão e persistência da voz. API simulada; sem custo ou avaliação sonora.');
} finally {
  await browser.close();
}
