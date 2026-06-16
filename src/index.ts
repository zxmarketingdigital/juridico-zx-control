// ════════════════════════════════════════════════════════════════════════
// Worker — router da API. INVARIANTE: toda rota /api/* passa pelo gate
// fail-closed ANTES de tocar em dado (spec §3). Sem token válido → 401.
// CRUD das 5 entidades (RLS aplica via token do usuário), agenda de prazos
// e os 5 agentes (output sempre com disclaimer; nada de jurisprudência).
// LGPD: nenhum dado de cliente/caso vai a log (spec §7.4) — não há console.log.
// ════════════════════════════════════════════════════════════════════════

import { autenticar, verificadorSupabase, type Usuario } from "./auth";
import { dbDoUsuario } from "./db";
import { VALIDADORES } from "./validacao";
import { TABLES, type Table } from "./schema";
import {
  AGENTE_DEFS,
  montarPrazo,
  classificarPrazo,
  type ExtracaoPrazo,
} from "./agentes";
import { geminiProvider, comDisclaimer, type DocumentoInline } from "./ia";
import { consultarProcesso, type ProcessoDataJud } from "./datajud";
import { calcularGrowth, gerarPreNota } from "./growth";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GEMINI_API_KEY: string;
  /** Opcional: sobrescreve a chave pública do DataJud. */
  DATAJUD_API_KEY?: string;
}

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const erro = (msg: string, status: number): Response => json({ error: msg }, status);

function ehTabela(t: string): t is Table {
  return (TABLES as readonly string[]).includes(t);
}

/** Data de hoje em America/Sao_Paulo, formato 'YYYY-MM-DD' (nunca UTC). */
function hojeSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const partes = url.pathname.replace(/^\/+|\/+$/g, "").split("/");

    // Rotas não-API: nada exposto (placeholder fail-closed).
    if (partes[0] !== "api") return erro("not_found", 404);

    // ── Gate de autenticação — antes de QUALQUER acesso a dado. ──
    const auth = await autenticar(req, verificadorSupabase(env));
    if (auth instanceof Response) return auth;
    const user = auth;

    try {
      const recurso = partes[1] ?? "";

      if (recurso === "agenda" && req.method === "GET") {
        return await getAgenda(env, user);
      }

      if (recurso === "agentes" && req.method === "POST") {
        return await postAgente(partes[2] ?? "", req, env, user);
      }

      if (recurso === "datajud" && req.method === "POST") {
        return await postDataJud(req, env, user);
      }

      // Vínculo advogado ⇄ cliente: /api/clientes/:id/advogados[/:advId]
      if (recurso === "clientes" && partes[2] && partes[3] === "advogados") {
        return await vinculos(partes[2], partes[4], req, env, user);
      }

      // Criar acesso (login) de membro da equipe: /api/advogados/:id/acesso
      if (recurso === "advogados" && partes[2] && partes[3] === "acesso" && req.method === "POST") {
        return await criarAcesso(partes[2], env, user);
      }

      // Growth / CRM
      if (recurso === "growth" && req.method === "GET") {
        return await getGrowth(env, user);
      }
      if (recurso === "leads" && partes[2] && partes[3] === "converter" && req.method === "POST") {
        return await converterLead(partes[2], env, user);
      }
      if (recurso === "pre_notas" && partes[2] === "gerar" && req.method === "POST") {
        return await gerarPreNotaRoute(req, env, user);
      }

      if (ehTabela(recurso)) {
        const id = partes[2];
        return await crud(recurso, id, req, env, user);
      }

      return erro("not_found", 404);
    } catch {
      // Sem detalhe sensível no corpo (LGPD).
      return erro("erro_interno", 500);
    }
  },
} satisfies ExportedHandler<Env>;

// ── CRUD genérico ───────────────────────────────────────────────────────

