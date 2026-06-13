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
import { geminiProvider, type DocumentoInline } from "./ia";

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GEMINI_API_KEY: string;
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
  await db.from("pecas_geradas").insert({
    caso_id: corpo.caso_id ?? null,
    agente: idAgente,
    tipo: (corpo.entrada?.tipo as string) ?? null,
    conteudo,
    metadata: {},
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
