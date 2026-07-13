// ════════════════════════════════════════════════════════════════════════
// _worker.js da DEMO HOSPEDADA (Cloudflare Pages, advanced mode).
// Mesmo contrato do demo/server.mjs: /api/* com Bearer fail-closed, CRUD,
// agenda, agentes mock com disclaimer — estático (painel/) vai via ASSETS.
// NÃO editar demo/dist/_worker.js à mão: ele é gerado por demo/build-pages.mjs
// (concatena data.mjs sem os `export` + este arquivo). Estado vive em memória
// por isolate — POSTs persistem enquanto o isolate viver, igual à demo local.
// ════════════════════════════════════════════════════════════════════════

/* __DATA__ */

const TOKEN = "demo-juridico-2026"; // mesmo valor do config.js estático
// `DISCLAIMER`, `iso`, `ahead`, `ago` já vêm do bloco de dados concatenado acima.

// Estado mutável em memória (POST/DELETE persistem enquanto o isolate vive).
const state = {
  clientes: clientes.map((x) => ({ ...x })),
  casos: casos.map((x) => ({ ...x })),
  documentos: documentos.map((x) => ({ ...x })),
  prazos: prazos.map((x) => ({ ...x })),
  pecas_geradas: pecas_geradas.map((x) => ({ ...x })),
  advogados: advogados.map((x) => ({ ...x })),
  leads: leads.map((x) => ({ ...x })),
  receitas: receitas.map((x) => ({ ...x })),
  custos: custos.map((x) => ({ ...x })),
  pre_notas: pre_notas.map((x) => ({ ...x })),
};
let vinculos = advogado_clientes.map((x) => ({ ...x })); // advogado ⇄ cliente
const seq = Object.fromEntries(Object.keys(state).map((k) => [k, state[k].length]));
const prefix = { clientes: "cli", casos: "cas", documentos: "doc", prazos: "prz", pecas_geradas: "pec", advogados: "adv", leads: "led", receitas: "rec", custos: "cst", pre_notas: "pn" };
const defaults = {
  casos: { status: "novo" },
  prazos: { status: "pendente" },
  leads: { status: "recebeu_formulario" },
};

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS" };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

const readBody = (request) => request.json().catch(() => ({}));

// ── Util de datas (dias úteis, sem feriados — suficiente pra demo) ─────────
// `iso`/`ahead`/`ago` já vêm do bloco de dados concatenado acima.
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
  const agora = new Date(); agora.setHours(0, 0, 0, 0);
  const fatal = new Date(p.data_fatal + "T00:00:00");
  const faltam = Math.round((fatal - agora) / 86400000);
  if (faltam < 0) return "vencido";
  if (faltam <= 5) return "vencendo";
  return "ok";
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

