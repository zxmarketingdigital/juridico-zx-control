// ════════════════════════════════════════════════════════════════════════
// Growth — métricas (MRR, custos, CAC) e gerador de pré-notas. Funções puras,
// testadas. O painel "Growth" e a rota /api/growth consomem daqui.
// ════════════════════════════════════════════════════════════════════════

import type { ReceitaTipo, CustoTipo } from "./schema";

/** Formata um valor em reais (pt-BR), sem depender de ICU. */
export function formatBRL(valor: number): string {
  const n = Number(valor || 0).toFixed(2);
  const [int, dec] = n.split(".");
  const intF = int!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${intF},${dec}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const soma = <T extends { valor: number }>(arr: T[], pred: (x: T) => boolean) =>
  round2(arr.filter(pred).reduce((s, x) => s + Number(x.valor || 0), 0));

export interface ItemReceita {
  valor: number;
  tipo: ReceitaTipo | string;
}
export interface ItemCusto {
  valor: number;
  tipo: CustoTipo | string;
}

export interface Growth {
  mrr: number;
  custoFixoMensal: number;
  custoUnico: number;
  investimentoAnuncios: number;
  /** Custo recorrente do mês (fixo + anúncios). */
  custoMensalTotal: number;
  /** Investimento em anúncios ÷ clientes convertidos no período. */
  cac: number | null;
  clientesConvertidos: number;
}

export function calcularGrowth(args: {
  receitas: ItemReceita[];
  custos: ItemCusto[];
  clientesConvertidos: number;
}): Growth {
  const { receitas, custos, clientesConvertidos } = args;
  const mrr = soma(receitas, (r) => r.tipo === "recorrente");
  const custoFixoMensal = soma(custos, (c) => c.tipo === "fixo_mensal");
  const custoUnico = soma(custos, (c) => c.tipo === "unico");
  const investimentoAnuncios = soma(custos, (c) => c.tipo === "anuncios");
  const cac = clientesConvertidos > 0 ? round2(investimentoAnuncios / clientesConvertidos) : null;
  return {
    mrr,
    custoFixoMensal,
    custoUnico,
    investimentoAnuncios,
    custoMensalTotal: round2(custoFixoMensal + investimentoAnuncios),
    cac,
    clientesConvertidos,
  };
}

/** Monta o texto de uma pré-nota (documento auxiliar — NÃO é nota fiscal). */
export function gerarPreNota(args: {
  numero: string;
  clienteNome: string;
  descricaoServico: string;
  valor: number;
  vencimento?: string;
}): string {
  const { numero, clienteNome, descricaoServico, valor, vencimento } = args;
  return [
    `# PRÉ-NOTA ${numero}`,
    "",
    `**Cliente:** ${clienteNome}`,
    `**Serviço:** ${descricaoServico}`,
    `**Valor:** ${formatBRL(valor)}`,
    vencimento ? `**Vencimento:** ${vencimento}` : "",
    "",
    "---",
    "_Documento auxiliar de cobrança — **não é nota fiscal**. Emita a NF/NFS-e oficial pelo sistema da prefeitura/órgão competente._",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
