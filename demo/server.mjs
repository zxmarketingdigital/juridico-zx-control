// ════════════════════════════════════════════════════════════════════════
// Mock server da DEMO local (sem banco, sem credencial). Espelha o contrato
// do Worker real: /api/* com Bearer fail-closed, CRUD das 5 entidades,
// /api/agenda e /api/agentes/:id (outputs mock com disclaimer). Serve painel/
// e injeta config.js com DEMO:true. `node demo/server.mjs` sobe tudo populado.
// ════════════════════════════════════════════════════════════════════════

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as DB from "./data.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAINEL = join(__dirname, "..", "painel");
const PORT = Number(process.env.PORT ?? 8910);
const TOKEN = "demo-juridico-2026"; // mesmo valor injetado em config.js

const DISCLAIMER = "Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória.";

// Estado mutável em memória (POST/DELETE persistem enquanto o server vive).
const state = {
  clientes: DB.clientes.map((x) => ({ ...x })),
  casos: DB.casos.map((x) => ({ ...x })),
  documentos: DB.documentos.map((x) => ({ ...x })),
  prazos: DB.prazos.map((x) => ({ ...x })),
  pecas_geradas: DB.pecas_geradas.map((x) => ({ ...x })),
};
const seq = Object.fromEntries(Object.keys(state).map((k) => [k, state[k].length]));
const prefix = { clientes: "cli", casos: "cas", documentos: "doc", prazos: "prz", pecas_geradas: "pec" };
const defaults = {
  casos: { status: "novo" },
  prazos: { status: "pendente" },
};

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".ico": "image/x-icon" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };

function json(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}

// ── Util de datas (dias úteis, sem feriados — suficiente pra demo) ─────────
const iso = (d) => d.toISOString().slice(0, 10);
function addDiasUteis(inicioISO, n) {
  const d = new Date(inicioISO + "T00:00:00Z");
  let add = 0;
  d.setUTCDate(d.getUTCDate() + 1);
  while (add < n) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) add++;
    if (add < n) d.setUTCDate(d.getUTCDate() + 1);
  }
  return iso(d);
}
function classe(p) {
  if (p.status === "cumprido") return "cumprido";
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const fatal = new Date(p.data_fatal + "T00:00:00");
  const faltam = Math.round((fatal - hoje) / 86400000);
  if (faltam < 0) return "vencido";
  if (faltam <= 5) return "vencendo";
  return "ok";
}

// config.js injetado (DEMO) — o painel usa o token de demo, sem credencial.
const CONFIG_JS = `window.ZX = { DEMO: true, DEMO_TOKEN: ${JSON.stringify(TOKEN)} };`;

async function serveStatic(req, res) {
  const p = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  if (p === "/config.js") {
    res.writeHead(200, { "Content-Type": MIME[".js"] });
    return res.end(CONFIG_JS);
  }
  try {
    const buf = await readFile(join(PAINEL, p));
    res.writeHead(200, { "Content-Type": MIME[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function mockAgente(id, corpo) {
  const out = {
    analisador_contratos: "### Riscos\n- Cláusula de multa desproporcional 🔴\n- Falta cláusula de rescisão 🟡\n\n### Sugestões de redação\n- Limitar multa a 10% do valor do contrato.",
    gerador_pecas: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)...\n\n**DOS FATOS**\n(...)\n\n**DO DIREITO**\nEm tese, aplica-se a legislação pertinente (sem citar julgados).\n\n**DOS PEDIDOS**\n(...)",
    resumidor_processos: "**Resumo executivo:** ação em fase de instrução.\n**Linha do tempo:** distribuição → contestação → réplica.\n**Situação atual:** aguardando audiência.\n**Próximos passos:** arrolar testemunhas.",
    extrator_prazos: "**Tipo:** Contestação\n**Contagem:** 15 dias úteis\n**Termo inicial:** primeiro dia útil seguinte à publicação.",
    triagem_cliente: "**Ficha:** partes e fatos do relato.\n**Área:** Cível.\n**Documentos:** contrato, comprovantes, RG/CPF.\n**Viabilidade:** Médio.",
  }[id] || "Resultado gerado.";
  return `${out}\n\n---\n${DISCLAIMER}`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith("/api")) return serveStatic(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // Bearer fail-closed — token ausente/vazio/errado → 401 (igual ao Worker real).
  if ((req.headers.authorization ?? "") !== `Bearer ${TOKEN}`) {
    return json(res, { error: "nao_autorizado" }, 401);
  }

  const path = url.pathname.replace(/^\/api/, "");
  const m = req.method;
  const parts = path.replace(/^\/+|\/+$/g, "").split("/");

  // Agenda
  if (m === "GET" && parts[0] === "agenda") {
    const itens = [...state.prazos]
      .sort((a, b) => a.data_fatal.localeCompare(b.data_fatal))
      .map((p) => ({ ...p, classe: classe(p) }));
    return json(res, itens);
  }

  // Agentes
  if (m === "POST" && parts[0] === "agentes") {
    const id = parts[1];
    const corpo = await readBody(req);
    const conteudo = mockAgente(id, corpo);
    const pec = { id: prefix.pecas_geradas + ++seq.pecas_geradas, caso_id: corpo.caso_id ?? null, agente: id, tipo: corpo?.entrada?.tipo ?? null, conteudo, created_at: new Date().toISOString() };
    state.pecas_geradas.unshift(pec);
    let prazo = null;
    if (id === "extrator_prazos" && corpo.prazo?.dataPublicacao && corpo.prazo?.diasUteis) {
      prazo = { id: prefix.prazos + ++seq.prazos, caso_id: corpo.caso_id ?? null, tipo: corpo.prazo.tipo || "prazo", data_publicacao: corpo.prazo.dataPublicacao, data_fatal: addDiasUteis(corpo.prazo.dataPublicacao, Number(corpo.prazo.diasUteis)), dias: Number(corpo.prazo.diasUteis), status: "pendente", created_at: new Date().toISOString() };
      state.prazos.push(prazo);
    }
    return json(res, { conteudo, prazo }, 201);
  }

  // CRUD genérico das 5 entidades
  const col = parts[0];
  if (col in state) {
    const id = parts[1];
    if (m === "GET" && !id) {
      return json(res, [...state[col]].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    }
    if (m === "POST" && !id) {
      const d = await readBody(req);
      const novo = { ...(defaults[col] || {}), ...d, id: prefix[col] + ++seq[col], created_at: new Date().toISOString() };
      state[col].unshift(novo);
      return json(res, novo, 201);
    }
    if (m === "PATCH" && id) {
      const d = await readBody(req);
      const row = state[col].find((x) => x.id === id);
      if (row) Object.assign(row, d);
      return json(res, row || {}, row ? 200 : 404);
    }
    if (m === "DELETE" && id) {
      state[col] = state[col].filter((x) => x.id !== id);
      return json(res, { ok: true });
    }
  }

  return json(res, { error: "not_found" }, 404);
});

server.listen(PORT, () => {
  console.log(`\n  ⚖️  DEMO Jurídico ZX Control — painel populado, zero credencial`);
  console.log(`  Painel:  http://localhost:${PORT}/`);
  console.log(`  API:     http://localhost:${PORT}/api/*  (Bearer ${TOKEN})`);
  console.log(`  ${Object.entries(state).map(([k, v]) => `${v.length} ${k}`).join(" · ")}\n`);
});
