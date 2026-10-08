import { describe, it, expect } from "vitest";
import indexHtml from "../painel/index.html?raw";
import marcaJs from "../painel/marca.js?raw";
import proposta from "../docs/proposta.html?raw";
import apresentacao from "../docs/apresentacao.html?raw";
import instalador from "../setup/CLAUDE.md?raw";

// Marca do aluno (SPEC marca-aluno). O comportamento (cor/validação/gravação) é
// testado em Node: `pnpm test:marca` (setup/marca.check.mjs). Aqui travamos, no
// pool workerd, que as superfícies do cliente leem a marca e não voltam a ter
// âmbar fixo / marca ZX LAB hardcoded. (style.css é checado em Node: o vite do
// pool workerd devolve CSS `?raw` vazio.)
describe("painel aplica a marca do aluno em runtime", () => {
  it("index.html carrega marca.config.js ANTES de marca.js e marca nome/logo/título", () => {
    expect(indexHtml.indexOf("marca.config.js")).toBeGreaterThan(-1);
    expect(indexHtml.indexOf("marca.config.js")).toBeLessThan(indexHtml.indexOf("marca.js"));
    expect(indexHtml).toContain("data-marca=\"nome\"");
    expect(indexHtml).toContain("data-marca-logo");
    expect(indexHtml).toContain("data-marca-title");
  });

  it("proposta e apresentação leem a marca e usam as vars (sem rgba âmbar fixo)", () => {
    for (const html of [proposta, apresentacao]) {
      expect(html).toContain("../painel/marca.config.js");
      expect(html).toContain("../painel/marca.js");
      expect(html).not.toMatch(/rgba\(217,\s*119,\s*6/);
    }
    expect(proposta).toContain("data-marca-logo");
    expect(proposta).toContain("data-marca=\"nome\"");
  });

  it("proposta (tela do cliente final) não carrega marca ZX", () => {
    expect(proposta).not.toMatch(/zx lab|zx control/i);
  });

  it("marca.js: logo aceita só https ou caminho de imagem local; nome vai por textContent (sem innerHTML)", () => {
    expect(marcaJs).toContain("https:");
    expect(marcaJs).not.toMatch(/innerHTML/);
    expect(marcaJs).toMatch(/textContent\s*=\s*m\.nome/);
  });

  it("setup/CLAUDE.md pergunta os 4 campos, chama o gravador e fala neutro de plataforma", () => {
    for (const t of ["setup/marca.mjs", "Nome do escritório", "Cor principal", "Cor secundária", "Logo"]) {
      expect(instalador).toContain(t);
    }
    expect(instalador).toMatch(/cor padrão ZX/i);
    expect(instalador).not.toMatch(/\bmac\b/i);
  });
});
