use scraper::{Html, Selector};
use serde::Serialize;
use url::{Host, Url};

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

    if is_blocked_host(&url) {
        return Err(Error::Files(format!(
            "'{url}' aponta para a própria máquina ou para uma rede privada — recusado, por segurança."
        )));
    }

    // Sem seguir redirecionamentos: um endereço público e aceite podia
    // redirecionar para dentro (`localhost`, um IP privado) e contornar a
    // verificação de cima, que só olha para o endereço pedido. Um 3xx
    // devolvido tal como veio, para ser recusado abaixo como qualquer
    // outro estado que não seja uma página.
    let agent = ureq::AgentBuilder::new().redirects(0).build();

    let response = agent
        .get(&url)
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .call()
        .map_err(|e| Error::Files(format!("não consegui abrir '{url}': {e}")))?;

    if (300..400).contains(&response.status()) {
        return Err(Error::Files(format!(
            "'{url}' redireciona para outro endereço — não seguido, por segurança."
        )));
    }

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

/// `true` quando o anfitrião do endereço é a própria máquina, uma rede
/// privada, ou um endereço de "só neste enlace" (onde vive, por exemplo, o
/// endereço de metadados de nuvem, `169.254.169.254`) — defesa contra SSRF.
/// Sem isto, "abre https://169.254.169.254/" ou "abre
/// https://localhost:9000/painel-admin" seriam pedidos como outro
/// qualquer, e o texto que voltasse (de um serviço que nunca devia ser
/// alcançável de fora) apareceria na conversa como se fosse uma página
/// pública qualquer.
fn is_blocked_host(url: &str) -> bool {
    let Ok(parsed) = Url::parse(url) else {
        return true;
    };

    match parsed.host() {
        Some(Host::Domain(domain)) => {
            let lower = domain.to_lowercase();
            lower == "localhost" || lower.ends_with(".localhost")
        }
        Some(Host::Ipv4(ip)) => is_blocked_ipv4(ip),
        Some(Host::Ipv6(ip)) => is_blocked_ipv6(ip),
        None => true,
    }
}

fn is_blocked_ipv4(ip: std::net::Ipv4Addr) -> bool {
    ip.is_loopback() || ip.is_private() || ip.is_link_local() || ip.is_unspecified() || ip.is_broadcast()
}

fn is_blocked_ipv6(ip: std::net::Ipv6Addr) -> bool {
    if ip.is_loopback() || ip.is_unspecified() {
        return true;
    }

    let segments = ip.segments();

    // Endereço IPv4 mapeado em IPv6 (`::ffff:a.b.c.d`) — confere o IPv4 real
    // por trás, em vez de o deixar passar só por ter forma de IPv6.
    if segments[0..5] == [0, 0, 0, 0, 0] && segments[5] == 0xffff {
        let mapped = std::net::Ipv4Addr::new(
            (segments[6] >> 8) as u8,
            segments[6] as u8,
            (segments[7] >> 8) as u8,
            segments[7] as u8,
        );
        return is_blocked_ipv4(mapped);
    }

    (segments[0] & 0xffc0) == 0xfe80 // fe80::/10 — link-local
        || (segments[0] & 0xfe00) == 0xfc00 // fc00::/7 — unique local
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

    /// Achado numa revisão de segurança a sério (13/08/2026): o comando só
    /// confería o esquema (`https://`), nunca o anfitrião — um pedido a
    /// `https://localhost/`, a um IP privado, ou ao endereço de metadados
    /// de nuvem passava como qualquer outro. Estes testes provam a recusa
    /// sem tocar em rede nenhuma (a função corta antes de qualquer pedido).
    #[test]
    fn recusa_a_propria_maquina_e_redes_privadas() {
        for url in [
            "https://localhost/",
            "https://localhost:9000/painel",
            "https://sub.localhost/",
            "https://127.0.0.1/",
            "https://127.5.5.5/",
            "https://[::1]/",
            "https://169.254.169.254/latest/meta-data/", // metadados de nuvem
            "https://169.254.1.1/",
            "https://10.0.0.5/",
            "https://172.16.0.1/",
            "https://172.31.255.255/",
            "https://192.168.1.1/",
            "https://0.0.0.0/",
            "https://255.255.255.255/",
            "https://[fe80::1]/",  // link-local IPv6
            "https://[fc00::1]/",  // unique-local IPv6
            "https://[::ffff:127.0.0.1]/", // IPv4 mapeado em IPv6
            "https://[::ffff:192.168.1.1]/",
        ] {
            let result = fetch_page_text(url.to_string());
            assert!(result.is_err(), "devia ter recusado {url}");
        }
    }

    #[test]
    fn nao_recusa_um_ip_publico_nem_um_dominio_normal() {
        // Endereços fora do conjunto bloqueado — is_blocked_host() sozinha,
        // sem chegar a fazer um pedido de rede (por isso chama-se a função
        // diretamente, e não fetch_page_text, que tentaria mesmo ligar-se).
        assert!(!is_blocked_host("https://exemplo.com/artigo"));
        assert!(!is_blocked_host("https://8.8.8.8/"));
        assert!(!is_blocked_host("https://noticias.exemplo.org/"));
    }

    #[test]
    fn um_endereco_ilegivel_e_recusado_por_omissao() {
        assert!(is_blocked_host("https://"));
        assert!(is_blocked_host("não é um url"));
    }
}
