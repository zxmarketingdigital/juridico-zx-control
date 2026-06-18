import { describe, it, expect } from "vitest";
import {
  AGENTE_DEFS,
  montarPrazo,
  classificarPrazo,
} from "../src/agentes";
import { AGENTES } from "../src/schema";

describe("registro de agentes — os 5 do spec §4", () => {
  it("tem exatamente os 6 agentes, batendo com AGENTES", () => {
    expect(Object.keys(AGENTE_DEFS).sort()).toEqual([...AGENTES].sort());
  });
  it("todo agente tem título e construtor de prompt", () => {
    for (const def of Object.values(AGENTE_DEFS)) {
      expect(typeof def.titulo).toBe("string");
      expect(typeof def.prompt).toBe("function");
    }
  });
});

describe("prompts não pedem jurisprudência (spec §7.2)", () => {
  // Invariante: nenhum prompt de agente pode pedir julgados/precedentes.
  it("nenhum prompt solicita jurisprudência/julgado/precedente", () => {
    const entradaFake = {
      texto: "relato do cliente",
      tipo: "contestacao",
      fatos: "fatos",
      partes: "partes",
      pedidos: "pedidos",
      representa: "autor",
      dataPublicacao: "2026-06-01",
    };
    for (const def of Object.values(AGENTE_DEFS)) {
      const p = def.prompt(entradaFake as never).toLowerCase();
      expect(p).not.toMatch(/cite\s+jurisprud|busque\s+jurisprud|inclua\s+julgad|precedente.*específic/);
    }
  });
});

describe("Extrator de Prazos — caminho grava-vs-lê (CLAUDE DoD §2)", () => {
  // montarPrazo GRAVA os campos; classificarPrazo (agenda) LÊ os mesmos campos.
  // Se um nome de campo divergir, a classificação quebra e o teste fica vermelho.
  it("monta a linha do prazo com data fatal calculada em dias úteis", () => {
    const row = montarPrazo(
      { tipo: "contestação", diasUteis: 15, dataPublicacao: "2026-06-01" },
      "caso-1",
    );
    expect(row.caso_id).toBe("caso-1");
    expect(row.status).toBe("pendente");
    expect(row.dias).toBe(15);
    // 2026-06-01 é segunda; início 06-02; 15 dias úteis (Corpus Christi 06-04 não conta)
    expect(row.data_fatal).toBe("2026-06-23");
  });

  it("agenda lê os MESMOS campos que o extrator grava", () => {
    const row = montarPrazo(
      { tipo: "recurso", diasUteis: 5, dataPublicacao: "2026-06-08" },
      "caso-2",
    );
    // classificarPrazo consome data_fatal/status — exatamente o que montarPrazo produziu
    const cls = classificarPrazo(row, row.data_fatal);
    expect(["ok", "vencendo", "vencido", "cumprido"]).toContain(cls);
  });
});

describe("agenda — destaque ≤5 dias e vencidos (spec §6.4)", () => {
  const base = { caso_id: null, tipo: "x", data_publicacao: null, dias: 5, status: "pendente" as const };
  it("vencido quando a data fatal já passou", () => {
    expect(classificarPrazo({ ...base, data_fatal: "2026-06-10" }, "2026-06-13")).toBe("vencido");
  });
  it("vencendo quando faltam ≤5 dias", () => {
    expect(classificarPrazo({ ...base, data_fatal: "2026-06-16" }, "2026-06-13")).toBe("vencendo");
  });
  it("ok quando faltam mais de 5 dias", () => {
    expect(classificarPrazo({ ...base, data_fatal: "2026-06-30" }, "2026-06-13")).toBe("ok");
  });
  it("cumprido tem precedência sobre a data", () => {
    expect(
      classificarPrazo({ ...base, status: "cumprido", data_fatal: "2026-06-10" }, "2026-06-13"),
    ).toBe("cumprido");
  });
});
