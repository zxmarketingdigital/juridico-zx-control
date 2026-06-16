import { describe, it, expect } from "vitest";
import {
  DISCLAIMER,
  comDisclaimer,
  INSTRUCAO_BASE,
  executarComRetry,
} from "../src/ia";

describe("disclaimer obrigatório em todo output de IA (spec §7.1)", () => {
  it("usa exatamente o texto mandatório da linha", () => {
    expect(DISCLAIMER).toBe(
      "Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória.",
    );
  });
  it("anexa o disclaimer ao texto", () => {
    const out = comDisclaimer("Análise: cláusula 4 é abusiva.");
    expect(out).toContain("Análise: cláusula 4 é abusiva.");
    expect(out).toContain(DISCLAIMER);
  });
  it("é idempotente (não duplica se já presente)", () => {
    const once = comDisclaimer("x");
    const twice = comDisclaimer(once);
    expect(twice.split(DISCLAIMER).length - 1).toBe(1);
  });
});

describe("proibição de jurisprudência no prompt (spec §7.2)", () => {
  // Invariante: se a regra for removida da instrução, este teste fica vermelho.
  it("a instrução-base proíbe citar jurisprudência/julgados/precedentes", () => {
    const i = INSTRUCAO_BASE.toLowerCase();
    expect(i).toContain("jurisprudência");
    expect(i).toMatch(/não\s+(cite|invente|mencione)/);
    expect(i).toMatch(/julgado|precedente|número de processo/);
  });
});

describe("executarComRetry — retry + timeout (wrapper de IA, spec §2)", () => {
  it("repete até o limite e sucede", async () => {
    let n = 0;
    const fn = async () => {
      n++;
      if (n < 3) throw new Error("falha transitória");
      return "ok";
    };
    const r = await executarComRetry(fn, { retries: 2, timeoutMs: 1000 });
    expect(r).toBe("ok");
    expect(n).toBe(3);
  });

  it("falha após esgotar as tentativas (1 + retries)", async () => {
    let n = 0;
    const fn = async () => {
      n++;
      throw new Error("sempre falha");
    };
    await expect(executarComRetry(fn, { retries: 2, timeoutMs: 1000 })).rejects.toThrow();
    expect(n).toBe(3);
  });

  it("aborta por timeout via AbortSignal", async () => {
    const lento = (signal: AbortSignal) =>
      new Promise<string>((_, rej) => {
        signal.addEventListener("abort", () => rej(new Error("abortado")));
      });
    await expect(
      executarComRetry(lento, { retries: 0, timeoutMs: 20 }),
    ).rejects.toThrow();
  });
});
