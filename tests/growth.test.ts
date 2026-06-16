import { describe, it, expect } from "vitest";
import { calcularGrowth, gerarPreNota, formatBRL } from "../src/growth";

describe("formatBRL", () => {
  it("formata em reais (pt-BR)", () => {
    expect(formatBRL(1500)).toBe("R$ 1.500,00");
    expect(formatBRL(2500.5)).toBe("R$ 2.500,50");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("calcularGrowth — MRR, custos e CAC", () => {
  const receitas = [
    { valor: 1000, tipo: "recorrente" },
    { valor: 500, tipo: "recorrente" },
    { valor: 2000, tipo: "unica" },
  ];
  const custos = [
    { valor: 800, tipo: "fixo_mensal" },
    { valor: 1200, tipo: "anuncios" },
    { valor: 300, tipo: "unico" },
  ];

  it("MRR conta só receita recorrente", () => {
    expect(calcularGrowth({ receitas, custos, clientesConvertidos: 4 }).mrr).toBe(1500);
  });
  it("separa custos por tipo", () => {
    const g = calcularGrowth({ receitas, custos, clientesConvertidos: 4 });
    expect(g.custoFixoMensal).toBe(800);
    expect(g.investimentoAnuncios).toBe(1200);
    expect(g.custoUnico).toBe(300);
  });
  it("CAC = anúncios ÷ clientes convertidos", () => {
    expect(calcularGrowth({ receitas, custos, clientesConvertidos: 4 }).cac).toBe(300);
  });
  it("CAC é null sem clientes convertidos (sem divisão por zero)", () => {
    expect(calcularGrowth({ receitas, custos, clientesConvertidos: 0 }).cac).toBeNull();
  });
  it("tudo zero em base vazia", () => {
    const g = calcularGrowth({ receitas: [], custos: [], clientesConvertidos: 0 });
    expect(g.mrr).toBe(0);
    expect(g.cac).toBeNull();
  });
});

describe("gerarPreNota — documento auxiliar (não-fiscal)", () => {
  const pn = gerarPreNota({
    numero: "PN-2026-001",
    clienteNome: "Construtora Horizonte Ltda.",
    descricaoServico: "Honorários — contestação trabalhista",
    valor: 3500,
    vencimento: "2026-07-10",
  });
  it("traz cabeçalho, cliente, valor em R$ e vencimento", () => {
    expect(pn).toContain("PRÉ-NOTA");
    expect(pn).toContain("PN-2026-001");
    expect(pn).toContain("Construtora Horizonte Ltda.");
    expect(pn).toContain("R$ 3.500,00");
    expect(pn).toContain("2026-07-10");
  });
  it("avisa que NÃO é nota fiscal (invariante)", () => {
    expect(pn.toLowerCase()).toContain("não é nota fiscal");
  });
});
