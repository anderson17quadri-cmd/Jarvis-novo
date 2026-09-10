#!/usr/bin/env node
/**
 * Testa DeepSeek, Claude e Ollama diretamente pelo terminal, sem abrir a app.
 *
 * Cada provedor lê a configuração de uma variável de ambiente — nunca de um
 * ficheiro, para não haver chave nenhuma escrita em disco por este script.
 * Um provedor sem a variável definida não é erro: é "não configurado", e o
 * script diz isso e passa ao seguinte, exatamente como o `AIService` faz
 * dentro da app (Parte 12 §Orquestrador multi-provedor).
 *
 * Uso:
 *   DEEPSEEK_API_KEY=sk-... node scripts/testar-provedores.mjs
 *   ANTHROPIC_API_KEY=sk-ant-... node scripts/testar-provedores.mjs
 *   OLLAMA_MODEL=llama3.1 node scripts/testar-provedores.mjs
 *
 * Ou os três de uma vez — cada um testa-se sozinho, independente dos outros.
 */

const PROMPT = 'Responde só com a palavra: pronto';
const TIMEOUT_MS = 20_000;

async function withTimeout(promise, label) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${label}: demorou mais de ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS),
  );
  return Promise.race([promise, timeout]);
}

async function testarDeepSeek() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { nome: 'DeepSeek', estado: 'sem-configuracao' };

  const inicio = Date.now();
  try {
    const response = await withTimeout(
      fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: PROMPT }],
          stream: false,
        }),
      }),
      'DeepSeek',
    );

    if (!response.ok) {
      return { nome: 'DeepSeek', estado: 'falhou', detalhe: `HTTP ${response.status}` };
    }

    const body = await response.json();
    const texto = body.choices?.[0]?.message?.content ?? '(sem texto)';
    return { nome: 'DeepSeek', estado: 'ok', ms: Date.now() - inicio, texto };
  } catch (error) {
    return { nome: 'DeepSeek', estado: 'falhou', detalhe: String(error.message ?? error) };
  }
}

async function testarClaude() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { nome: 'Claude', estado: 'sem-configuracao' };

  const inicio = Date.now();
  try {
    const response = await withTimeout(
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 32,
          messages: [{ role: 'user', content: PROMPT }],
        }),
      }),
      'Claude',
    );

    if (!response.ok) {
      return { nome: 'Claude', estado: 'falhou', detalhe: `HTTP ${response.status}` };
    }

    const body = await response.json();
    const texto = body.content?.find((block) => block.type === 'text')?.text ?? '(sem texto)';
    return { nome: 'Claude', estado: 'ok', ms: Date.now() - inicio, texto };
  } catch (error) {
    return { nome: 'Claude', estado: 'falhou', detalhe: String(error.message ?? error) };
  }
}

async function testarOllama() {
  const modelo = process.env.OLLAMA_MODEL;
  if (!modelo) return { nome: 'Ollama', estado: 'sem-configuracao' };

  const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
  const inicio = Date.now();

  try {
    const response = await withTimeout(
      fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: 'user', content: PROMPT }],
          stream: false,
        }),
      }),
      'Ollama',
    );

    if (!response.ok) {
      return { nome: 'Ollama', estado: 'falhou', detalhe: `HTTP ${response.status} — o modelo "${modelo}" está instalado? Corre "ollama pull ${modelo}".` };
    }

    const body = await response.json();
    const texto = body.choices?.[0]?.message?.content ?? '(sem texto)';
    return { nome: 'Ollama', estado: 'ok', ms: Date.now() - inicio, texto };
  } catch (error) {
    return {
      nome: 'Ollama',
      estado: 'falhou',
      detalhe: `${error.message ?? error} — o Ollama está a correr? Corre "ollama serve" ou abre a app do Ollama.`,
    };
  }
}

function linha(resultado) {
  if (resultado.estado === 'sem-configuracao') {
    return `○ ${resultado.nome} — não configurado (variável de ambiente em falta)`;
  }
  if (resultado.estado === 'falhou') {
    return `✗ ${resultado.nome} — falhou: ${resultado.detalhe}`;
  }
  return `✓ ${resultado.nome} — respondeu em ${resultado.ms}ms: "${resultado.texto.trim()}"`;
}

const resultados = await Promise.all([testarDeepSeek(), testarClaude(), testarOllama()]);

console.log('');
for (const resultado of resultados) console.log(linha(resultado));
console.log('');

const configurados = resultados.filter((r) => r.estado !== 'sem-configuracao');
if (configurados.length === 0) {
  console.log('Nenhum provedor configurado. Define pelo menos uma variável de ambiente — ver o topo deste ficheiro.');
  process.exit(0);
}

const falharam = configurados.filter((r) => r.estado === 'falhou');
if (falharam.length > 0) {
  console.log(`${falharam.length} de ${configurados.length} provedor(es) configurado(s) falhou/falharam.`);
  process.exit(1);
}

console.log(`Todos os ${configurados.length} provedor(es) configurado(s) responderam.`);