async function handleApi(request, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  // Bearer fail-closed — token ausente/vazio/errado → 401 (igual ao Worker real).
  if ((request.headers.get("authorization") ?? "") !== `Bearer ${TOKEN}`) {
    return json({ error: "nao_autorizado" }, 401);
  }

  const path = url.pathname.replace(/^\/api/, "");
  const m = request.method;
  const parts = path.replace(/^\/+|\/+$/g, "").split("/");

  // Agenda
  if (m === "GET" && parts[0] === "agenda") {
    const itens = [...state.prazos]
      .sort((a, b) => a.data_fatal.localeCompare(b.data_fatal))
      .map((p) => ({ ...p, classe: classe(p) }));
    return json(itens);
  }

  // Agentes
  if (m === "POST" && parts[0] === "agentes") {
    const id = parts[1];
    const corpo = await readBody(request);
    const conteudo = mockAgente(id, corpo);
    const pec = { id: prefix.pecas_geradas + ++seq.pecas_geradas, caso_id: corpo.caso_id ?? null, agente: id, tipo: corpo?.entrada?.tipo ?? corpo?.entrada?.formato ?? null, conteudo, metadata: corpo.vinculo ? { vinculo: corpo.vinculo } : {}, created_at: new Date().toISOString() };
    state.pecas_geradas.unshift(pec);
    let prazo = null;
    if (id === "extrator_prazos" && corpo.prazo?.dataPublicacao && corpo.prazo?.diasUteis) {
      prazo = { id: prefix.prazos + ++seq.prazos, caso_id: corpo.caso_id ?? null, tipo: corpo.prazo.tipo || "prazo", data_publicacao: corpo.prazo.dataPublicacao, data_fatal: addDiasUteis(corpo.prazo.dataPublicacao, Number(corpo.prazo.diasUteis)), dias: Number(corpo.prazo.diasUteis), status: "pendente", created_at: new Date().toISOString() };
      state.prazos.push(prazo);
    }
    return json({ conteudo, prazo }, 201);
  }

  // Vínculo advogado ⇄ cliente: /clientes/:id/advogados[/:advId]
  if (parts[0] === "clientes" && parts[2] === "advogados") {
    const clienteId = parts[1];
    if (m === "GET") {
      const ids = vinculos.filter((v) => v.cliente_id === clienteId).map((v) => v.advogado_id);
      return json(state.advogados.filter((a) => ids.includes(a.id)));
    }
    if (m === "POST") {
      const { advogado_id } = await readBody(request);
      if (advogado_id && !vinculos.some((v) => v.cliente_id === clienteId && v.advogado_id === advogado_id)) {
        vinculos.push({ cliente_id: clienteId, advogado_id });
      }
      return json({ ok: true }, 201);
    }
    if (m === "DELETE") {
      const advId = parts[3];
      vinculos = vinculos.filter((v) => !(v.cliente_id === clienteId && v.advogado_id === advId));
      return json({ ok: true });
    }
  }

  // DataJud (mock — não chama o CNJ na demo)
  if (m === "POST" && parts[0] === "datajud") {
    const { numero, caso_id, salvar, resumir } = await readBody(request);
    if (!numero) return json({ error: "numero_obrigatorio" }, 422);
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
    return json({ ...processo, salvos, resumo }, 200);
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
    return json({ mrr, custoFixoMensal, custoUnico, investimentoAnuncios, custoMensalTotal: custoFixoMensal + investimentoAnuncios, cac, clientesConvertidos: convertidos });
  }

  // CRM — converter lead em cliente
  if (m === "POST" && parts[0] === "leads" && parts[2] === "converter") {
    const lead = state.leads.find((l) => l.id === parts[1]);
    if (!lead) return json({ error: "lead_nao_encontrado" }, 404);
    const cliente = { id: prefix.clientes + ++seq.clientes, nome: lead.nome, contato: lead.contato ?? null, created_at: new Date().toISOString() };
    state.clientes.unshift(cliente);
    lead.status = "convertido";
    lead.cliente_id = cliente.id;
    return json({ cliente, lead_id: lead.id }, 201);
  }

  // Growth — gerar pré-nota
  if (m === "POST" && parts[0] === "pre_notas" && parts[1] === "gerar") {
    const b = await readBody(request);
    if (!b.descricao_servico || typeof b.valor !== "number") return json({ error: "entrada_invalida" }, 422);
    const cli = b.cliente_id ? state.clientes.find((c) => c.id === b.cliente_id) : null;
    const numero = b.numero || `PN-${iso(new Date())}`;
    const brl = `R$ ${Number(b.valor).toFixed(2).split(".")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${Number(b.valor).toFixed(2).split(".")[1]}`;
    const conteudo = `# PRÉ-NOTA ${numero}\n\n**Cliente:** ${cli?.nome || "Cliente"}\n**Serviço:** ${b.descricao_servico}\n**Valor:** ${brl}${b.vencimento ? `\n**Vencimento:** ${b.vencimento}` : ""}\n\n---\n_Documento auxiliar de cobrança — **não é nota fiscal**._`;
    const pn = { id: prefix.pre_notas + ++seq.pre_notas, cliente_id: b.cliente_id ?? null, numero, descricao_servico: b.descricao_servico, valor: b.valor, vencimento: b.vencimento ?? null, conteudo, created_at: new Date().toISOString() };
    state.pre_notas.unshift(pn);
    return json({ ...pn, conteudo }, 201);
  }

  // Criar acesso (login) de membro da equipe — mock
  if (m === "POST" && parts[0] === "advogados" && parts[2] === "acesso") {
    const adv = state.advogados.find((a) => a.id === parts[1]);
    if (!adv?.email) return json({ error: "advogado_sem_email" }, 422);
    return json({ email: adv.email, senha_temporaria: "Adv-demo" + (++seq.advogados) }, 201);
  }

  // CRUD genérico das entidades
  const col = parts[0];
  if (col in state) {
    const id = parts[1];
    if (m === "GET" && !id) {
      return json([...state[col]].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
    }
    if (m === "POST" && !id) {
      const d = await readBody(request);
      const novo = { ...(defaults[col] || {}), ...d, id: prefix[col] + ++seq[col], created_at: new Date().toISOString() };
      state[col].unshift(novo);
      return json(novo, 201);
    }
    if (m === "PATCH" && id) {
      const d = await readBody(request);
      const row = state[col].find((x) => x.id === id);
      if (row) Object.assign(row, d);
      return json(row || {}, row ? 200 : 404);
    }
    if (m === "DELETE" && id) {
      state[col] = state[col].filter((x) => x.id !== id);
      return json({ ok: true });
    }
  }

  return json({ error: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) return handleApi(request, url);
    return env.ASSETS.fetch(request); // painel estático (index.html, app.js, style.css, config.js)
  },
};
