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
  advogados: DB.advogados.map((x) => ({ ...x })),
  leads: DB.leads.map((x) => ({ ...x })),
  receitas: DB.receitas.map((x) => ({ ...x })),
  custos: DB.custos.map((x) => ({ ...x })),
  pre_notas: DB.pre_notas.map((x) => ({ ...x })),
};
let vinculos = DB.advogado_clientes.map((x) => ({ ...x })); // advogado ⇄ cliente
const seq = Object.fromEntries(Object.keys(state).map((k) => [k, state[k].length]));
const prefix = { clientes: "cli", casos: "cas", documentos: "doc", prazos: "prz", pecas_geradas: "pec", advogados: "adv", leads: "led", receitas: "rec", custos: "cst", pre_notas: "pn" };
const defaults = {
  casos: { status: "novo" },
  prazos: { status: "pendente" },
  leads: { status: "recebeu_formulario" },
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
  // Roteirista: reflete o tema/formato/CTA escolhidos (no produto a IA gera o roteiro real).
  if (id === "roteirista_social") {
    const e = corpo?.entrada || {};
    const tema = e.tema || "(defina o tema)";
    const formato = e.formato || "reel";
    const cta = e.cta || "link na bio";
    return [
      `**Roteiro de ${formato} — tema: ${tema}**`,
      "",
      `**HOOK:** Você sabe a verdade sobre ${tema}?`,
      `**DESENVOLVIMENTO:** No produto real, a IA detalha "${tema}" em pontos claros e úteis.`,
      `**AMPLIFICAÇÃO:** Por que ${tema} importa pra quem te acompanha.`,
      `**CTA:** ${cta}.`,
      "",
      "---",
      DISCLAIMER,
      "",
      "_(demo: texto ilustrativo que reflete suas escolhas — o roteiro completo é gerado pela IA no produto)_",
    ].join("\n");
  }
  const out = {
    analisador_contratos: "### Riscos\n- Cláusula de multa desproporcional 🔴\n- Falta cláusula de rescisão 🟡\n\n### Sugestões de redação\n- Limitar multa a 10% do valor do contrato.",
    gerador_pecas: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)...\n\n**DOS FATOS**\n(...)\n\n**DO DIREITO**\nEm tese, aplica-se a legislação pertinente (sem citar julgados).\n\n**DOS PEDIDOS**\n(...)",
    resumidor_processos: "**Resumo executivo:** ação em fase de instrução.\n**Linha do tempo:** distribuição → contestação → réplica.\n**Situação atual:** aguardando audiência.\n**Próximos passos:** arrolar testemunhas.",
    extrator_prazos: "**Tipo:** Contestação\n**Contagem:** 15 dias úteis\n**Termo inicial:** primeiro dia útil seguinte à publicação.",
    triagem_cliente: "**Ficha:** partes e fatos do relato.\n**Área:** Cível.\n**Documentos:** contrato, comprovantes, RG/CPF.\n**Viabilidade:** Médio.",
    roteirista_social: "**HOOK:** Você assina contrato sem ler? Isso pode custar caro.\n\n**DESENVOLVIMENTO:** 3 cláusulas que todo mundo ignora e depois se arrepende...\n\n**AMPLIFICAÇÃO:** 8 em cada 10 conflitos começam por uma cláusula mal redigida.\n\n**CTA:** Comente a palavra CONTRATO que eu te explico.",
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
    const pec = { id: prefix.pecas_geradas + ++seq.pecas_geradas, caso_id: corpo.caso_id ?? null, agente: id, tipo: corpo?.entrada?.tipo ?? corpo?.entrada?.formato ?? null, conteudo, metadata: corpo.vinculo ? { vinculo: corpo.vinculo } : {}, created_at: new Date().toISOString() };
    state.pecas_geradas.unshift(pec);
    let prazo = null;
    if (id === "extrator_prazos" && corpo.prazo?.dataPublicacao && corpo.prazo?.diasUteis) {
      prazo = { id: prefix.prazos + ++seq.prazos, caso_id: corpo.caso_id ?? null, tipo: corpo.prazo.tipo || "prazo", data_publicacao: corpo.prazo.dataPublicacao, data_fatal: addDiasUteis(corpo.prazo.dataPublicacao, Number(corpo.prazo.diasUteis)), dias: Number(corpo.prazo.diasUteis), status: "pendente", created_at: new Date().toISOString() };
      state.prazos.push(prazo);
    }
    return json(res, { conteudo, prazo }, 201);
  }

  // Vínculo advogado ⇄ cliente: /clientes/:id/advogados[/:advId]
  if (parts[0] === "clientes" && parts[2] === "advogados") {
    const clienteId = parts[1];
    if (m === "GET") {
      const ids = vinculos.filter((v) => v.cliente_id === clienteId).map((v) => v.advogado_id);
      return json(res, state.advogados.filter((a) => ids.includes(a.id)));
    }
    if (m === "POST") {
      const { advogado_id } = await readBody(req);
      if (advogado_id && !vinculos.some((v) => v.cliente_id === clienteId && v.advogado_id === advogado_id)) {
        vinculos.push({ cliente_id: clienteId, advogado_id });
      }
      return json(res, { ok: true }, 201);
    }
    if (m === "DELETE") {
      const advId = parts[3];
      vinculos = vinculos.filter((v) => !(v.cliente_id === clienteId && v.advogado_id === advId));
      return json(res, { ok: true });
    }
  }

  // DataJud (mock — não chama o CNJ na demo)
  if (m === "POST" && parts[0] === "datajud") {
    const { numero, caso_id, salvar, resumir } = await readBody(req);
    if (!numero) return json(res, { error: "numero_obrigatorio" }, 422);
    const movimentos = [
      { data: iso(new Date()), codigo: 85, descricao: "Decisão — defiro a juntada de documentos" },
      { data: iso(new Date(Date.now() - 6 * 864e5)), codigo: 51, descricao: "Audiência de conciliação designada" },
      { data: iso(new Date(Date.now() - 30 * 864e5)), codigo: 26, descricao: "Distribuição por sorteio" },
    ];
    const processo = {
      existe: true,
      numero: String(numero).replace(/\D/g, ""),
      capa: { classe: "Procedimento Comum Cível", assuntos: ["Indenização por Dano Material"], orgaoJulgador: "2ª Vara Cível Central", tribunal: "TJSP", grau: "G1", dataAjuizamento: "20250101000000" },
      movimentos,
    };
    const salvos = salvar && caso_id ? movimentos.length : 0;
    const resumo = resumir ? mockAgente("resumidor_processos", {}) : null;
    return json(res, { ...processo, salvos, resumo }, 200);
  }

  // Growth — métricas (MRR, custos, CAC)
  if (m === "GET" && parts[0] === "growth") {
    const soma = (arr, t) => Math.round(arr.filter((x) => x.tipo === t).reduce((s, x) => s + Number(x.valor || 0), 0) * 100) / 100;
    const mrr = soma(state.receitas, "recorrente");
    const custoFixoMensal = soma(state.custos, "fixo_mensal");
    const investimentoAnuncios = soma(state.custos, "anuncios");
    const custoUnico = soma(state.custos, "unico");
    const convertidos = state.leads.filter((l) => l.status === "convertido").length;
    const cac = convertidos > 0 ? Math.round((investimentoAnuncios / convertidos) * 100) / 100 : null;
    return json(res, { mrr, custoFixoMensal, custoUnico, investimentoAnuncios, custoMensalTotal: custoFixoMensal + investimentoAnuncios, cac, clientesConvertidos: convertidos });
  }

  // CRM — converter lead em cliente
  if (m === "POST" && parts[0] === "leads" && parts[2] === "converter") {
    const lead = state.leads.find((l) => l.id === parts[1]);
    if (!lead) return json(res, { error: "lead_nao_encontrado" }, 404);
    const cliente = { id: prefix.clientes + ++seq.clientes, nome: lead.nome, contato: lead.contato ?? null, created_at: new Date().toISOString() };
    state.clientes.unshift(cliente);
    lead.status = "convertido";
    lead.cliente_id = cliente.id;
    return json(res, { cliente, lead_id: lead.id }, 201);
  }

  // Growth — gerar pré-nota
  if (m === "POST" && parts[0] === "pre_notas" && parts[1] === "gerar") {
    const b = await readBody(req);
    if (!b.descricao_servico || typeof b.valor !== "number") return json(res, { error: "entrada_invalida" }, 422);
    const cli = b.cliente_id ? state.clientes.find((c) => c.id === b.cliente_id) : null;
    const numero = b.numero || `PN-${iso(new Date())}`;
    const brl = `R$ ${Number(b.valor).toFixed(2).split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${Number(b.valor).toFixed(2).split(".")[1]}`;
    const conteudo = `# PRÉ-NOTA ${numero}\n\n**Cliente:** ${cli?.nome || "Cliente"}\n**Serviço:** ${b.descricao_servico}\n**Valor:** ${brl}${b.vencimento ? `\n**Vencimento:** ${b.vencimento}` : ""}\n\n---\n_Documento auxiliar de cobrança — **não é nota fiscal**._`;
    const pn = { id: prefix.pre_notas + ++seq.pre_notas, cliente_id: b.cliente_id ?? null, numero, descricao_servico: b.descricao_servico, valor: b.valor, vencimento: b.vencimento ?? null, conteudo, created_at: new Date().toISOString() };
    state.pre_notas.unshift(pn);
    return json(res, { ...pn, conteudo }, 201);
  }

  // Criar acesso (login) de membro da equipe — mock
  if (m === "POST" && parts[0] === "advogados" && parts[2] === "acesso") {
    const adv = state.advogados.find((a) => a.id === parts[1]);
    if (!adv?.email) return json(res, { error: "advogado_sem_email" }, 422);
    return json(res, { email: adv.email, senha_temporaria: "Adv-demo" + (++seq.advogados) }, 201);
  }

  // CRUD genérico das entidades
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