async function crud(
  tabela: Table,
  id: string | undefined,
  req: Request,
  env: Env,
  user: Usuario,
): Promise<Response> {
  const db = dbDoUsuario(env, user.token);

  switch (req.method) {
    case "GET": {
      const { data, error } = await db
        .from(tabela)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return erro("falha_consulta", 400);
      return json(data ?? []);
    }
    case "POST": {
      const body = await req.json().catch(() => null);
      const parsed = VALIDADORES[tabela].safeParse(body);
      if (!parsed.success) return erro("entrada_invalida", 422);
      const { data, error } = await db
        .from(tabela)
        .insert(parsed.data as Record<string, unknown>)
        .select()
        .single();
      if (error) return erro("falha_insercao", 400);
      return json(data, 201);
    }
    case "PATCH": {
      if (!id) return erro("id_obrigatorio", 400);
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") return erro("entrada_invalida", 422);
      const { data, error } = await db.from(tabela).update(body).eq("id", id).select().single();
      if (error) return erro("falha_atualizacao", 400);
      return json(data);
    }
    case "DELETE": {
      if (!id) return erro("id_obrigatorio", 400);
      const { error } = await db.from(tabela).delete().eq("id", id);
      if (error) return erro("falha_remocao", 400);
      return json({ ok: true });
    }
    default:
      return erro("metodo_nao_permitido", 405);
  }
}

// ── Agenda de prazos (spec §6.4) ──────────────────────────────────────────

async function getAgenda(env: Env, user: Usuario): Promise<Response> {
  const db = dbDoUsuario(env, user.token);
  const { data, error } = await db
    .from("prazos")
    .select("*")
    .order("data_fatal", { ascending: true });
  if (error) return erro("falha_consulta", 400);
  const hoje = hojeSaoPaulo();
  const itens = (data ?? []).map((p) => ({
    ...p,
    classe: classificarPrazo(p as { status: never; data_fatal: string }, hoje),
  }));
  return json(itens);
}

// ── Agentes (spec §4) ─────────────────────────────────────────────────────

interface CorpoAgente {
  entrada?: Record<string, unknown>;
  documentos?: DocumentoInline[];
  caso_id?: string | null;
  prazo?: ExtracaoPrazo; // extrator: tipo + diasUteis + dataPublicacao
  /** Triagem: vincular a um cliente ou lead já cadastrado. */
  vinculo?: { tipo: "cliente" | "lead"; id: string };
}

async function postAgente(
  idAgente: string,
  req: Request,
  env: Env,
  user: Usuario,
): Promise<Response> {
  if (!(idAgente in AGENTE_DEFS)) return erro("agente_desconhecido", 404);
  const def = AGENTE_DEFS[idAgente as keyof typeof AGENTE_DEFS];

  const corpo = (await req.json().catch(() => null)) as CorpoAgente | null;
  if (!corpo) return erro("entrada_invalida", 422);

  const ia = geminiProvider(env);
  const conteudo = await ia.gerar({
    prompt: def.prompt(corpo.entrada ?? {}),
    documentos: corpo.documentos,
  });

  const db = dbDoUsuario(env, user.token);

  // Histórico do output (toda peça gerada é gravada, nunca só na tela — §5).
  // Triagem pode vincular a um cliente/lead já cadastrado (guardado em metadata).
  const metadata = corpo.vinculo ? { vinculo: corpo.vinculo } : {};
  await db.from("pecas_geradas").insert({
    caso_id: corpo.caso_id ?? null,
    agente: idAgente,
    tipo: (corpo.entrada?.tipo as string) ?? (corpo.entrada?.formato as string) ?? null,
    conteudo,
    metadata,
  });

  // Extrator: grava o prazo na agenda (caminho grava-vs-lê).
  let prazoGravado = null;
  if (idAgente === "extrator_prazos" && corpo.prazo) {
    const row = montarPrazo(corpo.prazo, corpo.caso_id ?? null);
    const { data } = await db.from("prazos").insert(row).select().single();
    prazoGravado = data ?? row;
  }

  return json({ conteudo, prazo: prazoGravado }, 201);
}

// ── DataJud (CNJ): confirma processo, capa + andamentos, salva e resume ────

interface CorpoDataJud {
  numero?: string;
  caso_id?: string | null;
  salvar?: boolean; // persiste os movimentos em `movimentacoes`
  resumir?: boolean; // roda o Resumidor sobre os andamentos
}

