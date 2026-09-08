//! Comandos de monitorização de rede para automações.
//!
//! Implementa deteção de mudanças no estado da rede (ligado/desligado,
//! tipo de ligação, endereço IP) usando a API nativa do sistema operativo.

use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{Emitter, Runtime, Wry};

static IS_WATCHING: AtomicBool = AtomicBool::new(false);

/// Estado atual da ligação de rede.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq)]
pub struct NetworkState {
    /// Se há ligação de rede ativa.
    pub is_connected: bool,
    /// Tipo de ligação (ethernet, wifi, cellular, unknown).
    pub connection_type: String,
    /// Endereço IPv4 principal (se disponível).
    pub ipv4_address: Option<String>,
    /// Nome da interface de rede principal.
    pub interface_name: String,
    /// Se a ligação é medida (com limite de dados).
    pub is_metered: bool,
}

impl Default for NetworkState {
    fn default() -> Self {
        Self {
            is_connected: false,
            connection_type: "unknown".to_string(),
            ipv4_address: None,
            interface_name: "unknown".to_string(),
            is_metered: false,
        }
    }
}

/// Obtém o estado atual da rede.
#[tauri::command]
pub fn get_network_state() -> Result<NetworkState, String> {
    get_current_network_state()
}

/// Obtém o estado atual da rede usando APIs nativas.
fn get_current_network_state() -> Result<NetworkState, String> {
    #[cfg(target_os = "windows")]
    {
        get_network_state_windows()
    }
    
    #[cfg(target_os = "macos")]
    {
        get_network_state_macos()
    }
    
    #[cfg(target_os = "linux")]
    {
        get_network_state_linux()
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(NetworkState::default())
    }
}

/// Implementação para Windows usando a crate `windows`.
#[cfg(target_os = "windows")]
fn get_network_state_windows() -> Result<NetworkState, String> {
    use windows::Win32::Networking::WinSock::*;
    use windows::Win32::NetworkManagement::IpHelper::*;
    use windows::Win32::Foundation::*;
    use std::mem;
    
    unsafe {
        // Obter tabela de adaptadores
        let mut buffer_size = 15000;
        let mut buffer = vec![0u8; buffer_size as usize];
        let mut addresses = buffer.as_mut_ptr() as *mut IP_ADAPTER_ADDRESSES_LH;
        
        let result = GetAdaptersAddresses(
            AF_INET.0 as u32,
            GAA_FLAG_INCLUDE_PREFIX,
            std::ptr::null_mut(),
            addresses,
            &mut buffer_size,
        );
        
        if result != ERROR_SUCCESS.0 {
            // Sem adaptadores ou erro
            return Ok(NetworkState {
                is_connected: false,
                ..Default::default()
            });
        }
        
        let mut best_adapter: *const IP_ADAPTER_ADDRESSES_LH = std::ptr::null();
        let mut best_metric = u32::MAX;
        
        // Percorrer adaptadores para encontrar o principal
        let mut current = addresses;
        while !current.is_null() {
            let adapter = &*current;
            
            // Ignorar adaptadores desligados
            if adapter.OperStatus != IfOperStatusUp {
                current = adapter.Next;
                continue;
            }
            
            // Preferir Ethernet sobre WiFi
            let metric = match adapter.IfType {
                IF_TYPE_ETHERNET_CSMACD => 0,
                IF_TYPE_IEEE80211 => 10,
                _ => 20,
            };
            
            if metric < best_metric {
                best_metric = metric;
                best_adapter = current;
            }
            
            current = adapter.Next;
        }
        
        if best_adapter.is_null() {
            return Ok(NetworkState {
                is_connected: false,
                ..Default::default()
            });
        }
        
        let adapter = &*best_adapter;
        
        // Extrair endereço IPv4
        let mut ipv4_addr: Option<String> = None;
        let mut current_unicast = adapter.FirstUnicastAddress;
        while !current_unicast.is_null() {
            let unicast = &*current_unicast;
            if unicast.Address.lpSockaddr.cast::<SOCKADDR_IN>().is_null() {
                current_unicast = unicast.Next;
                continue;
            }
            
            let sock_addr = &*unicast.Address.lpSockaddr.cast::<SOCKADDR_IN>();
            let ip_bytes = sock_addr.sin_addr.S_un.S_addr.to_ne_bytes();
            let ip = Ipv4Addr::new(ip_bytes[0], ip_bytes[1], ip_bytes[2], ip_bytes[3]);
            
            if !ip.is_loopback() && !ip.is_multicast() {
                ipv4_addr = Some(ip.to_string());
                break;
            }
            
            current_unicast = unicast.Next;
        }
        
        // Determinar tipo de ligação
        let connection_type = match adapter.IfType {
            IF_TYPE_ETHERNET_CSMACD => "ethernet",
            IF_TYPE_IEEE80211 => "wifi",
            IF_TYPE_PPP => "ppp",
            _ => "other",
        };
        
        // Obter nome da interface
        let interface_name = wide_string_to_string(&adapter.FriendlyName);
        
        // Verificar se é ligação medida (Windows 10+)
        let is_metered = adapter.ConnectionType == NET_CONNECTION_PROFILE_TYPE_NET_CONNECTION_PROFILE_TYPE_CELLULAR.0
            || adapter.ConnectionType == NET_CONNECTION_PROFILE_TYPE_NET_CONNECTION_PROFILE_TYPE_UNKNOWN.0;
        
        Ok(NetworkState {
            is_connected: true,
            connection_type: connection_type.to_string(),
            ipv4_address: ipv4_addr,
            interface_name,
            is_metered,
        })
    }
}

