import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';

const url = process.env.JARVIS_FEATURE_PREVIEW_URL ?? 'http://127.0.0.1:1423';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('jarvis.booted', 'true'));
await page.route('http://127.0.0.1:8090/health', route => route.fulfill({ json: { ok: true, reconhecimento_disponivel: true } }));
await page.route('http://127.0.0.1:8091/health', route => route.fulfill({ json: { ok: true, running: false, model_ready: false } }));

async function login() {
  const password = page.getByRole('textbox', { name: 'Palavra-passe' });
  await password.fill('teste'); await password.press('Enter');
  await expect(page.getByRole('toolbar', { name: 'Aplicações' })).toBeVisible();
}
async function open(appId, title, rect = { x: 220, y: 180, width: 850, height: 680 }) {
  await page.evaluate(async ({ appId, title, rect }) => {
    const { useWindowStore } = await import('/src/stores/use-window-store.ts');
    useWindowStore.getState().open(appId, title, rect);
  }, { appId, title, rect });
}
async function closeAll() {
  await page.evaluate(async () => {
    const { useWindowStore } = await import('/src/stores/use-window-store.ts');
    const store = useWindowStore.getState();
    for (const window of store.windows) store.close(window.id);
  });
}

try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(url, { waitUntil: 'domcontentloaded' }); await login();
  await open('calendar', 'Calendário');
  await page.getByRole('button', { name: 'Novo evento' }).click();
  await page.getByLabel('Título do evento').fill('Reunião de revisão');
  await page.getByLabel('Descrição', { exact: true }).fill('Evento guardado no dispositivo');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await expect(page.getByRole('button', { name: 'Editar Reunião de revisão' })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Reunião de revisão' }).click();
  await page.getByLabel('Título do evento').fill('Revisão preparada');
  await page.getByRole('button', { name: 'Guardar evento' }).click();
  await page.screenshot({ path: 'artifacts/agenda-desktop.png' });
  await page.reload({ waitUntil: 'domcontentloaded' }); await login();
  await open('calendar', 'Calendário');
  await expect(page.getByRole('button', { name: 'Editar Revisão preparada' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.getByRole('button', { name: 'Editar Revisão preparada' }).click();
  await page.screenshot({ path: 'artifacts/agenda-390.png' });
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Apagar Revisão preparada' }).click();
  await expect(page.getByRole('button', { name: 'Editar Revisão preparada' })).toHaveCount(0);
  await closeAll(); await page.setViewportSize({ width: 1440, height: 1000 });

  await page.evaluate(async () => {
    const { directControlService: control } = await import('/src/services/direct-control-service.ts');
    const { visionService: vision } = await import('/src/services/vision/vision-service.ts');
    control.setEnabled(true); control.startSession(); control.setSimulated(false);
    vision.setProvider({ id: 'ollama', name: 'Teste local', isConfigured: () => true, isRemote: false, describe: async () => 'teste' });
    window.captureResult = vision.describeScreen();
  });
  await expect(page.getByRole('alertdialog', { name: 'Permitir captura do ecrã' })).toBeVisible();
  await expect(page.getByText(/analisado localmente por Teste local/)).toBeVisible();
  await page.getByRole('button', { name: 'Recusar' }).click();
  expect(await page.evaluate(() => window.captureResult)).toContain('não foi autorizada');
  await expect(page.getByRole('status', { name: 'Sessão de Controlo Direto' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.screenshot({ path: 'artifacts/controlo-390.png' });
  await page.getByRole('button', { name: 'Parar Controlo Direto' }).click();
  await expect(page.getByRole('status', { name: 'Sessão de Controlo Direto' })).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await open('developer', 'Centro de Desenvolvimento');
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await page.getByRole('button', { name: 'Verificar serviços de voz' }).click();
  await expect(page.getByText(/Whisper instalado; carrega na primeira transcrição/)).toBeVisible();
  await expect(page.getByText(/modelo Vosk não instalado/)).toBeVisible();
  await page.screenshot({ path: 'artifacts/diagnostico-voz.png' });
  await closeAll();

  await open('plugins', 'Plugins');
  await page.getByRole('tab', { name: 'Marketplace' }).click();
  const index = 'https://raw.githubusercontent.com/teste/jarvis/main/index.json';
  await page.route('https://raw.githubusercontent.com/**', route => route.fulfill({ json: { version: 1, plugins: [] } }));
  await page.getByLabel('URL do índice GitHub').fill(index);
  await page.getByRole('button', { name: 'Carregar catálogo remoto' }).click();
  await expect(page.getByText('O catálogo remoto está vazio.')).toBeVisible();
  await expect(page.getByText(/dados de exemplo, escritos à mão/)).toHaveCount(0);
  const packages = await page.evaluate(async () => {
    const { generateSigningKeyPair, signPlugin } = await import('/src/plugins/signature.ts');
    const key = await generateSigningKeyPair();
    const result = [];
    for (const version of ['1.0.0', '2.0.0']) {
      const manifest = { id: 'verificacao-remota', name: 'Verificação remota', version, author: 'Teste', description: '', platforms: ['desktop'],
        permissions: { filesystem: false, network: false, systemMetrics: false, notifications: false, shell: false, windows: false,
          commands: false, events: false, storage: false, shortcuts: false, widgets: false, menus: false,
          settings: false, services: false, panels: false, voice: false, memory: false } };
      const code = `console.log('${version}')`;
      result.push(JSON.stringify({ manifest, code, signerPublicKey: key.publicKey, signature: await signPlugin(manifest, code, key.privateKey) }));
    }
    return result;
  });
  let version = 0;
  await page.route('https://raw.githubusercontent.com/**', route => {
    const pkg = JSON.parse(packages[version]);
    const listing = { id: pkg.manifest.id, name: pkg.manifest.name, version: pkg.manifest.version, author: pkg.manifest.author,
      downloadUrl: 'https://raw.githubusercontent.com/teste/jarvis/main/plugin.jarvis-plugin', sha256: createHash('sha256').update(packages[version]).digest('hex') };
    return route.request().url().endsWith('index.json')
      ? route.fulfill({ json: { version: 1, plugins: [listing] } })
      : route.fulfill({ contentType: 'application/json', body: packages[version] });
  });
  await page.getByRole('button', { name: 'Carregar catálogo remoto' }).click();
  await page.getByRole('button', { name: 'Verificar pacote' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar instalação' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Confio nesta chave e nas permissões indicadas' }).check();
  await page.getByRole('button', { name: 'Confirmar instalação' }).click();
  await expect(page.getByText('Instalada: 1.0.0 · desativada')).toBeVisible();
  version = 1;
  await page.getByRole('button', { name: 'Carregar catálogo remoto' }).click();
  await page.getByRole('button', { name: 'Substituir pela versão 2.0.0' }).click();
  await page.getByRole('checkbox', { name: 'Confio nesta chave e nas permissões indicadas' }).check();
  await page.getByRole('button', { name: 'Confirmar instalação' }).click();
  await expect(page.getByText('Instalada: 2.0.0 · desativada')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Recuperar versão anterior' }).click();
  await expect(page.getByText('Instalada: 1.0.0 · desativada')).toBeVisible();
  await page.screenshot({ path: 'artifacts/marketplace-remoto.png' });
  await closeAll();
  const files = await page.evaluate(async () => {
    const { getPlatformAdapter } = await import('/src/platform/index.ts');
    const { searchAssistantFiles } = await import('/src/services/assistant/file-search.ts');
    const { usePendingFileNavigationStore } = await import('/src/stores/use-pending-file-navigation-store.ts');
    const adapter = getPlatformAdapter();
    const root = { name: 'Documentos de teste', path: 'C:/Teste' };
    const folder = { name: 'Trabalho', path: 'C:/Teste/Trabalho' };
    const capabilities = { ...adapter.capabilities, realFilesystem: true };
    Object.defineProperty(adapter, 'capabilities', { get: () => capabilities });
    await adapter.storageSet('files.real-root-path', root.path);
    adapter.filesSetRoot = async () => root;
    adapter.filesReadDir = async path => path === root.path
      ? [{ ...folder, isDirectory: true, modifiedAt: 0, sizeBytes: null }]
      : [{ name: 'Orçamento.pdf', path: `${folder.path}/Orçamento.pdf`, isDirectory: false, modifiedAt: 0, sizeBytes: 20 }];
    const result = await searchAssistantFiles('orcamento');
    usePendingFileNavigationStore.getState().setReal(result.matches[0].realParents);
    return { result, root, folder };
  });
  expect(files.result.source).toBe('real');
  await open('files', 'Explorador');
  await expect(page.getByText('Orçamento.pdf', { exact: true })).toBeVisible();
  await page.evaluate(async root => {
    const { usePendingFileNavigationStore } = await import('/src/stores/use-pending-file-navigation-store.ts');
    usePendingFileNavigationStore.getState().setReal([root]);
  }, files.root);
  await expect(page.getByText('Orçamento.pdf', { exact: true })).toHaveCount(0);
  await page.evaluate(async ({ root, folder }) => {
    const { usePendingFileNavigationStore } = await import('/src/stores/use-pending-file-navigation-store.ts');
    usePendingFileNavigationStore.getState().setReal([root, folder]);
  }, files);
  await expect(page.getByText('Orçamento.pdf', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/pesquisa-ficheiros.png' });
  expect(errors).toEqual([]);
  console.log('Edge: agenda criar/editar/recarregar/apagar, largura 390, consentimento local recusado, Parar, diagnósticos independentes, Marketplace instalar/atualizar/rollback com Ed25519 real e navegação de ficheiros na janela já aberta. Rede, disco e captura simulados.');
} finally { await browser.close(); }
