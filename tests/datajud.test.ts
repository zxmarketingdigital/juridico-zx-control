import { describe, it, expect } from "vitest";
import { normalizarNumero, aliasDoNumero } from "../src/datajud";

describe("normalizarNumero — só dígitos, 20 posições", () => {
  it("remove pontuação do número CNJ", () => {
    expect(normalizarNumero("1001234-56.2025.8.26.0100")).toBe("10012345620258260100");
  });
  it("mantém número já sem pontuação", () => {
    expect(normalizarNumero("10012345620258260100")).toBe("10012345620258260100");
  });
  it("rejeita número com tamanho errado", () => {
    expect(() => normalizarNumero("123")).toThrow();
  });
});

describe("aliasDoNumero — deriva o tribunal (segmento J + TR)", () => {
  const casos: Array<[string, string]> = [
    ["1001234-56.2025.8.26.0100", "api_publica_tjsp"], // Estadual SP
    ["7007890-12.2025.8.19.0224", "api_publica_tjrj"], // Estadual RJ
    ["0001234-56.2025.8.13.0100", "api_publica_tjmg"], // Estadual MG
    ["8008901-23.2025.5.02.0301", "api_publica_trt2"], // Trabalho TRT2
    ["0000123-45.2025.5.00.0000", "api_publica_tst"], // Trabalho superior (TST)
    ["0004567-89.2025.4.01.3400", "api_publica_trf1"], // Federal TRF1
    ["0000123-45.2025.3.00.0000", "api_publica_stj"], // Superior STJ
  ];
  for (const [num, alias] of casos) {
    it(`${num} → ${alias}`, () => {
      expect(aliasDoNumero(num)).toBe(alias);
    });
  }
  it("lança em segmento não suportado", () => {
    expect(() => aliasDoNumero("0000123-45.2025.2.00.0000")).toThrow();
  });
});
