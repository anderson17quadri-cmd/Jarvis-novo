use std::io::Cursor;
use std::path::{Path, PathBuf};

use base64::Engine;
use enigo::{Button, Coordinate, Direction, Enigo, Keyboard, Mouse, Settings};
use serde::Deserialize;

use crate::error::{Error, Result};

/// Abre um ficheiro ou aplicação pelo caminho, no abridor predefinido do
/// sistema — o equivalente a um duplo-clique, não a execução arbitrária.
///
/// Fase 3.2 (`docs/spec/fase-3-controlo-direto.md` §4): a ação nativa de
/// menor risco de toda a fase — não mexe no rato nem no teclado, só pede ao
/// sistema operativo que abra um caminho com a aplicação que o próprio SO
/// associa àquele tipo de ficheiro.
///
/// A porta de presença (controlo direto ligado, sessão ativa, confirmação
/// explícita) vive do lado da interface — `directControlService` — que só
/// chega a invocar isto depois de tudo confirmado. Aqui só se garante que o
/// caminho existe antes de tocar no abridor: um caminho inventado é recusado
/// sem efeito nenhum.
#[tauri::command]
pub fn open_path(path: String) -> Result<()> {
    let canonical = resolve_existing(&path)?;

    // `open::that` delega no abridor do sistema — o mesmo gesto de um
    // duplo-clique. Não é `std::process::Command`: não há como esconder um
    // executável arbitrário por trás de um caminho bonito, porque aqui só o
    // abridor associado ao tipo de ficheiro é que é invocado.
    open::that(canonical)
        .map_err(|e| crate::error::Error::Files(format!("não consegui abrir '{path}': {e}")))
}

/// Valida e normaliza um caminho para abrir: tem de existir (ficheiro ou
/// pasta). Separado de `open_path` para ser testável sem tocar no abridor do
/// sistema.
fn resolve_existing(path: &str) -> Result<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(crate::error::Error::Files("o caminho está vazio.".to_string()));
    }

    // Canonicalizar resolve "..", links simbólicos e separadores repetidos,
    // e confirma que o caminho aponta para algo que existe mesmo — antes de o
    // entregar ao abridor.
    Path::new(trimmed).canonicalize().map_err(|e| {
        crate::error::Error::Files(format!(
            "o caminho '{trimmed}' não existe ou não se pode ler: {e}"
        ))
    })
}

/// Uma zona retangular do ecrã que fica sempre tapada antes de um print sair
/// da máquina (Fase 3.3).
///
/// As coordenadas vêm da interface em píxeis do monitor principal. São
/// retângulos que a pessoa desenhou em Privacidade — a barra de senhas do
/// browser, uma app de banco — e que nunca devem aparecer no que o modelo de
/// visão recebe. Tapá-los aqui, dentro do processo Rust, é o que garante que o
/// print **nunca sai da máquina por descoberto**: a interface só chega a ver a
/// versão já tapada.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub struct ScreenZone {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

/// Tira um print do monitor principal, tapa as zonas sensíveis e devolve-o em
/// base64 PNG. Nunca escreve em disco — o print vive só o tempo da decisão.
///
/// Fase 3.3 (§4): o comando que alimenta a camada de perceção. A porta de
/// presença e o consentimento por sessão ficam do lado da interface, como em
/// `open_path`; aqui só se garante que há um ecrã para capturar.
#[tauri::command]
pub fn capture_screen(zones: Vec<ScreenZone>) -> Result<String> {
    let monitor = xcap::Monitor::all()
        .map_err(|e| Error::Control(format!("não consegui listar os ecrãs: {e}")))?
        .into_iter()
        .next()
        .ok_or_else(|| Error::Control("não há nenhum ecrã para capturar.".to_string()))?;

    let mut image = monitor
        .capture_image()
        .map_err(|e| Error::Control(format!("não consegui capturar o ecrã: {e}")))?;

    mask_zones(&mut image, &zones);
    encode_png(&image)
}