/// Implementação para macOS usando comandos de sistema.
#[cfg(target_os = "macos")]
fn get_network_state_macos() -> Result<NetworkState, String> {
    use std::process::Command;
    
    // Tentar obter informação via networksetup
    let output = Command::new("networksetup")
        .arg("-listallhardwareports")
        .output();
    
    let has_network = output.is_ok();
    
    // Tentar obter endereço IP
    let ip_output = Command::new("ipconfig")
        .arg("getifaddr")
        .arg("en0")
        .output();
    
    let ipv4_address = ip_output
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    
    // Determinar tipo de ligação
    let connection_type = if ipv4_address.is_some() {
        "wifi"
    } else {
        "unknown"
    }.to_string();
    
    Ok(NetworkState {
        is_connected: has_network && ipv4_address.is_some(),
        connection_type,
        ipv4_address,
        interface_name: "en0".to_string(),
        is_metered: false, // macOS não expõe isto facilmente
    })
}

/// Implementação para Linux lendo /proc e comandos de sistema.
#[cfg(target_os = "linux")]
fn get_network_state_linux() -> Result<NetworkState, String> {
    use std::fs;
    use std::net::UdpSocket;
    
    // Verificar conectividade tentando ligar a um servidor público
    let is_connected = UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| socket.connect("8.8.8.8:53"))
        .is_ok();
    
    // Ler informações de rede de /proc/net/route
    let route_content = fs::read_to_string("/proc/net/route").unwrap_or_default();
    
    let mut ipv4_address: Option<String> = None;
    let mut interface_name = "unknown".to_string();
    
    for line in route_content.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 8 {
            let iface = parts[0];
            let destination = parts[1];
            
            // Route padrão (00000000)
            if destination == "00000000" {
                interface_name = iface.to_string();
                
                // Tentar obter IP desta interface
                if let Ok(output) = std::process::Command::new("hostname")
                    .arg("-I")
                    .output()
                {
                    if let Ok(ip_str) = String::from_utf8(output.stdout) {
                        ipv4_address = ip_str
                            .split_whitespace()
                            .next()
                            .map(|s| s.trim().to_string());
                    }
                }
                break;
            }
        }
    }
    
    // Determinar tipo de ligação pelo nome da interface
    let connection_type = if interface_name.starts_with("eth") {
        "ethernet"
    } else if interface_name.starts_with("wlan") || interface_name.starts_with("wl") {
        "wifi"
    } else if interface_name.starts_with("ppp") {
        "ppp"
    } else {
        "other"
    }.to_string();
    
    Ok(NetworkState {
        is_connected,
        connection_type,
        ipv4_address,
        interface_name,
        is_metered: false, // Linux requer dbus para isto
    })
}

