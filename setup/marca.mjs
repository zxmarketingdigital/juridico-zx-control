#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════
// Marca do aluno — grava a identidade visual que o painel, a proposta e a
// apresentação usam (SPEC marca-aluno). Chamado pelo Claude Code durante a
// instalação guiada (setup/CLAUDE.md, passo "Marca"), depois de PERGUNTAR ao
// aluno os 4 campos. Não é wizard: recebe tudo por flag.
//
//   node setup/marca.mjs --nome "Silva & Associados" --cor "#1E3A8A" \
//        [--secundaria "#0F172A"] [--logo ~/Downloads/logo.png | https://...]
//
// Saída: painel/marca.config.js (gitignored) + painel/marca/logo.<ext> (gitignored).
// Exit 0 = gravado · 1 = campo inválido (nada gravado; pergunte de novo) · 2 = erro de arquivo.
//
// UM VALOR, UM LUGAR: validação/derivação de cor vivem em painel/marca.js; este
// script carrega esse mesmo arquivo (sem duplicar regra).
// ════════════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync, rmSync, lstatSync, realpathSync, renameSync, readdirSync, constants as fsConstants } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import vm from "node:vm";

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ_PADRAO = resolve(AQUI, "..");
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const EXT_OK = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);

/** Carrega o núcleo de painel/marca.js (script clássico de browser) num sandbox. */
export function carregarNucleo(raiz = RAIZ_PADRAO) {
  const src = readFileSync(join(raiz, "painel", "marca.js"), "utf8");
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.runInNewContext(src, sandbox, { filename: "painel/marca.js" });
  return sandbox.ZXMarca;
}

/** Rejeita symlink em qualquer componente (de `raiz` até cada alvo) e exige realpath dentro da raiz real. */
function garantirDestinoSeguro(raiz, alvos) {
  const raizReal = realpathSync(raiz);
  for (const alvo of alvos) {
    const rel = resolve(alvo).slice(resolve(raiz).length);
    if (!resolve(alvo).startsWith(resolve(raiz) + "/")) throw new Error(`destino fora da raiz: ${alvo}`);
    let atual = resolve(raiz);
    for (const parte of rel.split("/").filter(Boolean)) {
      atual = join(atual, parte);
      let st;
      try { st = lstatSync(atual); } catch { break; } // ainda não existe: será criado dentro do pai já verificado
      if (st.isSymbolicLink()) throw new Error(`destino é link simbólico (recusado): ${atual}`);
    }
    if (existsSync(alvo)) {
      const real = realpathSync(alvo);
      if (real !== raizReal && !real.startsWith(raizReal + "/")) throw new Error(`destino escapa da raiz: ${alvo}`);
    }
  }
}

const expandirHome = (p) => (p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);

/**
 * Valida e grava. Devolve { ok, erros, avisos, marca, arquivo }.
 * `logo`: caminho local (copiado para painel/marca/) ou URL https.
 */