/// Tapa os retângulos `zones` a preto, sem nunca ultrapassar os limites da
/// imagem — uma zona mal medida (maior do que o ecrã, ou fora dele) é cortada
/// ao bordo em vez de rebentar com um índice fora dos limites.
fn mask_zones(image: &mut xcap::image::RgbaImage, zones: &[ScreenZone]) {
    let (width, height) = image.dimensions();

    for zone in zones {
        for y in zone.y..(zone.y + zone.height).min(height) {
            for x in zone.x..(zone.x + zone.width).min(width) {
                image.put_pixel(x, y, xcap::image::Rgba([0, 0, 0, 255]));
            }
        }
    }
}

/// Codifica a imagem para PNG e devolve-a em base64 — o formato que viaja pelo
/// IPC e que o modelo de visão consome, sem nunca passar pelo disco.
fn encode_png(image: &xcap::image::RgbaImage) -> Result<String> {
    let mut bytes: Vec<u8> = Vec::new();

    image
        .write_to(&mut Cursor::new(&mut bytes), xcap::image::ImageFormat::Png)
        .map_err(|e| Error::Control(format!("não consegui codificar o print: {e}")))?;

    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// Move o cursor para coordenadas absolutas, dentro dos limites do ecrã.
///
/// Fase 3.4 (§4): a ação de menor risco das três de rato/teclado — mover não
/// faz nada, só prepara. Valida-se sempre que o destino existe dentro do ecrã
/// antes de mexer; um ponto inventado é recusado sem efeito.
#[tauri::command]
pub fn move_mouse_to(x: i32, y: i32) -> Result<()> {
    let mut enigo = new_enigo()?;
    let (width, height) = display_size(&enigo)?;

    validate_coordinates(x, y, width, height)?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| Error::Control(format!("não consegui mover o rato: {e}")))
}

/// Move o cursor para as coordenadas e clica com o botão esquerdo.
///
/// Um clique é, potencialmente, irreversível — "enviar", "apagar" — mas a
/// classificação do risco e a confirmação por passo vivem na interface. Aqui
/// só se garante o que é garantível sem ver o ecrã: as coordenadas existem.
#[tauri::command]
pub fn click_at(x: i32, y: i32) -> Result<()> {
    let mut enigo = new_enigo()?;
    let (width, height) = display_size(&enigo)?;

    validate_coordinates(x, y, width, height)?;
    enigo
        .move_mouse(x, y, Coordinate::Abs)
        .map_err(|e| Error::Control(format!("não consegui mover o rato: {e}")))?;
    enigo
        .button(Button::Left, Direction::Click)
        .map_err(|e| Error::Control(format!("não consegui clicar: {e}")))
}

/// Escreve texto, tecla a tecla — nunca interpretado como comando.
///
/// Fase 3.4 (§4): o texto é explícito e chega ao sistema como carateres
/// simulados, não como uma linha de shell. Sanitiza-se o óbvio antes de mexer:
/// nada vazio, nada absurdamente longo.
#[tauri::command]
pub fn type_text(text: String) -> Result<()> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(Error::Control("não há texto para escrever.".to_string()));
    }
    if trimmed.chars().count() > 2_000 {
        return Err(Error::Control("o texto é demasiado longo.".to_string()));
    }

    let mut enigo = new_enigo()?;
    enigo
        .text(trimmed)
        .map_err(|e| Error::Control(format!("não consegui escrever: {e}")))
}

/// Cria o controlador de rato/teclado do `enigo`.
fn new_enigo() -> Result<Enigo> {
    Enigo::new(&Settings::default()).map_err(|e| {
        Error::Control(format!("não consegui iniciar o controlo do rato/teclado: {e}"))
    })
}

/// O tamanho (largura × altura) do monitor principal, em píxeis.
fn display_size(enigo: &Enigo) -> Result<(i32, i32)> {
    enigo
        .main_display()
        .map_err(|e| Error::Control(format!("não consegui ler o tamanho do ecrã: {e}")))
}

