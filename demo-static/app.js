/* ════════════════════════════════════════════════════════════════════════
   Painel Jurídico ZX Control — lógica de UI.
   • Auth: Supabase Auth email/senha (REST) em produção; em demo (window.ZX.DEMO)
     qualquer credencial entra e usa um token fixo.
   • Toda chamada à API leva Authorization: Bearer <token> (a API é fail-closed).
   • CRUD das 5 entidades com modal funcional (POST/PATCH/DELETE) — DoD N3.
   • Output de agente sempre exibe o disclaimer (a API o anexa; aqui só renderiza).
   Domínio (áreas/status/agentes) espelha src/schema.ts — tests/dominio.test.ts
   trava o drift (um valor, um lugar).
   ════════════════════════════════════════════════════════════════════════ */

const ZX = window.ZX || {};

// ── Domínio (espelha src/schema.ts) ──────────────────────────────────────
const AREAS = ["trabalhista", "civel", "familia", "consumidor", "tributario", "empresarial", "penal", "previdenciario"];
const STATUS_CASO = ["novo", "ativo", "suspenso", "encerrado", "arquivado"];
const STATUS_PRAZO = ["pendente", "cumprido", "vencido"];
const AGENTES = ["analisador_contratos", "gerador_pecas", "resumidor_processos", "extrator_prazos", "triagem_cliente", "roteirista_social"];
const LEAD_STATUS = ["desqualificado", "recebeu_formulario", "respondeu_formulario", "reuniao_agendada", "convertido"];
const RECEITA_TIPO = ["recorrente", "unica"];
const CUSTO_TIPO = ["fixo_mensal", "unico", "anuncios"];
const FORMATOS_SOCIAL = ["reel", "carrossel"];
const CTA_OPCOES = ["link do whatsapp na bio", "comente palavra do nicho", "compartilhe", "link na bio", "chame no direct", "salve este post"];

const rotulo = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");
const fmtBRL = (v) => { const n = Number(v || 0).toFixed(2).split("."); return `R$ ${n[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${n[1]}`; };

// ── Estado / sessão ──────────────────────────────────────────────────────
let TOKEN = null;
let CACHE = { clientes: [], casos: [], advogados: [], pre_notas: [], leads: [], pecas_geradas: [] }; // p/ selects e "ver"

const $ = (sel) => document.querySelector(sel);
const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

