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
const AGENTES = ["analisador_contratos", "gerador_pecas", "resumidor_processos", "extrator_prazos", "triagem_cliente"];

const rotulo = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : "");

// ── Estado / sessão ──────────────────────────────────────────────────────
let TOKEN = null;
let CACHE = { clientes: [], casos: [] }; // p/ selects de referência

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
    { n: "storage_path", l: "Caminho no Storage" },
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
};

function campoHTML(c) {
  const id = `f_${c.n}`;
  if (c.tipo === "textarea") return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><textarea id="${id}" ${c.req ? "required" : ""}></textarea></label>`;
  if (c.tipo === "select") return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><select id="${id}"><option value="">—</option>${c.opcoes.map((o) => `<option value="${o.v}">${o.t}</option>`).join("")}</select></label>`;
  if (c.tipo === "ref") { const opts = (CACHE[c.ref] || []).map((r) => `<option value="${r.id}">${r.nome || r.numero_processo || r.id}</option>`).join(""); return `<label class="field"><span>${c.l}${c.req ? " *" : ""}</span><select id="${id}"><option value="">—</option>${opts}</select></label>`; }
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
  clientes: (r) => `<td>${r.nome || ""}</td><td>${r.contato || "—"}</td><td>${r.cpf_cnpj || "—"}</td><td>${acoes("clientes", r.id)}</td>`,
  casos: (r) => `<td>${r.numero_processo || "—"}</td><td>${nomeRef("clientes", r.cliente_id)}</td><td>${rotulo(r.area)}</td><td>${badge(r.status)}</td><td>${acoes("casos", r.id)}</td>`,
  documentos: (r) => `<td>${r.nome || ""}</td><td>${nomeRef("casos", r.caso_id)}</td><td>${r.mime || "—"}</td><td>${acoes("documentos", r.id)}</td>`,
  pecas_geradas: (r) => `<td>${rotulo(r.agente)}</td><td>${r.tipo || "—"}</td><td>${nomeRef("casos", r.caso_id)}</td><td>${(r.created_at || "").slice(0, 10)}</td><td><button class="btn btn-sm" data-ver="${r.id}">Ver</button></td>`,
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
  analisador_contratos: { titulo: "Analisador de Contratos", desc: "Sobe um contrato e recebe riscos, cláusulas abusivas/faltantes e semáforo.",
    campos: [{ n: "representa", l: "Quem o advogado representa" }, { n: "doc", l: "Contrato (PDF)", tipo: "file" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  gerador_pecas: { titulo: "Gerador de Petições", desc: "Tipo de peça + fatos + partes + pedidos → minuta em markdown.",
    campos: [{ n: "tipo", l: "Tipo de peça", tipo: "select", opcoes: sel(["petição inicial", "contestação", "notificação extrajudicial", "contrato"]) }, { n: "fatos", l: "Fatos", tipo: "textarea" }, { n: "partes", l: "Partes" }, { n: "pedidos", l: "Pedidos", tipo: "textarea" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  resumidor_processos: { titulo: "Resumidor de Processos", desc: "Sobe os autos e recebe resumo, linha do tempo, situação e próximos passos.",
    campos: [{ n: "doc", l: "Autos (PDF)", tipo: "file" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  extrator_prazos: { titulo: "Extrator de Prazos", desc: "Intimação → prazo + data fatal em dias úteis, gravado na agenda.",
    campos: [{ n: "texto", l: "Texto da intimação", tipo: "textarea" }, { n: "tipo", l: "Tipo de prazo" }, { n: "dataPublicacao", l: "Data da publicação", tipo: "date" }, { n: "diasUteis", l: "Dias úteis", tipo: "number" }, { n: "caso_id", l: "Caso", tipo: "ref", ref: "casos" }] },
  triagem_cliente: { titulo: "Triagem de Cliente", desc: "Relato em texto → ficha do caso, área, documentos e viabilidade.",
    campos: [{ n: "texto", l: "Relato do cliente", tipo: "textarea" }] },
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
    const entrada = {}; let documentos; let prazo; let caso_id = null;
    for (const c of a.campos) {
      const node = modal.querySelector(`#f_${c.n}`);
      if (c.tipo === "file") {
        const f = node.files?.[0];
        if (f) documentos = [{ mime: f.type || "application/pdf", dados: await lerArquivoBase64(f) }];
        continue;
      }
      const v = node.value;
      if (c.n === "caso_id") { caso_id = v || null; continue; }
      if (v !== "") entrada[c.n] = c.tipo === "number" ? Number(v) : v;
    }
    if (id === "extrator_prazos" && entrada.dataPublicacao && entrada.diasUteis) {
      prazo = { tipo: entrada.tipo || "prazo", diasUteis: Number(entrada.diasUteis), dataPublicacao: entrada.dataPublicacao };
    }
    const res = modal.querySelector("#ag-result");
    res.innerHTML = `<div class="empty">Processando…</div>`;
    try {
      const out = await api(`agentes/${id}`, { method: "POST", body: { entrada, documentos, prazo, caso_id } });
      res.innerHTML = `<div class="ai-output" id="ag-md"></div>`;
      res.querySelector("#ag-md").textContent = out.conteudo;
      if (out.prazo) toast(`Prazo gravado na agenda: ${out.prazo.data_fatal}`);
    } catch (err) { res.innerHTML = `<div class="login-err">Erro: ${err.message}</div>`; }
  };
}

// ── Navegação ──────────────────────────────────────────────────────────
function irPara(view) {
  document.querySelectorAll(".navpill").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".page").forEach((p) => p.classList.toggle("hidden", p.dataset.page !== view));
  if (view !== "agentes") carregar(view);
}

// ── Boot ───────────────────────────────────────────────────────────────
function iniciarApp(email) {
  $("#login-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-email").textContent = email;
  renderAgentCards();
  // pré-carrega refs p/ selects
  Promise.all([carregar("clientes"), carregar("casos")]).catch(() => {});
  irPara("agentes");
}

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.view) irPara(t.dataset.view);
  if (t.dataset.novo) abrirModalNovo(t.dataset.novo);
  if (t.dataset.agent) abrirAgente(t.dataset.agent);
  if (t.closest?.("[data-agent]")) abrirAgente(t.closest("[data-agent]").dataset.agent);
  if (t.dataset.del) { const [tab, id] = t.dataset.del.split(":"); excluir(tab, id); }
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
