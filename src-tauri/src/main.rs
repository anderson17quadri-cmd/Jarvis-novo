// Esconde a consola no Windows em release. Em debug fica visível para os logs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    jarvis_ai_os_lib::run();
}