/// Converte uma string wide (UTF-16) do Windows para String Rust.
#[cfg(target_os = "windows")]
fn wide_string_to_string(wide: &windows::core::PCWSTR) -> String {
    if wide.is_null() {
        return "unknown".to_string();
    }
    
    unsafe {
        let mut len = 0;
        let mut ptr = wide.0;
        
        while *ptr != 0 {
            len += 1;
            ptr = ptr.add(1);
        }
        
        if len == 0 {
            return "unknown".to_string();
        }
        
        let slice = std::slice::from_raw_parts(wide.0, len as usize);
        String::from_utf16_lossy(slice)
    }
}

/// Inicia a vigilância de mudanças na rede.
/// Emite eventos `automation://network-changed` quando o estado muda.
#[tauri::command]
pub fn watch_network<R: Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    if IS_WATCHING.swap(true, Ordering::SeqCst) {
        return Err("Já está a vigiar a rede".to_string());
    }
    
    let mut last_state = get_current_network_state()?;
    
    std::thread::spawn(move || {
        loop {
            if !IS_WATCHING.load(Ordering::SeqCst) {
                break;
            }
            
            std::thread::sleep(Duration::from_secs(5));
            
            match get_current_network_state() {
                Ok(current_state) => {
                    if current_state != last_state {
                        // Estado mudou - emitir evento
                        let event_result = app.emit("automation://network-changed", &current_state);
                        
                        if let Err(e) = event_result {
                            eprintln!("Falha ao emitir evento de rede: {}", e);
                        } else {
                            println!(
                                "Mudança de rede detetada: {} ({})",
                                if current_state.is_connected {
                                    "ligado"
                                } else {
                                    "desligado"
                                },
                                current_state.connection_type
                            );
                        }
                        
                        last_state = current_state;
                    }
                }
                Err(e) => {
                    eprintln!("Erro ao obter estado da rede: {}", e);
                }
            }
        }
    });
    
    Ok(())
}

/// Para a vigilância de mudanças na rede.
#[tauri::command]
pub fn unwatch_network() -> Result<(), String> {
    if !IS_WATCHING.swap(false, Ordering::SeqCst) {
        return Err("Não estava a vigiar a rede".to_string());
    }
    
    println!("Vigilância de rede parada");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_network_state_default() {
        let state = NetworkState::default();
        assert!(!state.is_connected);
        assert_eq!(state.connection_type, "unknown");
        assert!(state.ipv4_address.is_none());
        assert_eq!(state.interface_name, "unknown");
        assert!(!state.is_metered);
    }
    
    #[test]
    fn test_get_network_state_returns_valid_state() {
        let result = get_network_state();
        assert!(result.is_ok());
        let state = result.unwrap();
        
        // Pelo menos a estrutura deve ser válida
        assert!(!state.connection_type.is_empty());
        assert!(!state.interface_name.is_empty());
    }
    
    #[test]
    fn test_watch_unwatch_lifecycle() {
        // Simular ciclo de vida básico
        assert!(!IS_WATCHING.load(Ordering::SeqCst));
        
        // Nota: Não podemos testar watch_network sem um AppHandle real
        // Este teste verifica apenas o flag atómico
        
        IS_WATCHING.store(true, Ordering::SeqCst);
        assert!(IS_WATCHING.load(Ordering::SeqCst));
        
        IS_WATCHING.store(false, Ordering::SeqCst);
        assert!(!IS_WATCHING.load(Ordering::SeqCst));
    }
    
    #[test]
    fn test_network_state_serialization() {
        let state = NetworkState {
            is_connected: true,
            connection_type: "wifi".to_string(),
            ipv4_address: Some("192.168.1.100".to_string()),
            interface_name: "Wi-Fi".to_string(),
            is_metered: false,
        };
        
        let json = serde_json::to_string(&state).unwrap();
        assert!(json.contains("\"is_connected\":true"));
        assert!(json.contains("\"connection_type\":\"wifi\""));
        assert!(json.contains("\"ipv4_address\":\"192.168.1.100\""));
        
        let deserialized: NetworkState = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, state);
    }
    
    #[test]
    #[cfg(target_os = "linux")]
    fn test_linux_network_detection() {
        // Teste específico para Linux
        let state = get_network_state_linux().unwrap();
        
        // Em ambiente de contentor, pode não haver rede real
        // Mas a função não deve falhar
        assert!(!state.connection_type.is_empty());
        assert!(!state.interface_name.is_empty());
    }
}
