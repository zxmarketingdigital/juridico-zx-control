// Mock estático da API do Jurídico para a DEMO pública (CD Tech).
// Faz monkeypatch de window.fetch e espelha o contrato de demo/server.mjs:
// agenda, agentes/:id, vínculos, datajud, growth, conversão de lead, pré-notas,
// acesso e CRUD genérico das entidades. Estado mutável em memória.
// Carregar APÓS data.js e ANTES de app.js.

(function () {
  const origFetch = window.fetch.bind(window);
  const DB = window.__DEMO__;
  const DISCLAIMER = "Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória.";

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
  let vinculos = DB.advogado_clientes.map((x) => ({ ...x }));
  const seq = Object.fromEntries(Object.keys(state).map((k) => [k, state[k].length]));
  const prefix = { clientes: "cli", casos: "cas", documentos: "doc", prazos: "prz", pecas_geradas: "pec", advogados: "adv", leads: "led", receitas: "rec", custos: "cst", pre_notas: "pn" };
  const defaults = { casos: { status: "novo" }, prazos: { status: "pendente" }, leads: { status: "recebeu_formulario" } };

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

  function mockAgente(id, corpo) {
    if (id === "roteirista_social") {
      const e = corpo?.entrada || {};
      const tema = e.tema || "(defina o tema)";
      const formato = e.formato || "reel";
      const cta = e.cta || "link na bio";
      return [
        `**Roteiro de ${formato} — tema: ${tema}**`, "",
        `**HOOK:** Você sabe a verdade sobre ${tema}?`,
        `**DESENVOLVIMENTO:** No produto real, a IA detalha "${tema}" em pontos claros e úteis.`,
        `**AMPLIFICAÇÃO:** Por que ${tema} importa pra quem te acompanha.`,
        `**CTA:** ${cta}.`, "", "---", DISCLAIMER, "",
        "_(demo: texto ilustrativo que reflete suas escolhas — o roteiro completo é gerado pela IA no produto)_",
      ].join("\n");
    }
    const out = {
      analisador_contratos: "### Riscos\n- Cláusula de multa desproporcional 🔴\n- Falta cláusula de rescisão 🟡\n\n### Sugestões de redação\n- Limitar multa a 10% do valor do contrato.",
      gerador_pecas: "EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A)...\n\n**DOS FATOS**\n(...)\n\n**DO DIREITO**\nEm tese, aplica-se a legislação pertinente (sem citar julgados).\n\n**DOS PEDIDOS**\n(...)",
      resumidor_processos: "**Resumo executivo:** ação em fase de instrução.\n**Linha do tempo:** distribuição → contestação → réplica.\n**Situação atual:** aguardando audiência.\n**Próximos passos:** arrolar testemunhas.",
      extrator_prazos: "**Tipo:** Contestação\n**Contagem:** 15 dias úteis\n**Termo inicial:** primeiro dia útil seguinte à publicação.",
      triagem_cliente: "**Ficha:** partes e fatos do relato.\n**Área:** Cível.\n**Documentos:** contrato, comprovantes, RG/CPF.\n**Viabilidade:** Médio.",
    }[id] || "Resultado gerado.";
    return `${out}\n\n---\n${DISCLAIMER}`;
  }

  function jsonResp(data, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  }

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === "string" ? input : (input && input.url) || "";
    let url;
    try { url = new URL(urlStr, location.origin); } catch { return origFetch(input, init); }
    if (!url.pathname.startsWith("/api")) return origFetch(input, init);

    const m = (init.method || "GET").toUpperCase();
    if (m === "OPTIONS") return new Response(null, { status: 204 });
    const path = url.pathname.replace(/^\/api/, "");
    const parts = path.replace(/^\/+|\/+$/g, "").split("/");
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }

    // Agenda
    if (m === "GET" && parts[0] === "agenda") {
      const itens = [...state.prazos].sort((a, b) => a.data_fatal.localeCompare(b.data_fatal)).map((p) => ({ ...p, classe: classe(p) }));
      return jsonResp(itens);
    }

    // Agentes
    if (m === "POST" && parts[0] === "agentes") {
      const id = parts[1];
      const conteudo = mockAgente(id, body);
      const pec = { id: prefix.pecas_geradas + ++seq.pecas_geradas, caso_id: body.caso_id ?? null, agente: id, tipo: body?.entrada?.tipo ?? body?.entrada?.formato ?? null, conteudo, metadata: body.vinculo ? { vinculo: body.vinculo } : {}, created_at: new Date().toISOString() };
      state.pecas_geradas.unshift(pec);
      let prazo = null;
      if (id === "extrator_prazos" && body.prazo?.dataPublicacao && body.prazo?.diasUteis) {
        prazo = { id: prefix.prazos + ++seq.prazos, caso_id: body.caso_id ?? null, tipo: body.prazo.tipo || "prazo", data_publicacao: body.prazo.dataPublicacao, data_fatal: addDiasUteis(body.prazo.dataPublicacao, Number(body.prazo.diasUteis)), dias: Number(body.prazo.diasUteis), status: "pendente", created_at: new Date().toISOString() };
        state.prazos.push(prazo);
      }
      return jsonResp({ conteudo, prazo }, 201);
    }

    // Vínculo advogado ⇄ cliente
    if (parts[0] === "clientes" && parts[2] === "advogados") {
      const clienteId = parts[1];
      if (m === "GET") {
        const ids = vinculos.filter((v) => v.cliente_id === clienteId).map((v) => v.advogado_id);
        return jsonResp(state.advogados.filter((a) => ids.includes(a.id)));
      }
      if (m === "POST") {
        const advId = body.advogado_id;
        if (advId && !vinculos.some((v) => v.cliente_id === clienteId && v.advogado_id === advId)) vinculos.push({ cliente_id: clienteId, advogado_id: advId });
        return jsonResp({ ok: true }, 201);
      }
      if (m === "DELETE") {
        const advId = parts[3];
        vinculos = vinculos.filter((v) => !(v.cliente_id === clienteId && v.advogado_id === advId));
        return jsonResp({ ok: true });
      }
    }

    // DataJud (mock)
    if (m === "POST" && parts[0] === "datajud") {
      if (!body.numero) return jsonResp({ error: "numero_obrigatorio" }, 422);
      const movimentos = [
        { data: iso(new Date()), codigo: 85, descricao: "Decisão — defiro a juntada de documentos" },
        { data: iso(new Date(Date.now() - 6 * 864e5)), codigo: 51, descricao: "Audiência de conciliação designada" },
        { data: iso(new Date(Date.now() - 30 * 864e5)), codigo: 26, descricao: "Distribuição por sorteio" },
      ];
      const processo = { existe: true, numero: String(body.numero).replace(/\D/g, ""), capa: { classe: "Procedimento Comum Cível", assuntos: ["Indenização por Dano Material"], orgaoJulgador: "2ª Vara Cível Central", tribunal: "TJSP", grau: "G1", dataAjuizamento: "20250101000000" }, movimentos };
      const salvos = body.salvar && body.caso_id ? movimentos.length : 0;
      const resumo = body.resumir ? mockAgente("resumidor_processos", {}) : null;
      return jsonResp({ ...processo, salvos, resumo }, 200);
    }

    // Growth — métricas
    if (m === "GET" && parts[0] === "growth") {
      const soma = (arr, t) => Math.round(arr.filter((x) => x.tipo === t).reduce((s, x) => s + Number(x.valor || 0), 0) * 100) / 100;
      const mrr = soma(state.receitas, "recorrente");
      const custoFixoMensal = soma(state.custos, "fixo_mensal");
      const investimentoAnuncios = soma(state.custos, "anuncios");
      const custoUnico = soma(state.custos, "unico");
      const convertidos = state.leads.filter((l) => l.status === "convertido").length;
      const cac = convertidos > 0 ? Math.round((investimentoAnuncios / convertidos) * 100) / 100 : null;
      return jsonResp({ mrr, custoFixoMensal, custoUnico, investimentoAnuncios, custoMensalTotal: custoFixoMensal + investimentoAnuncios, cac, clientesConvertidos: convertidos });
    }

    // CRM — converter lead em cliente
    if (m === "POST" && parts[0] === "leads" && parts[2] === "converter") {
      const lead = state.leads.find((l) => l.id === parts[1]);
      if (!lead) return jsonResp({ error: "lead_nao_encontrado" }, 404);
      const cliente = { id: prefix.clientes + ++seq.clientes, nome: lead.nome, contato: lead.contato ?? null, created_at: new Date().toISOString() };
      state.clientes.unshift(cliente);
      lead.status = "convertido";
      lead.cliente_id = cliente.id;
      return jsonResp({ cliente, lead_id: lead.id }, 201);
    }

    // Growth — gerar pré-nota
    if (m === "POST" && parts[0] === "pre_notas" && parts[1] === "gerar") {
      if (!body.descricao_servico || typeof body.valor !== "number") return jsonResp({ error: "entrada_invalida" }, 422);
      const cli = body.cliente_id ? state.clientes.find((c) => c.id === body.cliente_id) : null;
      const numero = body.numero || `PN-${iso(new Date())}`;
      const dec = Number(body.valor).toFixed(2).split(".");
      const brl = `R$ ${dec[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec[1]}`;
      const conteudo = `# PRÉ-NOTA ${numero}\n\n**Cliente:** ${cli?.nome || "Cliente"}\n**Serviço:** ${body.descricao_servico}\n**Valor:** ${brl}${body.vencimento ? `\n**Vencimento:** ${body.vencimento}` : ""}\n\n---\n_Documento auxiliar de cobrança — **não é nota fiscal**._`;
      const pn = { id: prefix.pre_notas + ++seq.pre_notas, cliente_id: body.cliente_id ?? null, numero, descricao_servico: body.descricao_servico, valor: body.valor, vencimento: body.vencimento ?? null, conteudo, created_at: new Date().toISOString() };
      state.pre_notas.unshift(pn);
      return jsonResp({ ...pn, conteudo }, 201);
    }

    // Criar acesso (login) de advogado — mock
    if (m === "POST" && parts[0] === "advogados" && parts[2] === "acesso") {
      const adv = state.advogados.find((a) => a.id === parts[1]);
      if (!adv?.email) return jsonResp({ error: "advogado_sem_email" }, 422);
      return jsonResp({ email: adv.email, senha_temporaria: "Adv-demo" + (++seq.advogados) }, 201);
    }

    // CRUD genérico
    const col = parts[0];
    if (col in state) {
      const id = parts[1];
      if (m === "GET" && !id) return jsonResp([...state[col]].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")));
      if (m === "POST" && !id) {
        const novo = { ...(defaults[col] || {}), ...body, id: prefix[col] + ++seq[col], created_at: new Date().toISOString() };
        state[col].unshift(novo);
        return jsonResp(novo, 201);
      }
      if (m === "PATCH" && id) {
        const row = state[col].find((x) => x.id === id);
        if (row) Object.assign(row, body);
        return jsonResp(row || {}, row ? 200 : 404);
      }
      if (m === "DELETE" && id) {
        state[col] = state[col].filter((x) => x.id !== id);
        return jsonResp({ ok: true });
      }
    }

    return jsonResp({ error: "not_found" }, 404);
  };
})();
