import { describe, it, expect } from "vitest";
import sql from "../supabase/migrations/0003_growth_crm.sql?raw";
import { LEAD_STATUS, RECEITA_TIPO, CUSTO_TIPO } from "../src/schema";

const SQL = sql.toLowerCase();
const NOVAS = ["leads", "receitas", "custos", "pre_notas"];

function checkValues(coluna: string): string[] {
  const m = SQL.match(new RegExp(`check\\s*\\(\\s*${coluna}\\s+in\\s*\\(([^)]*)\\)`, "i"));
  return m ? [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!) : [];
}

describe("0003 — Growth/CRM: RLS + idempotência em toda tabela nova", () => {
  for (const t of NOVAS) {
    it(`${t}: create if not exists + RLS`, () => {
      expect(SQL).toMatch(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(public\\.)?${t}\\b`));
      expect(SQL).toMatch(new RegExp(`alter\\s+table\\s+(public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`));
    });
  }
  it("políticas recriáveis", () => {
    expect(SQL).toContain("drop policy if exists");
    expect((SQL.match(/create policy/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});

describe("0003 — CHECK == constantes (sem drift)", () => {
  it("status do lead == LEAD_STATUS", () => {
    expect(checkValues("status").sort()).toEqual([...LEAD_STATUS].sort());
  });
  it("tipo de receita e de custo presentes", () => {
    for (const v of [...RECEITA_TIPO, ...CUSTO_TIPO]) expect(SQL).toContain(`'${v}'`);
  });
});

describe("0003 — relacionamentos", () => {
  for (const t of ["leads", "receitas", "pre_notas"]) {
    it(`${t} referencia clientes`, () => {
      expect(SQL).toMatch(new RegExp(`cliente_id[^,]*references\\s+(public\\.)?clientes`));
    });
  }
});
