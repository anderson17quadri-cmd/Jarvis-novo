#[cfg(desktop)]
pub mod battery;
#[cfg(desktop)]
pub mod files;
#[cfg(desktop)]
pub mod secrets;
pub mod system;

#[cfg(desktop)]
pub mod terminal;
// `#[cfg(desktop)]`, não `target_os = "windows"`, seria inexato: o ficheiro já
// usa `std::os::windows::ffi::OsStringExt` e `SetupDiGetClassDevsW`, que só
// existem a compilar para Windows — em qualquer outro desktop nem chegaria a
// compilar. O gate aqui só torna essa realidade explícita.
#[cfg(target_os = "windows")]
pub mod usb;
#[cfg(desktop)]
pub mod windows_hello;
