// ════════════════════════════════════════════════════════════════════════
// Wrapper de IA — provider trocável (default Gemini Flash), retry + timeout
// (spec §2). Centraliza dois invariantes do nicho:
//  • DISCLAIMER obrigatório em todo output (spec §7.1) — `comDisclaimer()`.
//  • Proibição de citar jurisprudência/julgados (spec §7.2) — `INSTRUCAO_BASE`.
// "Um valor, um lugar": texto do disclaimer, instrução-base e parâmetros de
// retry/timeout ficam aqui; agentes importam, nunca repetem.
// ════════════════════════════════════════════════════════════════════════

import {
  GEMINI_BASE_URL,
  GEMINI_MODEL,
  IA_MAX_RETRIES,
  IA_TIMEOUT_MS,
} from "./config";

/** Texto exato do disclaimer (spec §7.1). Único lugar onde ele existe. */
export const DISCLAIMER =
  "Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória.";

/** Anexa o disclaimer ao final do texto (idempotente). */
export function comDisclaimer(texto: string): string {
  if (texto.includes(DISCLAIMER)) return texto;
  return `${texto.trimEnd()}\n\n---\n${DISCLAIMER}`;
}

/**
 * Instrução de sistema base de TODO agente. Proíbe explicitamente citar/inventar
 * jurisprudência, julgados, ementas, precedentes ou números de processo
 * (spec §7.2 — alucinação de julgado é risco profissional grave).
 */
export const INSTRUCAO_BASE = [
  "Você é um assistente jurídico para advogados no Brasil.",
  "NÃO cite, NÃO invente e NÃO mencione jurisprudência, julgados, ementas,",
  "precedentes nomeados nem números de processo específicos — isso está",
  "proibido. Baseie-se apenas na lei e nos fatos fornecidos.",
  "Responda em português do Brasil, de forma objetiva e estruturada.",
].join(" ");

/**
 * Executa `fn` com timeout (via AbortSignal) e novas tentativas.
 * Tentativas totais = 1 + retries. Cada tentativa tem seu próprio timeout.
 */
export async function executarComRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: { retries: number; timeoutMs: number },
): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa <= opts.retries; tentativa++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      return await fn(ctrl.signal);
    } catch (e) {
      ultimoErro = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error("falha na chamada de IA");
}

// ── Provider ──────────────────────────────────────────────────────────────

/** Documento inline (multimodal) — PDF vai direto ao modelo (spec §5). */
export interface DocumentoInline {
  mime: string;
  /** Conteúdo em base64. */
  dados: string;
}

export interface PedidoIA {
  prompt: string;
  documentos?: DocumentoInline[];
}

/** Contrato do provider de IA — trocável pelo aluno (spec §2). */
export interface ProvedorIA {
  gerar(pedido: PedidoIA): Promise<string>;
}

export interface IAEnv {
  GEMINI_API_KEY: string;
}

/** Provider padrão: Gemini Flash via REST, multimodal inline, retry+timeout. */
export function geminiProvider(env: IAEnv): ProvedorIA {
  return {
    async gerar({ prompt, documentos }) {
      const parts: unknown[] = [{ text: prompt }];
      for (const d of documentos ?? []) {
        parts.push({ inline_data: { mime_type: d.mime, data: d.dados } });
      }
      const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
      const body = JSON.stringify({
        system_instruction: { parts: [{ text: INSTRUCAO_BASE }] },
        contents: [{ role: "user", parts }],
      });

      const texto = await executarComRetry(
        async (signal) => {
          const resp = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            signal,
          });
          if (!resp.ok) throw new Error(`IA HTTP ${resp.status}`);
          const json = (await resp.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const out = json.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? "")
            .join("");
          if (!out) throw new Error("IA sem resposta");
          return out;
        },
        { retries: IA_MAX_RETRIES, timeoutMs: IA_TIMEOUT_MS },
      );

      return comDisclaimer(texto);
    },
  };
}
