import { describe, it, expect } from "vitest";
import app from "../painel/app.js?raw";
import { AREAS, STATUS_CASO, STATUS_PRAZO, AGENTES, LEAD_STATUS, RECEITA_TIPO, CUSTO_TIPO } from "../src/schema";

// "Um valor, um lugar": o painel (browser, sem import de TS) replica as listas
// de domínio. Este teste trava o drift — mude um enum em src/schema.ts sem
// atualizar painel/app.js e ele fica vermelho.
describe("domínio do painel espelha src/schema.ts", () => {
  const casos: Array<[string, readonly string[]]> = [
    ["AREAS", AREAS],
    ["STATUS_CASO", STATUS_CASO],
    ["STATUS_PRAZO", STATUS_PRAZO],
    ["AGENTES", AGENTES],
    ["LEAD_STATUS", LEAD_STATUS],
    ["RECEITA_TIPO", RECEITA_TIPO],
    ["CUSTO_TIPO", CUSTO_TIPO],
  ];
  for (const [nome, valores] of casos) {
    it(`${nome}: todo valor aparece em painel/app.js`, () => {
      for (const v of valores) {
        expect(app, `valor ausente no painel: ${v}`).toContain(`"${v}"`);
      }
    });
  }
});
