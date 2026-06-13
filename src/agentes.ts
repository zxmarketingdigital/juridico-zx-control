// ════════════════════════════════════════════════════════════════════════
// Os 5 agentes (spec §4). Cada agente: título + construtor de prompt. Nenhum
// prompt pede jurisprudência/julgados (spec §7.2 — INSTRUCAO_BASE reforça).
// O disclaimer é anexado pelo wrapper de IA (src/ia.ts) em todo output.
//
// Extrator de Prazos: além do texto, produz uma linha de `prazos` com a data
// fatal calculada em dias úteis (src/prazos.ts). `montarPrazo` GRAVA os campos
// e `classificarPrazo` (agenda) LÊ os mesmos campos — caminho grava-vs-lê.
// ════════════════════════════════════════════════════════════════════════

import { AGENTES, type Agente, type StatusPrazo, PRAZO_ALERTA_DIAS } from "./schema";
import { calcularPrazo, diferencaEmDias } from "./prazos";

export interface AgenteDef {
  titulo: string;
  /** Constrói o prompt do usuário a partir da entrada do formulário. */
  prompt: (entrada: Record<string, unknown>) => string;
}

const s = (v: unknown): string => (v == null ? "" : String(v));

export const AGENTE_DEFS: Record<Agente, AgenteDef> = {
  analisador_contratos: {
    titulo: "Analisador de Contratos",
    prompt: (e) =>
      [
        "Analise o contrato anexado.",
        e.representa ? `O advogado representa: ${s(e.representa)}.` : "",
        "Liste, de forma estruturada em markdown:",
        "1) Riscos para a parte representada;",
        "2) Cláusulas abusivas ou faltantes;",
        "3) Sugestões de redação;",
        "4) Um semáforo por cláusula (🟢 baixa / 🟡 média / 🔴 alta atenção).",
      ]
        .filter(Boolean)
        .join("\n"),
  },
  gerador_pecas: {
    titulo: "Gerador de Petições/Minutas",
    prompt: (e) =>
      [
        `Redija uma minuta de ${s(e.tipo) || "peça jurídica"} em markdown.`,
        `Fatos: ${s(e.fatos)}`,
        `Partes: ${s(e.partes)}`,
        `Pedidos: ${s(e.pedidos)}`,
        "Estruture com cabeçalho, dos fatos, do direito (em tese, sem citar julgados) e dos pedidos.",
      ].join("\n"),
  },
  resumidor_processos: {
    titulo: "Resumidor de Processos",
    prompt: () =>
      [
        "Com base nos documentos anexados (autos/decisões/despachos), produza em markdown:",
        "1) Resumo executivo;",
        "2) Linha do tempo dos eventos;",
        "3) Situação atual;",
        "4) Próximos passos sugeridos.",
      ].join("\n"),
  },
  extrator_prazos: {
    titulo: "Extrator de Prazos",
    prompt: (e) =>
      [
        "Leia a intimação/publicação anexada ou colada e identifique o prazo processual.",
        e.texto ? `Texto: ${s(e.texto)}` : "",
        "Responda em markdown com: tipo do prazo, número de DIAS ÚTEIS e o termo inicial.",
        "Não calcule a data final — o sistema a calcula em dias úteis.",
      ]
        .filter(Boolean)
        .join("\n"),
  },
  triagem_cliente: {
    titulo: "Triagem de Cliente",
    prompt: (e) =>
      [
        "A partir do relato do cliente abaixo, produza em markdown:",
        "1) Ficha do caso (partes, fatos, pedido);",
        "2) Área do direito provável;",
        "3) Documentos que o cliente deve trazer;",
        "4) Avaliação preliminar de viabilidade (forte/médio/fraco) com justificativa em tese.",
        `Relato: ${s(e.texto)}`,
      ].join("\n"),
  },
};

// ── Extrator de Prazos: persistência (grava-vs-lê) ────────────────────────

export interface ExtracaoPrazo {
  tipo: string;
  diasUteis: number;
  dataPublicacao: string; // 'YYYY-MM-DD'
}

export interface PrazoRow {
  caso_id: string | null;
  tipo: string | null;
  data_publicacao: string | null;
  data_fatal: string;
  dias: number | null;
  status: StatusPrazo;
}

/** Monta a linha de `prazos` com a data fatal calculada em dias úteis. */
export function montarPrazo(ext: ExtracaoPrazo, casoId: string | null): PrazoRow {
  const { dataFatal } = calcularPrazo(ext.dataPublicacao, ext.diasUteis);
  return {
    caso_id: casoId,
    tipo: ext.tipo,
    data_publicacao: ext.dataPublicacao,
    data_fatal: dataFatal,
    dias: ext.diasUteis,
    status: "pendente",
  };
}

export type ClassePrazo = "cumprido" | "vencido" | "vencendo" | "ok";

/**
 * Classifica um prazo para a agenda lendo `status` e `data_fatal` — os mesmos
 * campos que `montarPrazo` grava. Destaque para vencidos e vencendo em
 * ≤ PRAZO_ALERTA_DIAS dias (spec §6.4).
 */
export function classificarPrazo(
  prazo: Pick<PrazoRow, "status" | "data_fatal">,
  hoje: string,
): ClassePrazo {
  if (prazo.status === "cumprido") return "cumprido";
  const faltam = diferencaEmDias(hoje, prazo.data_fatal);
  if (faltam < 0) return "vencido";
  if (faltam <= PRAZO_ALERTA_DIAS) return "vencendo";
  return "ok";
}
