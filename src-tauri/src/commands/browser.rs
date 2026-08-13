use scraper::{Html, Selector};
use serde::Serialize;

use crate::error::{Error, Result};

/// Tamanho máximo do texto devolvido à interface — uma página grande não
/// devia mandar dezenas de milhares de carateres para o modelo de uma vez.
const MAX_TEXT_CHARS: usize = 8_000;

/// Tempo máximo de espera pela resposta, antes de desistir.
const REQUEST_TIMEOUT_SECS: u64 = 15;

/// O que uma página deu, já limpa — nunca o HTML bruto, nunca nada que corra.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageContent {
    title: String,
    text: String,
    truncated: bool,
}

/// Busca uma página e extrai o texto visível — Navegador controlado pelo
/// assistente (Peça 19, lote 5).
///
/// Só GET, só `https`, sem seguir formulários, sem correr nada da página —
/// o que volta à interface é sempre texto inerte. `<script>`, `<style>` e
/// `<noscript>` são excluídos antes de se ler qualquer texto: o conteúdo
/// desses elementos nunca chega a aparecer no que se devolve, não é só
/// escondido visualmente como um browser a sério faria.
///
/// Este comando não decide se a pessoa autorizou isto — isso é o
/// interruptor do lado da interface (`useBrowserToolSettingsStore`), que
/// nunca chega a chamar isto se estiver desligado. Aqui só se garante que,
/// uma vez chamado, o que sai é seguro de se ler.
#[tauri::command(async)]
pub fn fetch_page_text(url: String) -> Result<PageContent> {
    if !url.starts_with("https://") {
        return Err(Error::Files(format!(
            "só https é aceite para abrir páginas: '{url}'"
        )));
    }

    let response = ureq::get(&url)
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .call()
        .map_err(|e| Error::Files(format!("não consegui abrir '{url}': {e}")))?;

    let content_type = response.content_type().to_string();
    if !content_type.is_empty() && !content_type.contains("html") {
        return Err(Error::Files(format!(
            "'{url}' não é uma página HTML (tipo: {content_type})"
        )));
    }

    let html = response
        .into_string()
        .map_err(|e| Error::Files(format!("não consegui ler o corpo de '{url}': {e}")))?;

    Ok(extract_text(&html))
}

/// Extrai o título e o texto visível de um documento HTML, descartando
/// script/style/noscript por completo — testável sem rede nenhuma.
fn extract_text(html: &str) -> PageContent {
    let document = Html::parse_document(html);

    let title_selector = Selector::parse("title").expect("seletor 'title' é sempre válido");
    let title = document
        .select(&title_selector)
        .next()
        .map(|el| el.text().collect::<String>().trim().to_string())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| "(sem título)".to_string());

    let body_selector = Selector::parse("body").expect("seletor 'body' é sempre válido");
    let is_skippable = |name: &str| matches!(name, "script" | "style" | "noscript");

    let mut parts: Vec<String> = Vec::new();
    if let Some(body) = document.select(&body_selector).next() {
        for node in body.descendants() {
            if !node.value().is_text() {
                continue;
            }

            // Um nó de texto cujo antepassado seja script/style/noscript
            // nunca entra no resultado — o conteúdo desses nunca é lido.
            let hidden = node.ancestors().any(|ancestor| {
                ancestor
                    .value()
                    .as_element()
                    .is_some_and(|el| is_skippable(el.name()))
            });
            if hidden {
                continue;
            }

            if let Some(text) = node.value().as_text() {
                parts.push(text.to_string());
            }
        }
    }

    let normalized = parts.join(" ").split_whitespace().collect::<Vec<_>>().join(" ");
    let truncated = normalized.chars().count() > MAX_TEXT_CHARS;
    let text = if truncated {
        normalized.chars().take(MAX_TEXT_CHARS).collect()
    } else {
        normalized
    };

    PageContent {
        title,
        text,
        truncated,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extrai_titulo_e_texto_simples() {
        let html = "<html><head><title>Olá</title></head><body><p>Texto real.</p></body></html>";
        let content = extract_text(html);

        assert_eq!(content.title, "Olá");
        assert_eq!(content.text, "Texto real.");
        assert!(!content.truncated);
    }

    #[test]
    fn descarta_script_e_style_por_completo() {
        let html = "<html><head><title>T</title><style>.x{color:red}</style></head>\
            <body><script>alert('oi');</script><p>Visível.</p><noscript>Sem JS.</noscript></body></html>";
        let content = extract_text(html);

        assert_eq!(content.text, "Visível.");
        assert!(!content.text.contains("alert"));
        assert!(!content.text.contains("color:red"));
        assert!(!content.text.contains("Sem JS"));
    }

    #[test]
    fn sem_titulo_usa_um_por_omissao() {
        let html = "<html><body><p>Sem head nenhum.</p></body></html>";
        let content = extract_text(html);

        assert_eq!(content.title, "(sem título)");
    }

    #[test]
    fn texto_longo_e_truncado() {
        let long_word = "a".repeat(MAX_TEXT_CHARS + 500);
        let html = format!("<html><body><p>{long_word}</p></body></html>");
        let content = extract_text(&html);

        assert!(content.truncated);
        assert_eq!(content.text.chars().count(), MAX_TEXT_CHARS);
    }

    #[test]
    fn url_sem_https_e_recusado_antes_de_qualquer_pedido() {
        let result = fetch_page_text("http://exemplo.com".to_string());
        assert!(result.is_err());

        let result_file = fetch_page_text("file:///etc/passwd".to_string());
        assert!(result_file.is_err());
    }
}