export function gravarMarca(entrada, { raiz = RAIZ_PADRAO } = {}) {
  const Marca = carregarNucleo(raiz);
  const erros = [];
  const avisos = [];
  const painel = join(raiz, "painel");
  const destinoDir = join(painel, "marca");

  entrada = { ...entrada, logo: typeof entrada.logo === "string" ? entrada.logo.trim() || undefined : entrada.logo };
  let logoParaValidar = entrada.logo;
  let copiar = null;
  if (entrada.logo && !/^https:\/\//i.test(String(entrada.logo))) {
    const origem = resolve(expandirHome(String(entrada.logo)));
    const ext = extname(origem).toLowerCase();
    if (!EXT_OK.has(ext)) {
      erros.push("logo: use imagem png, jpg, svg ou webp (ou uma URL https)");
    } else if (!existsSync(origem) || !statSync(origem).isFile()) {
      erros.push(`logo: arquivo não encontrado (${origem})`);
    } else if (statSync(origem).size > LOGO_MAX_BYTES) {
      erros.push("logo: arquivo maior que 2 MB — reduza a imagem");
    } else {
      // nome versionado: o config antigo continua apontando para o logo antigo até o rename final do config
      const rel = `marca/logo-${randomBytes(6).toString("hex")}${ext === ".jpeg" ? ".jpg" : ext}`;
      logoParaValidar = rel;
      copiar = { origem, destino: join(painel, rel) };
    }
  }

  const r = Marca.validar({ ...entrada, logo: erros.length ? null : logoParaValidar });
  erros.push(...r.erros);
  avisos.push(...r.avisos);
  if (erros.length) return { ok: false, erros, avisos, marca: r.marca };

  // Cor primária muito clara/escura demais para ler como texto: só informa (o loader já corrige).
  const marca = r.marca;
  const config = {
    nome: marca.nome,
    cor_primaria: marca.cor_primaria,
    cor_secundaria: marca.cor_secundaria,
    logo: marca.logo,
  };

  const arquivo = join(painel, "marca.config.js");
  // 1) Nada é removido nem gravado antes de provar que o destino está DENTRO da raiz real:
  //    painel/, painel/marca/, o logo e o config não podem ser symlink (nem a raiz real escapar).
  garantirDestinoSeguro(raiz, [painel, destinoDir, arquivo, ...(copiar ? [copiar.destino] : [])]);
  if (existsSync(arquivo) && !lstatSync(arquivo).isFile()) throw new Error("painel/marca.config.js existe e não é arquivo regular");
  mkdirSync(painel, { recursive: true });
  garantirDestinoSeguro(raiz, [painel]);

  // JSON em <script>: neutraliza "<" para não fechar a tag por engano.
  const json = JSON.stringify(config, null, 2).replace(/</g, "\\u003c");
  const sufixo = `.tmp-${randomBytes(6).toString("hex")}`; // nome imprevisível + abertura exclusiva (wx/COPYFILE_EXCL): não segue symlink pré-plantado
  const tmpConfig = arquivo + sufixo;
  const tmpLogo = copiar ? join(destinoDir, `.logo${sufixo}`) : null;
  // Premissa: o setup é interativo e roda uma vez, pelo próprio aluno, no computador dele, conduzido
  // pelo Claude Code — não há escritor concorrente, então não há lock (seria escopo a mais).
  try {
    // 2) Prepara tudo em arquivos temporários; o estado antigo continua intacto até aqui.
    if (copiar) {
      mkdirSync(destinoDir, { recursive: true });
      garantirDestinoSeguro(raiz, [destinoDir]);
      // Destino SEMPRE dentro de painel/marca/ com nome fixo saneado (logo.<ext>): o nome/caminho
      // original do aluno (absoluto, com espaço, acentos) nunca chega ao front nem ao destino.
      if (!resolve(copiar.destino).startsWith(resolve(destinoDir) + "/")) throw new Error("destino da logo fora de painel/marca/");
      copyFileSync(copiar.origem, tmpLogo, fsConstants.COPYFILE_EXCL);
      garantirDestinoSeguro(raiz, [tmpLogo]);
      if (statSync(tmpLogo).size > LOGO_MAX_BYTES || statSync(tmpLogo).size !== statSync(copiar.origem).size) throw new Error("cópia da logo incompleta");
    }
    writeFileSync(
      tmpConfig,
      `// Gerado por \`node setup/marca.mjs\` — marca do escritório (gitignored). Rode de novo para trocar.\nwindow.ZX_MARCA = ${json};\n`,
      { flag: "wx" }, // exclusivo: falha se o temporário já existir (inclusive como symlink)
    );
    garantirDestinoSeguro(raiz, [tmpConfig]);
    // 3) Troca atômica: logo novo, depois config novo; só então some o que ficou órfão.
    if (copiar) renameSync(tmpLogo, copiar.destino);
    renameSync(tmpConfig, arquivo);
    if (copiar) {
      const novoNome = copiar.destino.split("/").pop();
      for (const f of readdirSync(destinoDir)) {
        if (f !== novoNome) rmSync(join(destinoDir, f), { recursive: true, force: true });
      }
    } else if (existsSync(destinoDir)) {
      rmSync(destinoDir, { recursive: true, force: true }); // sem logo local: não deixa logo antigo órfão
    }
  } finally {
    rmSync(tmpConfig, { force: true });
    if (tmpLogo) rmSync(tmpLogo, { force: true });
  }
  return { ok: true, erros: [], avisos, marca: config, arquivo };
}

function lerArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const map = { "--nome": "nome", "--cor": "cor_primaria", "--secundaria": "cor_secundaria", "--logo": "logo", "--raiz": "raiz" };
    if (map[k]) out[map[k]] = argv[++i];
    else { console.error(`Opção desconhecida: ${k}`); process.exit(2); }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { raiz, ...entrada } = lerArgs(process.argv.slice(2));
  let r;
  try {
    r = gravarMarca(entrada, { raiz: raiz ? resolve(raiz) : RAIZ_PADRAO });
  } catch (e) {
    console.error(`Erro ao gravar a marca: ${e.message}`);
    process.exit(2);
  }
  for (const a of r.avisos) console.log(`  ⚠️  ${a}`);
  if (!r.ok) {
    console.error("\n  Marca NÃO gravada. Corrija e pergunte de novo ao aluno:");
    for (const e of r.erros) console.error(`   ❌ ${e}`);
    process.exit(1);
  }
  console.log(`\n  ✅ Marca gravada em painel/marca.config.js`);
  console.log(`     nome: ${r.marca.nome}`);
  console.log(`     cor principal: ${r.marca.cor_primaria}${r.marca.cor_secundaria ? `  ·  secundária: ${r.marca.cor_secundaria}` : ""}`);
  console.log(`     logo: ${r.marca.logo ?? "(sem logo — o painel mostra só o nome)"}\n`);
}
