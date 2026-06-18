import { describe, it, expect } from "vitest";
import {
  ehDiaUtil,
  proximoDiaUtil,
  adicionarDiasUteis,
  calcularPrazo,
  feriadosNacionais,
} from "../src/prazos";

describe("ehDiaUtil — fins de semana e feriados não contam (spec §7.3)", () => {
  it("dia de semana comum é útil", () => {
    expect(ehDiaUtil("2026-01-02")).toBe(true); // sexta
  });
  it("sábado e domingo não são úteis", () => {
    expect(ehDiaUtil("2026-01-03")).toBe(false); // sábado
    expect(ehDiaUtil("2026-01-04")).toBe(false); // domingo
  });
  it("feriado nacional fixo não é útil", () => {
    expect(ehDiaUtil("2026-01-01")).toBe(false); // Confraternização (quinta)
    expect(ehDiaUtil("2026-04-21")).toBe(false); // Tiradentes (terça)
    expect(ehDiaUtil("2026-11-20")).toBe(false); // Consciência Negra
  });
  it("feriado móvel (baseado na Páscoa) não é útil", () => {
    expect(ehDiaUtil("2026-04-03")).toBe(false); // Sexta-feira Santa
    expect(ehDiaUtil("2026-02-17")).toBe(false); // Carnaval (terça)
    expect(ehDiaUtil("2026-06-04")).toBe(false); // Corpus Christi
  });
});

describe("feriadosNacionais — conjunto por ano", () => {
  it("inclui fixos e móveis de 2026", () => {
    const f = feriadosNacionais(2026);
    for (const d of ["2026-01-01", "2026-09-07", "2026-12-25", "2026-04-03", "2026-06-04"]) {
      expect(f.has(d)).toBe(true);
    }
  });
});

describe("proximoDiaUtil — prorroga p/ o próximo útil", () => {
  it("sábado vira segunda", () => {
    expect(proximoDiaUtil("2026-01-03")).toBe("2026-01-05"); // sáb → seg
  });
  it("dia útil permanece", () => {
    expect(proximoDiaUtil("2026-01-02")).toBe("2026-01-02");
  });
  it("feriado emendado em fim de semana pula tudo", () => {
    // 2026-01-01 (qui, feriado) → 01-02 (sex, útil)
    expect(proximoDiaUtil("2026-01-01")).toBe("2026-01-02");
  });
});

describe("adicionarDiasUteis — pula fim de semana e feriado no meio", () => {
  it("conta dias úteis a partir do início (início = dia 1)", () => {
    // início sexta 01-02; +5 dias úteis (contando o início) = 01-08 (qui)
    expect(adicionarDiasUteis("2026-01-02", 5)).toBe("2026-01-08");
  });
  it("pula feriado no meio da contagem", () => {
    // início 04-17 (sex); 04-21 (ter, Tiradentes) não conta
    // d1=04-17, d2=04-20, [04-21 feriado], d3=04-22, d4=04-23
    expect(adicionarDiasUteis("2026-04-17", 4)).toBe("2026-04-23");
  });
});

describe("calcularPrazo — CPC art. 224/219 (começa no 1º dia útil seguinte)", () => {
  it("publicação em feriado: início no próximo dia útil", () => {
    // publicação 01-01 (feriado) → início 01-02; 5 dias úteis → 01-08
    const r = calcularPrazo("2026-01-01", 5);
    expect(r.inicio).toBe("2026-01-02");
    expect(r.dataFatal).toBe("2026-01-08");
  });
  it("prazo que atravessa feriado no meio", () => {
    // publicação 04-16 (qui) → início 04-17 (sex); 4 dias úteis com 04-21 feriado → 04-23
    const r = calcularPrazo("2026-04-16", 4);
    expect(r.inicio).toBe("2026-04-17");
    expect(r.dataFatal).toBe("2026-04-23");
  });
  it("data fatal nunca cai em fim de semana ou feriado", () => {
    for (let dias = 1; dias <= 30; dias++) {
      const { dataFatal } = calcularPrazo("2026-02-13", dias); // sexta antes do Carnaval
      expect(ehDiaUtil(dataFatal)).toBe(true);
    }
  });
});
