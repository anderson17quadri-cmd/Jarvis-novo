/**
 * Diálogos nativos de ficheiro, com queda para o browser.
 *
 * O plugin `dialog` do Tauri está registado (Cargo.toml, lib.rs), e o plugin
 * `fs` também — mas a interface ainda não os chamava. Este módulo expõe duas
 * funções que tentam o diálogo nativo primeiro e, se falhar (a correr no
 * browser, sem Tauri), caem para os mecanismos do browser.
 *
 * A importação dinâmica com try/catch é de propósito: em contexto de browser
 * puro, os módulos `@tauri-apps/*` não existem e um `import` estático
 * partiria o build.
 */

/**
 * Abre o diálogo nativo de gravação e escreve o conteúdo.
 *
 * Devolve `true` se o ficheiro foi escrito, `false` se o utilizador cancelou
 * ou se o diálogo nativo não está disponível (nesse caso, quem chama cai para
 * o `<a download>` do browser).
 */
export async function saveWithNativeDialog(
  defaultName: string,
  content: string,
): Promise<boolean> {
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!filePath) return false;
    await writeTextFile(filePath, content);
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre o diálogo nativo de abertura e devolve o conteúdo do ficheiro.
 *
 * Devolve o texto lido, ou `null` se o utilizador cancelou ou se o diálogo
 * nativo não está disponível (nesse caso, quem chama cai para o
 * `<input type="file">` do browser).
 */
export async function openWithNativeDialog(): Promise<string | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readTextFile } = await import('@tauri-apps/plugin-fs');

    const selected = await open({
      filters: [{ name: 'JSON', extensions: ['json'] }],
      multiple: false,
    });

    if (!selected || typeof selected !== 'string') return null;
    return await readTextFile(selected);
  } catch {
    return null;
  }
}
