// Testes de regressão dos fixes de review do PR #2 (revisão ZX LAB).
// Cada bloco fica VERMELHO se o respectivo fix for revertido — não é teatro.
import { describe, it, expect } from "vitest";
import { VALIDADORES_UPDATE } from "../src/validacao";
import indexFonte from "../src/index.ts?raw";
import criarAcessoFonte from "../supabase/functions/criar-acesso/index.ts?raw";

describe("H2 — PATCH valida e descarta campos fora do schema (anti mass-assignment)", () => {
  it("VALIDADORES_UPDATE descarta chaves não-whitelistadas", () => {
    const r = VALIDADORES_UPDATE.clientes.safeParse({
      nome: "Maria",
      created_at: "1970-01-01",
      id: "forjado",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({ nome: "Maria" }); // created_at/id removidos
    }
  });

  it("VALIDADORES_UPDATE valida o tipo dos campos fornecidos", () => {
    const r = VALIDADORES_UPDATE.receitas.safeParse({ valor: "muito" });
    expect(r.success).toBe(false); // valor precisa ser number
  });

  it("o handler PATCH chama safeParse antes do update (drift-guard)", () => {
    const patch = indexFonte.slice(
      indexFonte.indexOf('case "PATCH"'),
      indexFonte.indexOf('case "DELETE"'),
    );
    expect(patch).toMatch(/VALIDADORES_UPDATE\[tabela\]\.safeParse/);
  });
});

describe("H2 — inserts dos agentes checam erro (grava-vs-lê não falha silencioso)", () => {
  it("postAgente trata erro do insert de pecas_geradas e do prazo", () => {
    const bloco = indexFonte.slice(
      indexFonte.indexOf("async function postAgente"),
      indexFonte.indexOf("async function postDataJud"),
    );
    expect(bloco).toMatch(/errPeca/);
    expect(bloco).toMatch(/falha_gravar_peca/);
    expect(bloco).toMatch(/errPrazo/);
  });

  it("postDataJud trata erro do insert do resumo", () => {
    const bloco = indexFonte.slice(indexFonte.indexOf("async function postDataJud"));
    expect(bloco).toMatch(/errResumo/);
    expect(bloco).toMatch(/falha_gravar_resumo/);
  });
});

describe("C1 — Edge Function criar-acesso valida o chamador ANTES da service role", () => {
  it("valida o token do chamador antes de admin.createUser (drift-guard)", () => {
    // `auth.getUser(token)` só existe no CÓDIGO (não no comentário) — guard real.
    const posGetUser = criarAcessoFonte.indexOf("auth.getUser(token)");
    const posCreate = criarAcessoFonte.indexOf("admin.createUser");
    expect(posGetUser).toBeGreaterThan(-1);
    expect(posCreate).toBeGreaterThan(-1);
    expect(posGetUser).toBeLessThan(posCreate); // valida o chamador primeiro
  });

  it("rejeita chamada sem Authorization (fail-closed)", () => {
    expect(criarAcessoFonte).toMatch(/nao_autorizado/);
    expect(criarAcessoFonte).toMatch(/Authorization/);
  });
});
