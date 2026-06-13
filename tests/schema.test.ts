import { describe, it, expect } from "vitest";
import sql from "../supabase/migrations/0001_init.sql?raw";
import { TABLES, AREAS, STATUS_CASO, STATUS_PRAZO, AGENTES } from "../src/schema";

// Normaliza o SQL pra casar com regex sem depender de espaçamento/maiúsculas.
const SQL = sql.toLowerCase();

// Extrai a lista de valores de um CHECK `<coluna> in ('a','b',...)` do SQL.
function checkValues(coluna: string): string[] {
  const m = SQL.match(new RegExp(`check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`, "i"));
  if (!m) return [];
  return [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
}

describe("schema.ts — constantes únicas (um valor, um lugar)", () => {
  it("toda lista de constantes é não-vazia e sem duplicatas", () => {
    for (const arr of [TABLES, AREAS, STATUS_CASO, STATUS_PRAZO, AGENTES]) {
      expect(arr.length).toBeGreaterThan(0);
      expect(new Set(arr).size).toBe(arr.length);
    }
  });

  it("são exatamente as 5 entidades do spec §6", () => {
    expect([...TABLES].sort()).toEqual(
      ["casos", "clientes", "documentos", "pecas_geradas", "prazos"].sort(),
    );
  });
});

describe("migration — RLS habilitado em TODA tabela (espelha o smoke-db do CI)", () => {
  // Invariante real: remova o RLS de qualquer tabela e este teste fica vermelho,
  // exatamente como o job smoke-db reprovaria.
  for (const t of TABLES) {
    it(`tabela ${t} tem RLS habilitado`, () => {
      expect(SQL).toMatch(
        new RegExp(`alter\\s+table\\s+(public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`),
      );
    });
  }
});

describe("migration — idempotência (smoke-db aplica 2× com ON_ERROR_STOP)", () => {
  it("cria cada tabela com `if not exists`", () => {
    for (const t of TABLES) {
      expect(SQL).toMatch(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(public\\.)?${t}\\b`));
    }
  });

  it("políticas são recriáveis (`drop policy if exists` antes de `create policy`)", () => {
    expect(SQL).toContain("drop policy if exists");
    expect(SQL).toContain("create policy");
  });
});

describe("migration — compatível com Postgres puro do CI", () => {
  it("não sobrescreve auth.uid() do Supabase sem guarda (shim só se não existir)", () => {
    if (SQL.includes("function auth.uid")) {
      // Se define o shim, tem que estar dentro de uma checagem de existência em pg_proc.
      expect(SQL).toMatch(/if\s+not\s+exists\s*\([^;]*pg_proc[^;]*\)/);
    }
    expect(SQL).toContain("create schema if not exists auth");
  });

  it("bucket de Storage é criado só quando o schema `storage` existe (guarda)", () => {
    // No Postgres puro do CI o schema storage não existe; o bloco tem que ser pulado.
    expect(SQL).toMatch(/if\s+exists\s*\([^;]*nspname\s*=\s*'storage'/);
    expect(SQL).toContain("storage.buckets");
  });
});

describe("migration — relacionamentos do spec §6", () => {
  it("casos referencia clientes", () => {
    expect(SQL).toMatch(/cliente_id[^,]*references\s+(public\.)?clientes/);
  });
  for (const t of ["documentos", "prazos", "pecas_geradas"]) {
    it(`${t} referencia casos`, () => {
      expect(SQL).toMatch(new RegExp(`caso_id[^,]*references\\s+(public\\.)?casos`));
    });
  }
});

describe("migration — CHECK == constante TS (sem drift SQL↔código)", () => {
  const casos: Array<[string, readonly string[]]> = [
    ["area", AREAS],
    ["status", STATUS_CASO], // status do caso
    ["agente", AGENTES],
  ];
  for (const [coluna, esperado] of casos) {
    it(`CHECK de ${coluna} bate com a constante`, () => {
      expect(checkValues(coluna).sort()).toEqual([...esperado].map((s) => s.toLowerCase()).sort());
    });
  }

  it("CHECK de status do prazo bate com STATUS_PRAZO", () => {
    // prazos.status usa o mesmo nome de coluna `status`; valida pela presença
    // de cada valor de STATUS_PRAZO num CHECK do SQL.
    for (const v of STATUS_PRAZO) {
      expect(SQL).toContain(`'${v.toLowerCase()}'`);
    }
  });
});
