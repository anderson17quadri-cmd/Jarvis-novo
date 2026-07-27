/**
 * Fase 2 — Model Context Protocol.
 *
 * Só a interface. As ferramentas de um servidor MCP acabarão a ser expostas ao
 * `AIService` como capacidades do assistente.
 */

export type McpTransport = 'stdio' | 'http';

export interface McpServerConfig {
  readonly id: string;
  readonly name: string;
  readonly transport: McpTransport;
  /** Comando a executar, no transporte `stdio`. */
  readonly command?: string;
  readonly args?: readonly string[];
  /** Endereço, no transporte `http`. */
  readonly url?: string;
}

export interface McpTool {
  readonly name: string;
  readonly description: string;
  /** JSON Schema dos parâmetros. */
  readonly inputSchema: Record<string, unknown>;
}

export type McpConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface McpClient {
  readonly config: McpServerConfig;
  readonly state: McpConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<readonly McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>;
}

export interface McpRegistry {
  servers(): readonly McpClient[];
  add(config: McpServerConfig): Promise<McpClient>;
  remove(id: string): Promise<void>;
  /** Todas as ferramentas de todos os servidores ligados. */
  allTools(): Promise<readonly McpTool[]>;
}
