// ════════════════════════════════════════════════════════════════════════
// DataJud (API pública do CNJ) — confirma o processo, lê a capa e os
// andamentos/movimentações. Alimenta o Resumidor e o monitoramento.
// `aliasDoNumero` é função pura (testada); `consultarProcesso` faz a chamada.
// ════════════════════════════════════════════════════════════════════════

import { DATAJUD_BASE_URL, DATAJUD_API_KEY_PUBLICA, DATAJUD_TIMEOUT_MS } from "./config";

/** Código TR (Justiça Estadual, J=8) → UF, conforme tabela do CNJ (Res. 65). */
const UF_POR_TR_ESTADUAL: Record<string, string> = {
  "01": "ac", "02": "al", "03": "ap", "04": "am", "05": "ba", "06": "ce",
  "07": "dft", "08": "es", "09": "go", "10": "ma", "11": "mt", "12": "ms",
  "13": "mg", "14": "pa", "15": "pb", "16": "pr", "17": "pe", "18": "pi",
  "19": "rj", "20": "rn", "21": "rs", "22": "ro", "23": "rr", "24": "sc",
  "25": "se", "26": "sp", "27": "to",
};

/** Remove pontuação e valida que o número CNJ tem 20 dígitos. */
export function normalizarNumero(numero: string): string {
  const d = (numero || "").replace(/\D/g, "");
  if (d.length !== 20) throw new Error("Número CNJ inválido (esperado 20 dígitos).");
  return d;
}

/**
 * Deriva o alias do tribunal na API pública do DataJud a partir do número CNJ.
 * Formato NNNNNNN-DD.AAAA.J.TR.OOOO → usa o segmento J (pos. 13) e o TR (14-15).
 */
export function aliasDoNumero(numero: string): string {
  const d = normalizarNumero(numero);
  const j = d[13];
  const tr = d.slice(14, 16);
  switch (j) {
    case "8": {
      const uf = UF_POR_TR_ESTADUAL[tr];
      if (!uf) throw new Error(`Tribunal estadual desconhecido (TR=${tr}).`);
      return `api_publica_tj${uf}`;
    }
    case "5": // Justiça do Trabalho
      return tr === "00" ? "api_publica_tst" : `api_publica_trt${Number(tr)}`;
    case "4": // Justiça Federal
      return tr === "00" ? "api_publica_cjf" : `api_publica_trf${Number(tr)}`;
    case "3": // STJ
      return "api_publica_stj";
    case "6": // Justiça Eleitoral
      return tr === "00" ? "api_publica_tse" : `api_publica_tre${UF_POR_TR_ESTADUAL[tr] ?? tr}`;
    case "7": // Justiça Militar da União
      return "api_publica_stm";
    default:
      throw new Error(`Segmento do Judiciário não suportado (J=${j}).`);
  }
}

export interface Movimento {
  data: string | null;
  codigo: number | null;
  descricao: string;
}

export interface ProcessoDataJud {
  existe: boolean;
  numero: string;
  capa: {
    classe: string | null;
    assuntos: string[];
    orgaoJulgador: string | null;
    tribunal: string | null;
    grau: string | null;
    dataAjuizamento: string | null;
  } | null;
  movimentos: Movimento[];
}

export interface DataJudEnv {
  DATAJUD_API_KEY?: string;
}

/**
 * Consulta um processo na API pública do DataJud. Retorna capa + movimentos
 * (ordenados do mais recente). `existe:false` se não encontrado.
 */
export async function consultarProcesso(
  numero: string,
  env: DataJudEnv,
): Promise<ProcessoDataJud> {
  const num = normalizarNumero(numero);
  const alias = aliasDoNumero(num);
  const apiKey = env.DATAJUD_API_KEY || DATAJUD_API_KEY_PUBLICA;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DATAJUD_TIMEOUT_MS);
  try {
    const resp = await fetch(`${DATAJUD_BASE_URL}/${alias}/_search`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `APIKey ${apiKey}` },
      body: JSON.stringify({ query: { match: { numeroProcesso: num } } }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error(`DataJud HTTP ${resp.status}`);
    const json = (await resp.json()) as {
      hits?: { hits?: { _source?: Record<string, unknown> }[] };
    };
    const src = json.hits?.hits?.[0]?._source;
    if (!src) return { existe: false, numero: num, capa: null, movimentos: [] };

    return {
      existe: true,
      numero: num,
      capa: {
        classe: (src.classe as { nome?: string })?.nome ?? null,
        assuntos: Array.isArray(src.assuntos)
          ? (src.assuntos as { nome?: string }[]).map((a) => a.nome ?? "").filter(Boolean)
          : [],
        orgaoJulgador: (src.orgaoJulgador as { nome?: string })?.nome ?? null,
        tribunal: (src.tribunal as string) ?? null,
        grau: (src.grau as string) ?? null,
        dataAjuizamento: (src.dataAjuizamento as string) ?? null,
      },
      movimentos: Array.isArray(src.movimentos)
        ? (src.movimentos as { dataHora?: string; codigo?: number; nome?: string }[])
            .map((m) => ({ data: m.dataHora ?? null, codigo: m.codigo ?? null, descricao: m.nome ?? "" }))
            .sort((a, b) => (b.data ?? "").localeCompare(a.data ?? ""))
        : [],
    };
  } finally {
    clearTimeout(timer);
  }
}
