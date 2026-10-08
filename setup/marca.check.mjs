// Testes da marca do aluno (Node puro: o vitest roda em workerd, sem fs/vm).
// Uso: pnpm test:marca   (também roda dentro de `pnpm ci`)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gravarMarca, carregarNucleo, RAIZ_PADRAO } from "./marca.mjs";

const Marca = carregarNucleo();

// raiz de teste isolada: nunca escreve no painel/ real
function raizTemp() {
  const r = mkdtempSync(join(tmpdir(), "marca-"));
  mkdirSync(join(r, "painel"), { recursive: true });
  copyFileSync(join(RAIZ_PADRAO, "painel", "marca.js"), join(r, "painel", "marca.js"));
  return r;
}
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test("normalizarHex: #RGB expande, minúscula sobe, lixo rejeita", () => {
  assert.equal(Marca.normalizarHex("#1e3"), "#11EE33");
  assert.equal(Marca.normalizarHex("1E3A8A"), "#1E3A8A");
  assert.equal(Marca.normalizarHex(" #abcdef "), "#ABCDEF");
  for (const ruim of ["azul", "#12", "#GGGGGG", "#1234567", "", null, undefined, 12345]) {
    assert.equal(Marca.normalizarHex(ruim), null, String(ruim));
  }
});

test("validar: nome obrigatório, cor inválida pede de novo, default de cor com aviso", () => {
  assert.equal(Marca.validar({ cor_primaria: "#112233" }).ok, false); // sem nome
  const ruim = Marca.validar({ nome: "X", cor_primaria: "azul" });
  assert.equal(ruim.ok, false);
  assert.match(ruim.erros.join(), /cor_primaria/);
  const padrao = Marca.validar({ nome: "X" });
  assert.equal(padrao.ok, true);
  assert.equal(padrao.marca.cor_primaria, "#D97706");
  assert.match(padrao.avisos.join(), /cor padrão ZX \(âmbar\)/);
  assert.equal(Marca.validar({ nome: "X", cor_primaria: "#123456" }).avisos.length, 0);
});

test("validar: logo só png/jpg/svg/webp local relativo ou https; nada de data:, http, traversal", () => {
  for (const ok of ["marca/logo.png", "https://exemplo.com/l.svg"]) assert.equal(Marca.validar({ nome: "X", logo: ok }).ok, true, ok);
  for (const ruim of ["http://x.com/l.png", "data:image/png;base64,AAAA", "../segredo.png", "marca/logo.exe", "javascript:alert(1)", "/etc/passwd.png"]) {
    assert.equal(Marca.validar({ nome: "X", logo: ruim }).ok, false, ruim);
  }
});

test("contraste: cor clara usa texto escuro no botão, cor escura usa texto branco", () => {
  assert.equal(Marca.corSobre("#FDE047"), "#0D0D0D");
  assert.equal(Marca.corSobre("#D97706"), "#0D0D0D"); // mantém o visual original do âmbar
  assert.equal(Marca.corSobre("#1E3A8A"), "#FFFFFF");
  assert.equal(Marca.corSobre("#000000"), "#FFFFFF");
});

test("cor como texto sobre o fundo escuro sempre alcança contraste 4.5", () => {
  for (const c of ["#1E3A8A", "#000000", "#111827", "#D97706", "#FFFFFF", "#3B0764"]) {
    assert.ok(Marca.contraste(Marca.corTexto(c), "#0D0D0D") >= 4.5, c);
  }
});

test("derivar: primária vira --brand/--primary; secundária explícita vira --brand-2; sem ela, versão mais escura", () => {
  const a = Marca.derivar("#1E3A8A", null);
  assert.equal(a["--brand"], "#1E3A8A");
  assert.equal(a["--primary"], "#1E3A8A");
  assert.equal(a["--brand-rgb"], "30, 58, 138");
  assert.ok(Marca.contraste(a["--brand-2"], "#FFFFFF") > Marca.contraste("#1E3A8A", "#FFFFFF") - 0.01); // mais escura
  assert.equal(Marca.derivar("#1E3A8A", "#0F172A")["--brand-2"], "#0F172A");
});

