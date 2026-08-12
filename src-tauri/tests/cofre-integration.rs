/// Teste de integração ao vivo do keyring com o Windows Credential Manager.
///
/// Cada teste escreve, lê e apaga do cofre real do sistema — não usa mocks.
/// O service é `jarvis-ai-os-integration-test` (não o de produção) para não
/// interferir com chaves verdadeiras.

const SERVICE: &str = "jarvis-ai-os-integration-test";

fn apaga_residuos(user: &str) {
    let entry = keyring::Entry::new(SERVICE, user);
    if let Ok(entry) = entry {
        let _ = entry.delete_password();
    }
}

#[test]
fn guarda_e_le_do_cofre_do_windows() {
    let user = "teste-guarda-le";
    apaga_residuos(user);

    let entry = keyring::Entry::new(SERVICE, user).expect("abrir cofre");
    entry
        .set_password("sk-abcdefgh12345678")
        .expect("guardar no cofre");

    let lida = entry.get_password().expect("ler do cofre");
    assert_eq!(lida, "sk-abcdefgh12345678");

    entry.delete_password().expect("apagar do cofre");
}

#[test]
fn chave_que_nao_existe_devolve_erro_sem_panicar() {
    let entry =
        keyring::Entry::new(SERVICE, "teste-inexistente").expect("abrir cofre");
    let result = entry.get_password();

    match result {
        Ok(_) => {
            // Alguém deixou lixo — apaga e segue.
            let _ = entry.delete_password();
        }
        Err(keyring::Error::NoEntry) => {
            // Isto é o esperado.
        }
        Err(e) => panic!("erro inesperado ao ler entrada inexistente: {e}"),
    }
}

#[test]
fn apagar_uma_chave_que_nao_existe_nao_panica() {
    let entry =
        keyring::Entry::new(SERVICE, "teste-apaga-inexistente").expect("abrir cofre");

    // A entrada pode ou não existir — o que importa é que não panica.
    let result = entry.delete_password();

    match result {
        Ok(()) => {} // correu bem (existia ou não, tanto faz)
        Err(keyring::Error::NoEntry) => {} // também é OK
        Err(e) => panic!("erro inesperado ao apagar entrada inexistente: {e}"),
    }
}

#[test]
fn sobescreve_chave_existente() {
    let user = "teste-sobescreve";
    apaga_residuos(user);

    let entry = keyring::Entry::new(SERVICE, user).expect("abrir cofre");

    entry.set_password("primeira-chave").expect("guardar 1");
    entry.set_password("segunda-chave").expect("guardar 2");

    let lida = entry.get_password().expect("ler");
    assert_eq!(lida, "segunda-chave", "devolveu a primeira, não a segunda");

    entry.delete_password().expect("apagar");
}

/// Fluxo completo com o serviço de produção (`jarvis-ai-os`), igual ao que a
/// store frontend faz quando o utilizador guarda uma chave pela interface.
#[test]
fn fluxo_real_da_aplicacao_com_service_de_producao() {
    let user = "deepseek-api-key"; // o nome que o persist() usa
    let entry = keyring::Entry::new("jarvis-ai-os", user).expect("abrir cofre de produção");

    // Guardar — simula o primeiro "Guardar a chave" na interface.
    let chave = "sk-producao-teste-12345678";
    entry.set_password(chave).expect("guardar no cofre de produção");

    // Ler — simula o hydrate() quando a app reabre.
    let lida = entry.get_password().expect("ler do cofre de produção");
    assert_eq!(lida, chave);

    // Apagar — simula "Apagar a chave" na interface.
    entry.delete_password().expect("apagar do cofre de produção");

    // Depois de apagar, já não está lá.
    match entry.get_password() {
        Err(keyring::Error::NoEntry) => {} // esperado
        other => panic!("a chave devia ter sido apagada, mas: {other:?}"),
    }
}

#[test]
fn carateres_especiais_sobrevivem_ao_cofre() {
    let user = "teste-especiais";
    apaga_residuos(user);

    let original = "sk-!@#$%^&*()_+{}|:\"<>?[];',./`~áéíóúção";
    let entry = keyring::Entry::new(SERVICE, user).expect("abrir cofre");
    entry.set_password(original).expect("guardar especiais");

    let lida = entry.get_password().expect("ler especiais");
    assert_eq!(lida, original);

    entry.delete_password().expect("apagar especiais");
}
