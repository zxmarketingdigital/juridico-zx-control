import { describe, it, expect } from "vitest";
import sql from "../supabase/migrations/0002_equipe_datajud.sql?raw";

const SQL = sql.toLowerCase();
const NOVAS = ["advogados", "advogado_clientes", "movimentacoes"];

describe("0002 — Equipe + DataJud: RLS em toda tabela nova (smoke-db)", () => {
  for (const t of NOVAS) {
    it(`${t} é criada com if not exists e tem RLS`, () => {
      expect(SQL).toMatch(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+(public\\.)?${t}\\b`));
      expect(SQL).toMatch(new RegExp(`alter\\s+table\\s+(public\\.)?${t}\\s+enable\\s+row\\s+level\\s+security`));
    });
  }
});

describe("0002 — idempotência e políticas recriáveis", () => {
  it("políticas usam drop policy if exists + create policy", () => {
    expect(SQL).toContain("drop policy if exists");
    expect((SQL.match(/create policy/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("0002 — relacionamentos (equipe N:N e movimentações)", () => {
  it("advogado_clientes referencia advogados e clientes", () => {
    expect(SQL).toMatch(/advogado_id[^,]*references\s+(public\.)?advogados/);
    expect(SQL).toMatch(/cliente_id[^,]*references\s+(public\.)?clientes/);
  });
  it("movimentacoes referencia casos", () => {
    expect(SQL).toMatch(/caso_id[^,]*references\s+(public\.)?casos/);
  });
  it("advogado_clientes é N:N (chave primária composta)", () => {
    expect(SQL).toMatch(/primary\s+key\s*\(\s*advogado_id\s*,\s*cliente_id\s*\)/);
  });
});