function textoDoProcesso(p: ProcessoDataJud): string {
  const c = p.capa;
  const cab = c
    ? `Classe: ${c.classe ?? "-"}\nAssuntos: ${c.assuntos.join("; ") || "-"}\nÓrgão: ${c.orgaoJulgador ?? "-"}\nTribunal/Grau: ${c.tribunal ?? "-"}/${c.grau ?? "-"}`
    : "";
  const movs = p.movimentos
    .slice(0, 40)
    .map((m) => `- ${(m.data ?? "").slice(0, 10)} ${m.descricao}`)
    .join("\n");
  return `${cab}\n\nAndamentos (mais recentes):\n${movs}`;
}

async function postDataJud(req: Request, env: Env, user: Usuario): Promise<Response> {
  const corpo = (await req.json().catch(() => null)) as CorpoDataJud | null;
  if (!corpo?.numero) return erro("numero_obrigatorio", 422);

  let processo: ProcessoDataJud;
  try {
    processo = await consultarProcesso(corpo.numero, env);
  } catch {
    return erro("datajud_indisponivel", 502);
  }
  if (!processo.existe) return json({ existe: false, numero: processo.numero }, 200);

  const db = dbDoUsuario(env, user.token);
  let salvos = 0;
  let resumo: string | null = null;

  // Persiste os andamentos como snapshot do caso (base do monitoramento).
  if (corpo.salvar && corpo.caso_id) {
    await db.from("movimentacoes").delete().eq("caso_id", corpo.caso_id).eq("fonte", "datajud");
    const linhas = processo.movimentos.map((m) => ({
      caso_id: corpo.caso_id,
      data: m.data ? m.data.slice(0, 10) : null,
      codigo: m.codigo,
      descricao: m.descricao,
      fonte: "datajud",
    }));
    if (linhas.length) {
      const { error } = await db.from("movimentacoes").insert(linhas);
      if (!error) salvos = linhas.length;
    }
  }

  // Alimenta o Resumidor com a capa + andamentos (output com disclaimer).
  if (corpo.resumir) {
    const ia = geminiProvider(env);
    resumo = await ia.gerar({
      prompt:
        "Com base na capa e nos andamentos abaixo, produza em markdown: resumo executivo, " +
        "linha do tempo, situação atual e próximos passos. Não cite jurisprudência.\n\n" +
        textoDoProcesso(processo),
    });
    await db.from("pecas_geradas").insert({
      caso_id: corpo.caso_id ?? null,
      agente: "resumidor_processos",
      tipo: "Resumo DataJud",
      conteudo: resumo,
      metadata: { fonte: "datajud", numero: processo.numero },
    });
  }

  return json({ ...processo, salvos, resumo }, 200);
}

// ── Vínculo advogado ⇄ cliente (N:N) ──────────────────────────────────────

async function vinculos(
  clienteId: string,
  advId: string | undefined,
  req: Request,
  env: Env,
  user: Usuario,
): Promise<Response> {
  const db = dbDoUsuario(env, user.token);

  if (req.method === "GET") {
    const { data, error } = await db
      .from("advogado_clientes")
      .select("advogados(id,nome,oab,email)")
      .eq("cliente_id", clienteId);
    if (error) return erro("falha_consulta", 400);
    const advs = (data ?? []).map((r) => (r as { advogados: unknown }).advogados).filter(Boolean);
    return json(advs);
  }
  if (req.method === "POST") {
    const body = (await req.json().catch(() => null)) as { advogado_id?: string } | null;
    if (!body?.advogado_id) return erro("advogado_id_obrigatorio", 422);
    const { error } = await db
      .from("advogado_clientes")
      .upsert({ cliente_id: clienteId, advogado_id: body.advogado_id });
    if (error) return erro("falha_vinculo", 400);
    return json({ ok: true }, 201);
  }
  if (req.method === "DELETE") {
    if (!advId) return erro("advogado_id_obrigatorio", 400);
    const { error } = await db
      .from("advogado_clientes")
      .delete()
      .eq("cliente_id", clienteId)
      .eq("advogado_id", advId);
    if (error) return erro("falha_desvinculo", 400);
    return json({ ok: true });
  }
  return erro("metodo_nao_permitido", 405);
}

// ── Growth: métricas (MRR, custos, CAC) ───────────────────────────────────

