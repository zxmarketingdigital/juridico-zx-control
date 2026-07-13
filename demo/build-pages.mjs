// ════════════════════════════════════════════════════════════════════════
// Monta demo/dist/ pra DEMO HOSPEDADA no Cloudflare Pages (advanced mode).
//   node demo/build-pages.mjs
//   wrangler pages deploy demo/dist --project-name=juridico-zx-control-demo
// Gera um _worker.js ÚNICO e autocontido: data.mjs (sem `export`) + o handler
// de demo/pages-worker.mjs (marcador /* __DATA__ */). Sem bundler, sem deps.
// config.js sai com DEMO:true — qualquer credencial entra (inclusive o login
// de teste divulgado aos alunos: advogado@teste.com / Teste@12345).
// ════════════════════════════════════════════════════════════════════════

import { mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const DIST = join(__dirname, "dist");

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// Painel estático
for (const f of ["index.html", "style.css", "app.js"]) {
  await copyFile(join(RAIZ, "painel", f), join(DIST, f));
}

// Config de DEMO (mesmo token do worker)
await writeFile(join(DIST, "config.js"), `window.ZX = { DEMO: true, DEMO_TOKEN: "demo-juridico-2026" };\n`);

// _worker.js autocontido: dados inline + handler
const data = (await readFile(join(__dirname, "data.mjs"), "utf8")).replace(/^export /gm, "");
const api = await readFile(join(__dirname, "pages-worker.mjs"), "utf8");
if (!api.includes("/* __DATA__ */")) throw new Error("marcador /* __DATA__ */ não encontrado em pages-worker.mjs");
await writeFile(join(DIST, "_worker.js"), api.replace("/* __DATA__ */", data));

console.log(`✅ demo/dist/ pronto — deploy: wrangler pages deploy demo/dist --project-name=juridico-zx-control-demo`);
