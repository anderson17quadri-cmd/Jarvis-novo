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
  await route.fulfill({ status: 200, contentType: 'application/json', json: { value: 'ek_teste' } });
});
await page.routeWebSocket('wss://api.openai.com/**', socket => {
  socket.onMessage(data => {
    const message = JSON.parse(String(data));
    if (message.type !== 'response.create') return;
    socket.send(JSON.stringify({ type: 'response.output_audio.delta', delta: Buffer.alloc(24000).toString('base64') }));
    socket.send(JSON.stringify({ type: 'response.done', response: { status: 'completed' } }));
  });
  socket.send(JSON.stringify({ type: 'session.created' }));
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
  expect(requests[0].session.audio.output.voice).toBe('cedar');
  expect(requests[0].session.instructions).toContain('português brasileiro');
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
