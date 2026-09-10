use serde::Serialize;

/// Fotografia instantânea do sistema.
///
/// Os campos opcionais são os que nem todas as plataformas conseguem responder.
/// `None` significa "não é possível saber aqui" — a interface esconde o
/// elemento em vez de mostrar zero, que seria mentira.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub cpu: CpuMetrics,
    pub memory: MemoryMetrics,
    pub disk: DiskMetrics,
    pub network: NetworkMetrics,
    /// `None` em todas as plataformas por agora: o `sysinfo` não lê a GPU.
    pub gpu: Option<GpuMetrics>,
    /// Milissegundos desde a época Unix, no momento da leitura.
    pub captured_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CpuMetrics {
    /// Utilização global, 0–100.
    pub usage_percent: f32,
    /// Utilização por núcleo, 0–100.
    pub per_core: Vec<f32>,
    pub core_count: usize,
    /// Frequência do primeiro núcleo, em MHz. `None` se o sistema não reportar.
    pub frequency_mhz: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub swap_total_bytes: u64,
    pub swap_used_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskMetrics {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
    pub usage_percent: f32,
    pub volumes: Vec<VolumeMetrics>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeMetrics {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMetrics {
    /// Bytes recebidos desde a leitura anterior.
    pub received_bytes: u64,
    /// Bytes enviados desde a leitura anterior.
    pub transmitted_bytes: u64,
    /// Ritmo calculado com o tempo decorrido entre as duas leituras.
    pub download_bytes_per_sec: f64,
    pub upload_bytes_per_sec: f64,
    pub total_received_bytes: u64,
    pub total_transmitted_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuMetrics {
    pub name: String,
    pub usage_percent: Option<f32>,
    pub memory_used_bytes: Option<u64>,
    pub memory_total_bytes: Option<u64>,
}

/// Informação que não muda durante a sessão — lida uma vez e cacheada.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StaticSystemInfo {
    pub os_name: Option<String>,
    pub os_version: Option<String>,
    pub kernel_version: Option<String>,
    pub host_name: Option<String>,
    pub cpu_brand: String,
    pub cpu_arch: String,
    pub core_count: usize,
    pub total_memory_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f32,
    pub memory_bytes: u64,
}

/// Percentagem segura: devolve 0 em vez de `NaN` quando o total é zero.
pub fn percent(used: u64, total: u64) -> f32 {
    if total == 0 {
        return 0.0;
    }
    (used as f64 / total as f64 * 100.0) as f32
}