/// Valida que `(x, y)` está dentro de um ecrã `width × height`.
///
/// Separado dos comandos para ser testável sem um rato nem um ecrã a sério:
/// é aqui que vive a regra "coordenadas explícitas, dentro dos limites".
fn validate_coordinates(x: i32, y: i32, width: i32, height: i32) -> Result<()> {
    if x < 0 || y < 0 || x >= width || y >= height {
        return Err(Error::Control(format!(
            "coordenadas ({x}, {y}) fora do ecrã ({width}x{height})."
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caminho_vazio_e_recusado() {
        assert!(resolve_existing("").is_err());
        assert!(resolve_existing("   ").is_err());
    }

    #[test]
    fn caminho_inexistente_e_recusado() {
        let inexistente = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("nao-existe-mesmo.txt");
        assert!(resolve_existing(&inexistente.to_string_lossy()).is_err());
    }

    #[test]
    fn um_ficheiro_que_existe_e_aceite() {
        // O manifesto do crate existe sempre durante os testes.
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(resolve_existing(&manifest.to_string_lossy()).is_ok());
    }

    #[test]
    fn coordenadas_dentro_do_ecra_passam() {
        assert!(validate_coordinates(0, 0, 1920, 1080).is_ok());
        assert!(validate_coordinates(1919, 1079, 1920, 1080).is_ok());
    }

    #[test]
    fn coordenadas_fora_do_ecra_sao_recusadas() {
        assert!(validate_coordinates(-1, 0, 1920, 1080).is_err());
        assert!(validate_coordinates(0, -1, 1920, 1080).is_err());
        assert!(validate_coordinates(1920, 0, 1920, 1080).is_err());
        assert!(validate_coordinates(0, 1080, 1920, 1080).is_err());
    }

    #[test]
    fn uma_zona_tapa_so_o_seu_retangulo() {
        let mut image = xcap::image::RgbaImage::from_pixel(10, 10, xcap::image::Rgba([255, 255, 255, 255]));

        mask_zones(
            &mut image,
            &[ScreenZone { x: 0, y: 0, width: 5, height: 5 }],
        );

        assert_eq!(image.get_pixel(0, 0), &xcap::image::Rgba([0, 0, 0, 255]));
        assert_eq!(image.get_pixel(4, 4), &xcap::image::Rgba([0, 0, 0, 255]));
        // Fora da zona, o píxel original mantém-se.
        assert_eq!(image.get_pixel(5, 0), &xcap::image::Rgba([255, 255, 255, 255]));
        assert_eq!(image.get_pixel(0, 5), &xcap::image::Rgba([255, 255, 255, 255]));
    }

    #[test]
    fn uma_zona_maior_do_que_o_ecra_e_cortada_ao_bordo() {
        // Uma zona que começa em (8, 8) e mede 100×100 não pode rebentar: corta
        // no canto inferior direito da imagem de 10×10.
        let mut image = xcap::image::RgbaImage::from_pixel(10, 10, xcap::image::Rgba([255, 255, 255, 255]));

        mask_zones(
            &mut image,
            &[ScreenZone { x: 8, y: 8, width: 100, height: 100 }],
        );

        assert_eq!(image.get_pixel(9, 9), &xcap::image::Rgba([0, 0, 0, 255]));
        assert_eq!(image.get_pixel(7, 7), &xcap::image::Rgba([255, 255, 255, 255]));
    }

    #[test]
    fn encode_png_devolve_um_png_valido() {
        let image = xcap::image::RgbaImage::from_pixel(2, 2, xcap::image::Rgba([1, 2, 3, 255]));
        let encoded = encode_png(&image).expect("codificar um print não devia falhar");

        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&encoded)
            .expect("o resultado devia ser base64 válido");

        // A assinatura mágica de um PNG, logo no início.
        assert_eq!(&bytes[..8], &[0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n']);
    }
}