test("gravarMarca: grava config, copia logo, normaliza e não usa a marca ZX", () => {
  const raiz = raizTemp();
  const logo = join(raiz, "minha logo.png");
  writeFileSync(logo, PNG);
  const r = gravarMarca({ nome: "Silva & Associados", cor_primaria: "#1e3", cor_secundaria: "#0F172A", logo }, { raiz });
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.ok(existsSync(join(raiz, "painel", "marca", "logo.png")));
  const js = readFileSync(join(raiz, "painel", "marca.config.js"), "utf8");
  assert.match(js, /window\.ZX_MARCA = \{/);
  const cfg = JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
  assert.deepEqual(cfg, { nome: "Silva & Associados", cor_primaria: "#11EE33", cor_secundaria: "#0F172A", logo: "marca/logo.png" });
});

test("gravarMarca: campo inválido => ok=false e NADA é gravado", () => {
  const raiz = raizTemp();
  const r = gravarMarca({ nome: "X", cor_primaria: "verde" }, { raiz });
  assert.equal(r.ok, false);
  assert.equal(existsSync(join(raiz, "painel", "marca.config.js")), false);
  const r2 = gravarMarca({ nome: "X", logo: join(raiz, "nao-existe.png") }, { raiz });
  assert.equal(r2.ok, false);
  assert.match(r2.erros.join(), /não encontrado/);
  const r3 = gravarMarca({ nome: "X", logo: join(raiz, "painel", "marca.js") }, { raiz });
  assert.equal(r3.ok, false); // extensão .js não é imagem
});

test("gravarMarca: nome com '<' não fecha a tag <script>", () => {
  const raiz = raizTemp();
  const r = gravarMarca({ nome: "A</script><b>", cor_primaria: "#123456" }, { raiz });
  assert.equal(r.ok, true);
  assert.ok(!readFileSync(join(raiz, "painel", "marca.config.js"), "utf8").includes("</script>"));
});

test("gravarMarca: URL https de logo é aceita sem copiar arquivo", () => {
  const raiz = raizTemp();
  const r = gravarMarca({ nome: "X", cor_primaria: "#123456", logo: "https://exemplo.com/l.webp" }, { raiz });
  assert.equal(r.ok, true);
  assert.equal(r.marca.logo, "https://exemplo.com/l.webp");
  assert.equal(existsSync(join(raiz, "painel", "marca")), false);
});

test("o repo não carrega marca de aluno: marca.config.js e painel/marca/ estão no .gitignore", () => {
  const gi = readFileSync(join(RAIZ_PADRAO, ".gitignore"), "utf8");
  assert.match(gi, /^painel\/marca\.config\.js$/m);
  assert.match(gi, /^painel\/marca\/$/m);
});

test("style.css: nenhum âmbar fixo fora do fallback das custom properties; botão usa --on-brand", () => {
  const css = readFileSync(join(RAIZ_PADRAO, "painel", "style.css"), "utf8");
  assert.ok(css.length > 1000);
  const corpo = css.split("\n").filter((l) => !/^\s*--(brand|primary)[\w-]*\s*:/.test(l)).join("\n");
  assert.doesNotMatch(corpo, /#D97706/i);
  assert.doesNotMatch(corpo, /217,\s*119,\s*6/);
  assert.doesNotMatch(corpo, /245,\s*158,\s*11/);
  assert.doesNotMatch(corpo, /252,\s*211,\s*77/);
  assert.match(css, /\.btn-primary\s*\{[^}]*color:\s*var\(--on-brand\)/);
});

test("logo local: caminho absoluto com espaço/acento é aceito, copiado como marca/logo.<ext>; troca de extensão não deixa órfão", () => {
  const raiz = raizTemp();
  const dir = join(raiz, "Meus Downloads");
  mkdirSync(dir);
  const png = join(dir, "Logo Silva é.PNG");
  writeFileSync(png, PNG);
  let r = gravarMarca({ nome: "X", cor_primaria: "#123456", logo: png }, { raiz });
  assert.equal(r.ok, true, JSON.stringify(r.erros));
  assert.equal(r.marca.logo, "marca/logo.png");
  assert.ok(existsSync(join(raiz, "painel", "marca", "logo.png")));
  const svg = join(dir, "outra logo.svg");
  writeFileSync(svg, "<svg xmlns='http://www.w3.org/2000/svg'/>");
  r = gravarMarca({ nome: "X", cor_primaria: "#123456", logo: svg }, { raiz });
  assert.equal(r.marca.logo, "marca/logo.svg");
  assert.equal(existsSync(join(raiz, "painel", "marca", "logo.png")), false);
});

test("front continua estrito: só https ou marca/<nome>; caminho absoluto/espaço no config é rejeitado", () => {
  for (const ruim of ["/Users/aluno/Downloads/Logo Silva.png", "marca/logo silva.png", "marca/../x.png"]) {
    assert.equal(Marca.validar({ nome: "X", logo: ruim }).ok, false, ruim);
  }
});

test("hover do botão: texto tem contraste >= 4.5 sobre o fundo clareado, para cores variadas", () => {
  const lum = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const cor of ["#555555", "#1E3A8A", "#D97706", "#FFFFFF", "#000000", "#7C3AED", "#0F766E", "#FACC15", "#808080"]) {
    const v = Marca.derivar(cor, null);
    assert.ok(v["--on-brand-hover"], cor);
    assert.ok(cr(v["--on-brand-hover"].toUpperCase(), v["--primary-light"].toUpperCase()) >= 4.5, `hover ${cor}`);
  }
});

test("hover: style.css e docs usam --on-brand-hover", () => {
  const css = readFileSync(join(RAIZ_PADRAO, "painel", "style.css"), "utf8");
  assert.match(css, /\.btn-primary:hover\s*\{[^}]*color:\s*var\(--on-brand-hover\)/);
  for (const f of ["proposta.html", "apresentacao.html"]) {
    const h = readFileSync(join(RAIZ_PADRAO, "docs", f), "utf8");
    assert.match(h, /\.btn:hover\{[^}]*color:var\(--on-brand-hover\)/, f);
    assert.match(h, /--on-brand-hover:#0D0D0D/, f);
  }
});
