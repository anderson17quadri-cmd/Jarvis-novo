use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use sysinfo::{Disks, Networks, ProcessesToUpdate, System};

use super::metrics::{
    percent, CpuMetrics, DiskMetrics, MemoryMetrics, NetworkMetrics, ProcessInfo, StaticSystemInfo,
    SystemSnapshot, VolumeMetrics,
};
use crate::error::{Error, Result};

/// Estado partilhado do monitor de sistema.
///
/// Vive num `tauri::State` porque o `sysinfo` só sabe calcular percentagem de
/// CPU e ritmo de rede comparando duas leituras — criar um `System` novo a cada
/// comando devolveria sempre zero.
pub struct SystemMonitor {
    system: Mutex<System>,
    disks: Mutex<Disks>,
    networks: Mutex<Networks>,
    last_refresh: Mutex<Option<Instant>>,
}

impl SystemMonitor {
    pub fn new() -> Self {
        Self {
            system: Mutex::new(System::new_all()),
            disks: Mutex::new(Disks::new_with_refreshed_list()),
            networks: Mutex::new(Networks::new_with_refreshed_list()),
            last_refresh: Mutex::new(None),
        }
    }

    /// Lê CPU, memória, disco e rede de uma vez.
    pub fn snapshot(&self) -> Result<SystemSnapshot> {
        let elapsed_secs = self.mark_refresh()?;

        Ok(SystemSnapshot {
            cpu: self.cpu()?,
            memory: self.memory()?,
            disk: self.disk()?,
            network: self.network(elapsed_secs)?,
            // O `sysinfo` não expõe GPU em nenhuma plataforma. Fica `None` de
            // propósito: a interface esconde o cartão em vez de inventar 0%.
            gpu: None,
            captured_at: now_millis(),
        })
    }

    /// Regista o instante desta leitura e devolve os segundos desde a anterior.
    fn mark_refresh(&self) -> Result<f64> {
        let mut last = lock(&self.last_refresh, "last_refresh")?;
        let now = Instant::now();
        let elapsed = last.map(|prev| now.duration_since(prev).as_secs_f64());
        *last = Some(now);
        Ok(elapsed.unwrap_or(0.0))
    }

    fn cpu(&self) -> Result<CpuMetrics> {
        let mut sys = lock(&self.system, "system")?;
        sys.refresh_cpu_all();

        let per_core: Vec<f32> = sys.cpus().iter().map(sysinfo::Cpu::cpu_usage).collect();
        let frequency_mhz = sys.cpus().first().map(sysinfo::Cpu::frequency).filter(|f| *f > 0);

        Ok(CpuMetrics {
            usage_percent: sys.global_cpu_usage(),
            core_count: per_core.len(),
            per_core,
            frequency_mhz,
        })
    }

    fn memory(&self) -> Result<MemoryMetrics> {
        let mut sys = lock(&self.system, "system")?;
        sys.refresh_memory();

        let total = sys.total_memory();
        let used = sys.used_memory();

        Ok(MemoryMetrics {
            total_bytes: total,
            used_bytes: used,
            available_bytes: sys.available_memory(),
            usage_percent: percent(used, total),
            swap_total_bytes: sys.total_swap(),
            swap_used_bytes: sys.used_swap(),
        })
    }

    fn disk(&self) -> Result<DiskMetrics> {
        let mut disks = lock(&self.disks, "disks")?;
        disks.refresh(true);

        let mut total = 0_u64;
        let mut available = 0_u64;
        let mut volumes = Vec::new();

        for disk in disks.iter() {
            let disk_total = disk.total_space();
            let disk_available = disk.available_space();
            total = total.saturating_add(disk_total);
            available = available.saturating_add(disk_available);

            volumes.push(VolumeMetrics {
                name: disk.name().to_string_lossy().into_owned(),
                mount_point: disk.mount_point().to_string_lossy().into_owned(),
                total_bytes: disk_total,
                available_bytes: disk_available,
            });
        }

        let used = total.saturating_sub(available);

        Ok(DiskMetrics {
            total_bytes: total,
            used_bytes: used,
            available_bytes: available,
            usage_percent: percent(used, total),
            volumes,
        })
    }

    fn network(&self, elapsed_secs: f64) -> Result<NetworkMetrics> {
        let mut networks = lock(&self.networks, "networks")?;
        networks.refresh(true);

        let mut received = 0_u64;
        let mut transmitted = 0_u64;
        let mut total_received = 0_u64;
        let mut total_transmitted = 0_u64;

        for (_, data) in networks.iter() {
            received = received.saturating_add(data.received());
            transmitted = transmitted.saturating_add(data.transmitted());
            total_received = total_received.saturating_add(data.total_received());
            total_transmitted = total_transmitted.saturating_add(data.total_transmitted());
        }

        // Na primeira leitura não há intervalo — o ritmo fica a zero em vez de
        // dividir por zero e devolver infinito.
        let rate = |bytes: u64| -> f64 {
            if elapsed_secs <= 0.0 {
                0.0
            } else {
                bytes as f64 / elapsed_secs
            }
        };

        Ok(NetworkMetrics {
            received_bytes: received,
            transmitted_bytes: transmitted,
            download_bytes_per_sec: rate(received),
            upload_bytes_per_sec: rate(transmitted),
            total_received_bytes: total_received,
            total_transmitted_bytes: total_transmitted,
        })
    }

    pub fn static_info(&self) -> Result<StaticSystemInfo> {
        let sys = lock(&self.system, "system")?;
        let first_cpu = sys.cpus().first();

        Ok(StaticSystemInfo {
            os_name: System::name(),
            os_version: System::os_version(),
            kernel_version: System::kernel_version(),
            host_name: System::host_name(),
            cpu_brand: first_cpu.map(|c| c.brand().trim().to_owned()).unwrap_or_default(),
            cpu_arch: System::cpu_arch(),
            core_count: sys.cpus().len(),
            total_memory_bytes: sys.total_memory(),
        })
    }

    /// Processos que mais CPU consomem.
    ///
    /// O Android não deixa ler os processos de outras aplicações; aí o comando
    /// nem é chamado — o `AndroidAdapter` devolve lista vazia sem tocar no IPC.
    pub fn top_processes(&self, limit: usize) -> Result<Vec<ProcessInfo>> {
        let mut sys = lock(&self.system, "system")?;
        sys.refresh_processes(ProcessesToUpdate::All, true);

        let mut processes: Vec<ProcessInfo> = sys
            .processes()
            .iter()
            .map(|(pid, process)| ProcessInfo {
                pid: pid.as_u32(),
                name: process.name().to_string_lossy().into_owned(),
                cpu_percent: process.cpu_usage(),
                memory_bytes: process.memory(),
            })
            .collect();

        processes.sort_by(|a, b| {
            b.cpu_percent
                .partial_cmp(&a.cpu_percent)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        processes.truncate(limit);

        Ok(processes)
    }
}

impl Default for SystemMonitor {
    fn default() -> Self {
        Self::new()
    }
}

/// Um `Mutex` envenenado não pode derrubar a aplicação — vira erro tratável.
fn lock<'a, T>(mutex: &'a Mutex<T>, name: &str) -> Result<std::sync::MutexGuard<'a, T>> {
    mutex
        .lock()
        .map_err(|_| Error::SystemRead(format!("o bloqueio de `{name}` foi envenenado")))
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}
