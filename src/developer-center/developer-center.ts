/**
 * Fase 2 — Developer Center.
 *
 * Só a interface. O painel onde se cria, testa e publica um plugin sem sair
 * do JARVIS.
 */

import type { PluginManifest } from '@/plugins/plugin';

export interface ScaffoldOptions {
  readonly name: string;
  readonly template: 'window' | 'widget' | 'automation' | 'mcp-server';
  readonly targetDirectory: string;
}

export interface BuildResult {
  readonly succeeded: boolean;
  readonly output: string;
  readonly durationMs: number;
  readonly artifactPath: string | null;
}

export interface ValidationIssue {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly file: string | null;
}

export interface DeveloperCenter {
  scaffold(options: ScaffoldOptions): Promise<string>;
  validate(manifest: PluginManifest): Promise<readonly ValidationIssue[]>;
  build(directory: string): Promise<BuildResult>;
  /** Instala localmente sem passar pelo marketplace. */
  installLocal(artifactPath: string): Promise<void>;
  publish(artifactPath: string): Promise<void>;
}