function toast(msg) {
  const t = el(`<div class="toast">${msg}</div>`);
  $("#toast-root").appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── API client ─────────────────────────────────────────────────────────
async function api(path, { method = "GET", body } = {}) {
  const resp = await fetch(`/api/${path}`, {
    method,
    headers: { "content-type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (resp.status === 401) { sair(); throw new Error("sessão expirada"); }
  if (!resp.ok) { let m = "falha"; try { m = (await resp.json()).error || m; } catch {} throw new Error(m); }
  return resp.status === 204 ? null : resp.json();
}

// ── Autenticação ─────────────────────────────────────────────────────────
async function login(email, senha) {
  if (ZX.DEMO) { TOKEN = ZX.DEMO_TOKEN || "demo-juridico-2026"; return { email }; }
  const resp = await fetch(`${ZX.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: ZX.SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password: senha }),
  });
  if (!resp.ok) throw new Error("E-mail ou senha inválidos.");
  const data = await resp.json();
  TOKEN = data.access_token;
  return { email: data.user?.email || email };
}

function sair() {
  TOKEN = null;
  $("#app-view").classList.add("hidden");
  $("#login-view").classList.remove("hidden");
}

// ── CRUD: configuração de campos por entidade ──────────────────────────────
const sel = (opcoes) => opcoes.map((o) => ({ v: o, t: rotulo(o) }));
const ENTIDADES = {
  clientes: { titulo: "cliente", campos: [
    { n: "nome", l: "Nome", req: true },
    { n: "contato", l: "Contato (tel/e-mail)" },
    { n: "cpf_cnpj", l: "CPF/CNPJ" },
  ]},
  casos: { titulo: "caso", campos: [
    { n: "cliente_id", l: "Cliente", tipo: "ref", ref: "clientes", req: true },
    { n: "numero_processo", l: "Nº do processo" },
    { n: "area", l: "Área", tipo: "select", opcoes: sel(AREAS), req: true },
    { n: "status", l: "Status", tipo: "select", opcoes: sel(STATUS_CASO) },
  ]},
  documentos: { titulo: "documento", campos: [
    { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos", req: true },
    { n: "nome", l: "Nome do documento", req: true },
    { n: "mime", l: "Tipo (ex: application/pdf)" },
    { n: "storage_path", l: "Link para acessar" },
  ]},
  prazos: { titulo: "prazo", campos: [
    { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" },
    { n: "tipo", l: "Tipo de prazo" },
    { n: "data_publicacao", l: "Publicação", tipo: "date" },
    { n: "data_fatal", l: "Data fatal", tipo: "date", req: true },
    { n: "dias", l: "Dias úteis", tipo: "number" },
    { n: "status", l: "Situação", tipo: "select", opcoes: sel(STATUS_PRAZO) },
  ]},
  pecas_geradas: { titulo: "peça", campos: [
    { n: "agente", l: "Agente", tipo: "select", opcoes: sel(AGENTES), req: true },
    { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" },
    { n: "tipo", l: "Tipo" },
    { n: "conteudo", l: "Conteúdo", tipo: "textarea", req: true },
  ]},
  advogados: { titulo: "advogado", campos: [
    { n: "nome", l: "Nome", req: true },
    { n: "oab", l: "OAB" },
    { n: "email", l: "E-mail" },
  ]},
  leads: { titulo: "lead", campos: [
    { n: "nome", l: "Nome", req: true },
    { n: "contato", l: "Contato (tel/e-mail)" },
    { n: "origem", l: "Origem (anúncio, indicação…)" },
    { n: "status", l: "Etapa", tipo: "select", opcoes: sel(LEAD_STATUS) },
    { n: "observacao", l: "Observação", tipo: "textarea" },
  ]},
  receitas: { titulo: "receita", campos: [
    { n: "descricao", l: "Descrição" },
    { n: "cliente_id", l: "Cliente", tipo: "ref", ref: "clientes" },
    { n: "valor", l: "Valor (R$)", tipo: "number", req: true },
    { n: "tipo", l: "Tipo", tipo: "select", opcoes: sel(RECEITA_TIPO), req: true },
    { n: "data", l: "Data", tipo: "date" },
  ]},
  custos: { titulo: "custo", campos: [
    { n: "descricao", l: "Descrição", req: true },
    { n: "valor", l: "Valor (R$)", tipo: "number", req: true },
    { n: "tipo", l: "Tipo", tipo: "select", opcoes: sel(CUSTO_TIPO), req: true },
    { n: "data", l: "Data", tipo: "date" },
  ]},
};

function campoHTML(c) {
  const id = `f_${c.n}`;
  if (c.tipo === "textarea") return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><textarea id="${id}" ${c.req ? "required" : ""}></textarea></label>`;
  if (c.tipo === "select") return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><select id="${id}"><option value="">—</option>${c.opcoes.map((o) => `<option value="${o.v}">${o.t}</option>`).join("")}</select></label>`;
  if (c.tipo === "ref") { const opts = (CACHE[c.ref] || []).map((r) => `<option value="${r.id}">${r.nome || r.numero_processo || r.id}</option>`).join(""); return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><select id="${id}"><option value="">—</option>${opts}</select></label>`; }
  if (c.tipo === "clienteNome") {
    const opts = (CACHE.clientes || []).map((r) => `<option value="${r.nome}">${r.nome}</option>`).join("");
    return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><select id="${id}"><option value="">—</option>${opts}</select></label>`;
  }
  if (c.tipo === "vinculo") {
    const cli = (CACHE.clientes || []).map((r) => `<option value="cliente:${r.id}">${r.nome}</option>`).join("");
    const leads = (CACHE.leads || []).filter((l) => l.status !== "convertido").map((r) => `<option value="lead:${r.id}">${r.nome}</option>`).join("");
    return `<label class="field"><span>${c.l}</span><select id="${id}"><option value="">— nenhum —</option><optgroup label="Clientes">${cli}</optgroup><optgroup label="Leads">${leads}</optgroup></select></label>`;
  }
  const tipo = c.tipo === "date" ? "date" : c.tipo === "number" ? "number" : "text";
  const im = c.tipo === "number" ? 'inputmode="numeric"' : "";
  return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><input id="${id}" type="${tipo}" ${im} /></label>`;
}

function abrirModalNovo(tabela) {
  const def = ENTIDADES[tabela];
  const modal = el(`<div class="backdrop"><div class="modal"><h3>Novo ${def.titulo}</h3>
    <form id="crud-form">${def.campos.map(campoHTML).join("")}
    <div class="modal-actions"><button type="button" class="btn" data-cancel>Cancelar</button>
    <button type="submit" class="btn btn-primary">Salvar</button></div></form></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  modal.querySelector("#crud-form").onsubmit = async (e) => {
    e.preventDefault();
    const corpo = {};
    for (const c of def.campos) {
      const v = modal.querySelector(`#f_${c.n}`).value;
      if (v === "") continue;
      corpo[c.n] = c.tipo === "number" ? Number(v) : v;
    }
    try {
      await api(tabela, { method: "POST", body: corpo }); // <- POST real, não stub
      modal.remove();
      toast(`${rotulo(def.titulo)} salvo.`);
      await carregar(tabela);
    } catch (err) { toast(`Erro: ${err.message}`); }
  };
}

async function excluir(tabela, id) {
  if (!confirm("Excluir este registro?")) return;
  try { await api(`${tabela}/${id}`, { method: "DELETE" }); toast("Excluído."); await carregar(tabela); }
  catch (err) { toast(`Erro: ${err.message}`); }
}

// ── Render das tabelas ─────────────────────────────────────────────────
const badge = (estado) => `<span class="badge ${estado}">${rotulo(estado)}</span>`;
const acoes = (tabela, id) => `<div class="row-actions"><button class="btn btn-sm btn-danger" data-del="${tabela}:${id}">Excluir</button></div>`;

const RENDER = {
  clientes: (r) => `<td>${r.nome || ""}</td><td>${r.contato || "—"}</td><td>${r.cpf_cnpj || "—"}</td><td><div class="row-actions"><button class="btn btn-sm" data-vinc="${r.id}">Advogados</button><button class="btn btn-sm btn-danger" data-del="clientes:${r.id}">Excluir</button></div></td>`,
  casos: (r) => `<td>${r.numero_processo || "—"}</td><td>${nomeRef("clientes", r.cliente_id)}</td><td>${rotulo(r.area)}</td><td>${badge(r.status)}</td><td><div class="row-actions"><button class="btn btn-sm" data-datajud="${r.id}">DataJud</button><button class="btn btn-sm btn-danger" data-del="casos:${r.id}">Excluir</button></div></td>`,
  documentos: (r) => `<td>${r.nome || ""}</td><td>${nomeRef("casos", r.caso_id)}</td><td>${r.mime || "—"}</td><td>${acoes("documentos", r.id)}</td>`,
  pecas_geradas: (r) => `<td>${rotulo(r.agente)}</td><td>${r.tipo || "—"}</td><td>${nomeRef("casos", r.caso_id)}</td><td>${(r.created_at || "").slice(0, 10)}</td><td><button class="btn btn-sm" data-ver="${r.id}">Ver</button></td>`,
  advogados: (r) => `<td>${r.nome || ""}</td><td>${r.oab || "—"}</td><td>${r.email || "—"}</td><td><div class="row-actions">${r.email ? `<button class="btn btn-sm" data-acesso="${r.id}">Criar acesso</button>` : ""}<button class="btn btn-sm btn-danger" data-del="advogados:${r.id}">Excluir</button></div></td>`,
  leads: (r) => {
    if (r.status === "convertido")
      return `<td>${r.nome || ""}</td><td>${r.contato || "—"}</td><td>${r.origem || "—"}</td><td>${badge("convertido")}</td><td><span style="color:var(--muted);font-size:12px">→ virou cliente</span></td>`;
    const opts = LEAD_STATUS.filter((s) => s !== "convertido")
      .map((s) => `<option value="${s}" ${s === r.status ? "selected" : ""}>${rotulo(s)}</option>`)
      .join("");
    return `<td>${r.nome || ""}</td><td>${r.contato || "—"}</td><td>${r.origem || "—"}</td>
      <td><select class="lead-status" data-lead="${r.id}" style="padding:5px 8px;font-size:12px">${opts}</select></td>
      <td><div class="row-actions"><button class="btn btn-sm" data-converter="${r.id}">Converter</button><button class="btn btn-sm btn-danger" data-del="leads:${r.id}">Excluir</button></div></td>`;
  },
  receitas: (r) => `<td>${r.descricao || "—"}</td><td>${nomeRef("clientes", r.cliente_id)}</td><td class="mono">${fmtBRL(r.valor)}</td><td>${badge(r.tipo)}</td><td>${acoes("receitas", r.id)}</td>`,
  custos: (r) => `<td>${r.descricao || "—"}</td><td class="mono">${fmtBRL(r.valor)}</td><td>${badge(r.tipo)}</td><td>${acoes("custos", r.id)}</td>`,
  pre_notas: (r) => `<td class="mono">${r.numero || "—"}</td><td>${nomeRef("clientes", r.cliente_id)}</td><td>${r.descricao_servico || "—"}</td><td class="mono">${fmtBRL(r.valor)}</td><td><button class="btn btn-sm" data-vernota="${r.id}">Ver</button></td>`,
};

function nomeRef(tabela, id) {
  if (!id) return "—";
  const r = (CACHE[tabela] || []).find((x) => x.id === id);
  return r ? (r.nome || r.numero_processo || id) : id;
}

async function carregar(tabela) {
  if (tabela === "prazos") return carregarAgenda();
  const dados = await api(tabela);
  if (tabela in CACHE) CACHE[tabela] = dados;
  const tb = $(`#tb-${tabela}`);
  tb.innerHTML = dados.length
    ? dados.map((r) => `<tr>${RENDER[tabela](r)}</tr>`).join("")
    : `<tr><td colspan="6"><div class="empty">Nenhum registro. Use “+ Novo”.</div></td></tr>`;
}

async function carregarAgenda() {
  const dados = await api("agenda");
  const tb = $("#tb-prazos");
  tb.innerHTML = dados.length
    ? dados.map((p) => `<tr class="${p.classe}"><td>${p.tipo || "—"}</td><td>${nomeRef("casos", p.caso_id)}</td><td>${p.data_publicacao || "—"}</td><td>${p.data_fatal}</td><td>${badge(p.classe === "ok" ? p.status : p.classe)}</td><td>${acoes("prazos", p.id)}</td></tr>`).join("")
    : `<tr><td colspan="6"><div class="empty">Nenhum prazo na agenda.</div></td></tr>`;
}

// ── Agentes ──────────────────────────────────────────────────────────────
const AGENTES_UI = {
  analisador_contratos: { titulo: "Analisador de Contratos", desc: "Cole o texto do contrato e receba riscos, cláusulas abusivas/faltantes e semáforo.",
    campos: [{ n: "representa", l: "Quem o advogado representa", tipo: "clienteNome" }, { n: "texto", l: "Cole o texto do contrato aqui", tipo: "textarea" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  gerador_pecas: { titulo: "Gerador de Petições", desc: "Tipo de peça + fatos + demandante/demandado + pedidos → minuta em markdown.",
    campos: [{ n: "tipo", l: "Tipo de peça", tipo: "select", opcoes: sel(["petição inicial", "contestação", "notificação extrajudicial", "contrato"]) }, { n: "fatos", l: "Fatos", tipo: "textarea" }, { n: "demandante", l: "Demandante (autor/requerente)" }, { n: "demandado", l: "Demandado (réu/requerido)" }, { n: "pedidos", l: "Pedidos", tipo: "textarea" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  resumidor_processos: { titulo: "Resumidor de Processos", desc: "Cole o texto dos autos e receba resumo, linha do tempo, situação e próximos passos.",
    campos: [{ n: "texto", l: "Cole o texto dos autos aqui", tipo: "textarea" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  extrator_prazos: { titulo: "Extrator de Prazos", desc: "Intimação → prazo + data fatal em dias úteis, gravado na agenda.",
    campos: [{ n: "texto", l: "Texto da intimação", tipo: "textarea" }, { n: "tipo", l: "Tipo de prazo" }, { n: "dataPublicacao", l: "Data da publicação", tipo: "date" }, { n: "diasUteis", l: "Dias úteis", tipo: "number" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  triagem_cliente: { titulo: "Triagem de Cliente", desc: "Relato em texto → ficha do caso, área, documentos e viabilidade.",
    campos: [{ n: "texto", l: "Relato do cliente", tipo: "textarea" }, { n: "vinculo", l: "Vincular a (cliente ou lead)", tipo: "vinculo" }] },
  roteirista_social: { titulo: "Roteirista de Conteúdo", desc: "Tema → roteiro de Reel/carrossel com hook, desenvolvimento, amplificação e CTA.",
    campos: [{ n: "tema", l: "Tema do conteúdo", tipo: "textarea" }, { n: "formato", l: "Formato", tipo: "select", opcoes: sel(FORMATOS_SOCIAL) }, { n: "cta", l: "CTA (chamada para ação)", tipo: "select", opcoes: sel(CTA_OPCOES) }] },
};

function renderAgentCards() {
  const wrap = $("#agent-cards");
  wrap.innerHTML = AGENTES.map((id, i) => {
    const a = AGENTES_UI[id];
    return `<div class="card" data-agent="${id}"><div class="ag-num">AGENTE ${i + 1}</div><h3>${a.titulo}</h3><p>${a.desc}</p></div>`;
  }).join("");
}

function lerArquivoBase64(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).split(",")[1]);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

function abrirAgente(id) {
  const a = AGENTES_UI[id];
  const modal = el(`<div class="backdrop"><div class="modal wide"><h3>${a.titulo}</h3>
    <form id="ag-form">${a.campos.map(campoHTML).join("")}
    <div class="modal-actions"><button type="button" class="btn" data-cancel>Fechar</button>
    <button type="submit" class="btn btn-primary">Executar</button></div></form>
    <div id="ag-result"></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  modal.querySelector("#ag-form").onsubmit = async (e) => {
    e.preventDefault();
    const entrada = {}; let documentos; let prazo; let caso_id = null; let vinculo = null;
    for (const c of a.campos) {
      const node = modal.querySelector(`#f_${c.n}`);
      if (c.tipo === "file") {
        const f = node.files?.[0];
        if (f) documentos = [{ mime: f.type || "application/pdf", dados: await lerArquivoBase64(f) }];
        continue;
      }
      const v = node.value;
      if (c.n === "caso_id") { caso_id = v || null; continue; }
      if (c.tipo === "vinculo") { if (v) { const [tipo, vid] = v.split(":"); vinculo = { tipo, id: vid }; } continue; }
      if (v !== "") entrada[c.n] = c.tipo === "number" ? Number(v) : v;
    }
    if (id === "extrator_prazos" && entrada.dataPublicacao && entrada.diasUteis) {
      prazo = { tipo: entrada.tipo || "prazo", diasUteis: Number(entrada.diasUteis), dataPublicacao: entrada.dataPublicacao };
    }
    const res = modal.querySelector("#ag-result");
    res.innerHTML = `<div class="empty">Processando…</div>`;
    try {
      const out = await api(`agentes/${id}`, { method: "POST", body: { entrada, documentos, prazo, caso_id, vinculo } });
      res.innerHTML = `<div class="ai-output" id="ag-md"></div>`;
      res.querySelector("#ag-md").textContent = out.conteudo;
      if (out.prazo) toast(`Prazo gravado na agenda: ${out.prazo.data_fatal}`);
      if (vinculo) toast(`Triagem vinculada ao ${vinculo.tipo}.`);
    } catch (err) { res.innerHTML = `<div class="login-err">Erro: ${err.message}</div>`; }
  };
}

// ── Vínculo advogado ⇄ cliente ─────────────────────────────────────────
async function abrirVinculos(clienteId) {
  const cli = (CACHE.clientes || []).find((c) => c.id === clienteId);
  const modal = el(`<div class="backdrop"><div class="modal"><h3>Advogados de ${cli?.nome || "cliente"}</h3>
    <div id="vinc-lista"><div class="empty">Carregando…</div></div>
    <label class="field"><span>Vincular advogado</span><select id="vinc-sel"><option value="">—</option>${(CACHE.advogados || []).map((a) => `<option value="${a.id}">${a.nome}</option>`).join("")}</select></label>
    <div class="modal-actions"><button type="button" class="btn" data-cancel>Fechar</button><button type="button" class="btn btn-primary" id="vinc-add">Vincular</button></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  const render = async () => {
    const advs = await api(`clientes/${clienteId}/advogados`);
    modal.querySelector("#vinc-lista").innerHTML = advs.length
      ? advs.map((a) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">${a.nome}${a.oab ? ` <span class="mono" style="color:var(--muted)">OAB ${a.oab}</span>` : ""} <button class="btn btn-sm btn-danger" data-unlink="${a.id}">remover</button></div>`).join("")
      : `<div class="empty">Nenhum advogado vinculado.</div>`;
    modal.querySelectorAll("[data-unlink]").forEach((b) => (b.onclick = async () => {
      try { await api(`clientes/${clienteId}/advogados/${b.dataset.unlink}`, { method: "DELETE" }); render(); }
      catch (err) { toast(`Erro: ${err.message}`); }
    }));
  };
  modal.querySelector("#vinc-add").onclick = async () => {
    const aid = modal.querySelector("#vinc-sel").value;
    if (!aid) return;
    try { await api(`clientes/${clienteId}/advogados`, { method: "POST", body: { advogado_id: aid } }); toast("Vinculado."); render(); }
    catch (err) { toast(`Erro: ${err.message}`); }
  };
  render();
}

// ── DataJud (consulta processual) ──────────────────────────────────────
async function abrirDataJud(casoId) {
  const caso = (CACHE.casos || []).find((c) => c.id === casoId);
  const modal = el(`<div class="backdrop"><div class="modal wide"><h3>DataJud — consulta processual</h3>
    <label class="field"><span>Número do processo (CNJ)</span><input id="dj-num" class="mono" value="${caso?.numero_processo || ""}" placeholder="0000000-00.0000.0.00.0000" /></label>
    <div class="modal-actions"><button type="button" class="btn" data-cancel>Fechar</button>
      <button type="button" class="btn" id="dj-resumir">Consultar + Resumir (IA)</button>
      <button type="button" class="btn btn-primary" id="dj-consultar">Consultar + salvar andamentos</button></div>
    <div id="dj-result"></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  const consultar = async (resumir) => {
    const numero = modal.querySelector("#dj-num").value.trim();
    if (!numero) { toast("Informe o número do processo."); return; }
    const res = modal.querySelector("#dj-result");
    res.innerHTML = `<div class="empty">Consultando o CNJ…</div>`;
    try {
      const out = await api("datajud", { method: "POST", body: { numero, caso_id: casoId, salvar: true, resumir } });
      if (out.existe === false) { res.innerHTML = `<div class="login-err">Processo não encontrado no DataJud.</div>`; return; }
      const c = out.capa || {};
      const movs = (out.movimentos || []).slice(0, 30).map((m) => `<tr><td class="mono">${(m.data || "").slice(0, 10)}</td><td>${m.descricao}</td></tr>`).join("");
      res.innerHTML = `<div class="ai-output"><b>${c.classe || "—"}</b> — ${(c.assuntos || []).join("; ")}<br>${c.orgaoJulgador || ""} · ${c.tribunal || ""}/${c.grau || ""}</div>
        ${out.salvos ? `<p class="disclaimer">${out.salvos} andamentos salvos no caso.</p>` : ""}
        <div class="tbl-wrap" style="margin-top:10px"><table><thead><tr><th>Data</th><th>Movimento</th></tr></thead><tbody>${movs}</tbody></table></div>
        ${out.resumo ? `<div class="ai-output" style="margin-top:12px" id="dj-resumo"></div>` : ""}`;
      if (out.resumo) res.querySelector("#dj-resumo").textContent = out.resumo;
      toast("Consulta concluída.");
    } catch (err) { res.innerHTML = `<div class="login-err">Erro: ${err.message}</div>`; }
  };
  modal.querySelector("#dj-consultar").onclick = () => consultar(false);
  modal.querySelector("#dj-resumir").onclick = () => consultar(true);
}

// ── Growth ───────────────────────────────────────────────────────────────
async function carregarGrowth() {
  try {
    const g = await api("growth");
    const cards = [
      ["MRR — receita recorrente", fmtBRL(g.mrr)],
      ["Custo fixo mensal", fmtBRL(g.custoFixoMensal)],
      ["Investimento em anúncios", fmtBRL(g.investimentoAnuncios)],
      ["CAC", g.cac == null ? "—" : fmtBRL(g.cac)],
    ];
    $("#growth-cards").innerHTML = cards
      .map(([t, v]) => `<div class="card"><div class="n">${t}</div><h3 style="font-size:1.7rem;margin:8px 0 0">${v}</h3></div>`)
      .join("");
  } catch { $("#growth-cards").innerHTML = `<div class="empty">Não foi possível carregar as métricas.</div>`; }
  await Promise.all([carregar("receitas"), carregar("custos"), carregar("pre_notas")]).catch(() => {});
}

async function converterLead(leadId) {
  if (!confirm("Converter este lead em cliente?")) return;
  try {
    const r = await api(`leads/${leadId}/converter`, { method: "POST" });
    toast(`Convertido em cliente: ${r.cliente?.nome || ""}`);
    await carregar("leads");
    await carregar("clientes");
  } catch (err) { toast(`Erro: ${err.message}`); }
}

function abrirPreNota() {
  const opts = (CACHE.clientes || []).map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
  const modal = el(`<div class="backdrop"><div class="modal"><h3>Gerar pré-nota</h3>
    <form id="pn-form">
    <label class="field"><span>Cliente</span><select id="pn-cli"><option value="">—</option>${opts}</select></label>
    <label class="field"><span>Descrição do serviço *</span><input id="pn-desc" required /></label>
    <label class="field"><span>Valor (R$) *</span><input id="pn-valor" type="number" inputmode="numeric" required /></label>
    <label class="field"><span>Vencimento</span><input id="pn-venc" type="date" /></label>
    <div class="modal-actions"><button type="button" class="btn" data-cancel>Cancelar</button><button type="submit" class="btn btn-primary">Gerar</button></div></form>
    <div id="pn-result"></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  modal.querySelector("#pn-form").onsubmit = async (e) => {
    e.preventDefault();
    const body = {
      cliente_id: modal.querySelector("#pn-cli").value || null,
      descricao_servico: modal.querySelector("#pn-desc").value,
      valor: Number(modal.querySelector("#pn-valor").value),
      vencimento: modal.querySelector("#pn-venc").value || undefined,
    };
    try {
      const r = await api("pre_notas/gerar", { method: "POST", body });
      modal.querySelector("#pn-result").innerHTML = `<div class="ai-output" id="pn-md"></div>`;
      modal.querySelector("#pn-md").textContent = r.conteudo;
      toast("Pré-nota gerada.");
      carregar("pre_notas");
    } catch (err) { modal.querySelector("#pn-result").innerHTML = `<div class="login-err">Erro: ${err.message}</div>`; }
  };
}

function verNota(id) {
  const n = (CACHE.pre_notas || []).find((x) => x.id === id);
  if (!n) return;
  const modal = el(`<div class="backdrop"><div class="modal"><h3>Pré-nota ${n.numero || ""}</h3><div class="ai-output" id="vn"></div><div class="modal-actions"><button type="button" class="btn" data-cancel>Fechar</button></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("#vn").textContent = n.conteudo || "(sem conteúdo)";
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
}

// Ver peça gerada (qualquer agente, inclusive roteiros) — modal com o conteúdo.
function verPeca(id) {
  const p = (CACHE.pecas_geradas || []).find((x) => x.id === id);
  if (!p) { toast("Peça não encontrada — recarregue a aba."); return; }
  const vinc = p.metadata?.vinculo
    ? `<p class="disclaimer">Vinculado a ${p.metadata.vinculo.tipo}: ${p.metadata.vinculo.id}</p>` : "";
  const modal = el(`<div class="backdrop"><div class="modal wide"><h3>${rotulo(p.agente)}${p.tipo ? " · " + p.tipo : ""}</h3>
    <div class="ai-output" id="vp"></div>${vinc}
    <div class="modal-actions"><button type="button" class="btn" id="vp-copy">Copiar</button><button type="button" class="btn" data-cancel>Fechar</button></div></div></div>`);
  $("#modal-root").appendChild(modal);
  modal.querySelector("#vp").textContent = p.conteudo || "(sem conteúdo)";
  modal.querySelector("[data-cancel]").onclick = () => modal.remove();
  modal.querySelector("#vp-copy").onclick = async () => { try { await navigator.clipboard.writeText(p.conteudo || ""); toast("Copiado."); } catch {} };
}

// Criar acesso (login) para um membro da equipe.
async function acessoAdvogado(id) {
  if (!confirm("Criar um login de acesso para este advogado? Ele poderá entrar com o e-mail cadastrado.")) return;
  try {
    const r = await api(`advogados/${id}/acesso`, { method: "POST" });
    const modal = el(`<div class="backdrop"><div class="modal"><h3>Acesso criado ✅</h3>
      <p style="color:var(--text-secondary);font-size:13px">Envie estas credenciais ao advogado. A senha aparece <b>uma única vez</b> — ele pode trocá-la depois.</p>
      <div class="ai-output"><b>E-mail:</b> ${r.email}<br><b>Senha temporária:</b> <span class="mono">${r.senha_temporaria}</span></div>
      <div class="modal-actions"><button type="button" class="btn" id="ac-copy">Copiar</button><button type="button" class="btn btn-primary" data-cancel>Fechar</button></div></div></div>`);
    $("#modal-root").appendChild(modal);
    modal.querySelector("[data-cancel]").onclick = () => modal.remove();
    modal.querySelector("#ac-copy").onclick = async () => { try { await navigator.clipboard.writeText(`E-mail: ${r.email}\nSenha: ${r.senha_temporaria}`); toast("Copiado."); } catch {} };
  } catch (err) {
    const m = { service_key_ausente: "Configure a chave de serviço (service_role) no servidor para criar acessos.", acesso_ja_existe: "Já existe um acesso para esse e-mail." }[err.message] || err.message;
    toast(`Erro: ${m}`);
  }
}

// Aba "Roteiros gerados" — peças do agente Roteirista.
async function carregarRoteiros() {
  const dados = await api("pecas_geradas");
  CACHE.pecas_geradas = dados;
  const rot = dados.filter((p) => p.agente === "roteirista_social");
  const linha1 = (c) => ((c || "").split("\n").map((s) => s.trim()).find(Boolean) || "—").replace(/[*#]/g, "");
  $("#tb-roteiros").innerHTML = rot.length
    ? rot.map((p) => `<tr><td>${(p.created_at || "").slice(0, 10)}</td><td>${p.tipo || "roteiro"}</td><td>${linha1(p.conteudo).slice(0, 80)}</td><td><button class="btn btn-sm" data-ver="${p.id}">Ver</button></td></tr>`).join("")
    : `<tr><td colspan="4"><div class="empty">Nenhum roteiro gerado ainda. Use o agente “Roteirista de Conteúdo”.</div></td></tr>`;
}

// ── Navegação ──────────────────────────────────────────────────────────
function irPara(view) {
  document.querySelectorAll(".navpill").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("hidden", p.dataset.page !== view));
  if (view === "growth") return carregarGrowth();
  if (view === "crm") return carregar("leads");
  if (view === "roteiros") return carregarRoteiros();
  if (view !== "agentes") carregar(view);
}

// ── Boot ───────────────────────────────────────────────────────────────
function iniciarApp(email) {
  $("#login-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-email").textContent = email;
  renderAgentCards();
  // pré-carrega refs p/ selects
  Promise.all([carregar("clientes"), carregar("casos"), carregar("advogados"), carregar("leads")]).catch(() => {});
  irPara("agentes");
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.view) irPara(t.dataset.view);
  if (t.dataset.novo) abrirModalNovo(t.dataset.novo);
  if (t.dataset.agent) abrirAgente(t.dataset.agent);
  if (t.closest?.("[data-agent]")) abrirAgente(t.closest("[data-agent]").dataset.agent);
  if (t.dataset.del) { const [tab, id] = t.dataset.del.split(":"); excluir(tab, id); }
  if (t.dataset.vinc) abrirVinculos(t.dataset.vinc);
  if (t.dataset.datajud) abrirDataJud(t.dataset.datajud);
  if (t.dataset.converter) converterLead(t.dataset.converter);
  if (t.dataset.vernota) verNota(t.dataset.vernota);
  if (t.dataset.ver) verPeca(t.dataset.ver);
  if (t.dataset.acesso) acessoAdvogado(t.dataset.acesso);
  if (t.id === "btn-pre-nota") abrirPreNota();
});

// Mudança de etapa do lead (select inline no CRM) → PATCH
document.addEventListener("change", async (e) => {
  const t = e.target;
  if (t.classList?.contains("lead-status")) {
    try { await api(`leads/${t.dataset.lead}`, { method: "PATCH", body: { status: t.value } }); toast("Etapa atualizada."); }
    catch (err) { toast(`Erro: ${err.message}`); carregar("leads"); }
  }
});

$("#logout-btn").onclick = sair;
$("#login-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#login-err").textContent = "";
  try {
    const u = await login($("#login-email").value, $("#login-senha").value);
    iniciarApp(u.email);
  } catch (err) { $("#login-err").textContent = err.message; }
};