async function getGrowth(env: Env, user: Usuario): Promise<Response> {
  const db = dbDoUsuario(env, user.token);
  const [rec, cus, leadsConv] = await Promise.all([
    db.from("receitas").select("valor,tipo"),
    db.from("custos").select("valor,tipo"),
    db.from("leads").select("id").eq("status", "convertido"),
  ]);
  if (rec.error || cus.error || leadsConv.error) return erro("falha_consulta", 400);
  const growth = calcularGrowth({
    receitas: (rec.data ?? []) as { valor: number; tipo: string }[],
    custos: (cus.data ?? []) as { valor: number; tipo: string }[],
    clientesConvertidos: (leadsConv.data ?? []).length,
  });
  return json(growth);
}

// ── CRM: converter lead em cliente (migra do "lead" para "cliente") ────────

async function converterLead(leadId: string, env: Env, user: Usuario): Promise<Response> {
  const db = dbDoUsuario(env, user.token);
  const { data: lead, error: e1 } = await db.from("leads").select("*").eq("id", leadId).single();
  if (e1 || !lead) return erro("lead_nao_encontrado", 404);
  if (lead.cliente_id) return erro("lead_ja_convertido", 409);

  const { data: cliente, error: e2 } = await db
    .from("clientes")
    .insert({ nome: lead.nome, contato: lead.contato ?? null })
    .select()
    .single();
  if (e2 || !cliente) return erro("falha_conversao", 400);

  await db.from("leads").update({ status: "convertido", cliente_id: cliente.id }).eq("id", leadId);
  return json({ cliente, lead_id: leadId }, 201);
}

// ── Growth: gerador de pré-nota (documento auxiliar, não-fiscal) ──────────

interface CorpoPreNota {
  cliente_id?: string | null;
  clienteNome?: string;
  numero?: string;
  descricao_servico?: string;
  valor?: number;
  vencimento?: string;
}

async function gerarPreNotaRoute(req: Request, env: Env, user: Usuario): Promise<Response> {
  const corpo = (await req.json().catch(() => null)) as CorpoPreNota | null;
  if (!corpo?.descricao_servico || typeof corpo.valor !== "number") {
    return erro("entrada_invalida", 422);
  }
  const db = dbDoUsuario(env, user.token);

  let clienteNome = corpo.clienteNome ?? "Cliente";
  if (corpo.cliente_id) {
    const { data } = await db.from("clientes").select("nome").eq("id", corpo.cliente_id).single();
    if (data?.nome) clienteNome = data.nome;
  }
  const numero = corpo.numero || `PN-${hojeSaoPaulo()}`;
  const conteudo = gerarPreNota({
    numero,
    clienteNome,
    descricaoServico: corpo.descricao_servico,
    valor: corpo.valor,
    vencimento: corpo.vencimento,
  });
  const { data, error } = await db
    .from("pre_notas")
    .insert({
      cliente_id: corpo.cliente_id ?? null,
      numero,
      descricao_servico: corpo.descricao_servico,
      valor: corpo.valor,
      vencimento: corpo.vencimento ?? null,
      conteudo,
    })
    .select()
    .single();
  if (error) return erro("falha_insercao", 400);
  return json({ ...data, conteudo }, 201);
}

// ── Criar acesso (login) de um membro da equipe ────────────────────────────
// Delega à Edge Function `criar-acesso`, que roda com a service role NATIVA do
// Supabase (nenhum segredo de admin vive no Worker). A Edge Function valida o
// JWT do usuário (verify_jwt) — só quem está logado cria acesso.
async function criarAcesso(advId: string, env: Env, user: Usuario): Promise<Response> {
  const db = dbDoUsuario(env, user.token);
  const { data: adv } = await db.from("advogados").select("email,nome").eq("id", advId).single();
  const email = (adv as { email?: string } | null)?.email;
  if (!email) return erro("advogado_sem_email", 422);

  const resp = await fetch(`${env.SUPABASE_URL}/functions/v1/criar-acesso`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${user.token}`,
      apikey: env.SUPABASE_ANON_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  const out = (await resp.json().catch(() => ({}))) as { error?: string; senha_temporaria?: string };
  if (!resp.ok) {
    const jaExiste = (out.error ?? "").toLowerCase().match(/already|registered|exist/);
    return erro(jaExiste ? "acesso_ja_existe" : "falha_criar_acesso", 400);
  }
  // Senha temporária retornada UMA vez para o admin repassar (LGPD: não logamos).
  return json({ email, senha_temporaria: out.senha_temporaria }, 201);
}
