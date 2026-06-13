// ════════════════════════════════════════════════════════════════════════
// Auth middleware — FAIL-CLOSED (spec §3; invariante inquebrável da linha).
// TODA rota do Worker passa por aqui ANTES de tocar em dado. Token ausente,
// vazio ou inválido → 401, sempre. Foi o bug CRITICAL do Corretor (PR#2): o
// check existia em outra rota, não no caminho da rota nova. Aqui o gate é a
// porta única — `comAuth(handler)` envolve cada handler.
//
// LGPD (spec §7.4): nada de token nem dado de usuário em log nem no corpo de erro.
// ════════════════════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";

export interface Usuario {
  userId: string;
  /** Token validado — repassado ao Supabase para que a RLS aplique. */
  token: string;
}

/** Valida um token e devolve a identidade, ou null se inválido. */
export type Verificador = (token: string) => Promise<{ userId: string } | null>;

export interface AuthEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

function naoAutorizado(): Response {
  return new Response(JSON.stringify({ error: "nao_autorizado" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}

/** Extrai o token Bearer; retorna null se ausente, vazio ou esquema errado. */
function extrairToken(req: Request): string | null {
  const h = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/**
 * Gate de autenticação. Retorna o `Usuario` autenticado OU uma `Response` 401
 * (fail-closed). O chamador checa `instanceof Response` e curto-circuita.
 */
export async function autenticar(
  req: Request,
  verify: Verificador,
): Promise<Usuario | Response> {
  const token = extrairToken(req);
  if (!token) return naoAutorizado();
  const user = await verify(token);
  if (!user) return naoAutorizado();
  return { userId: user.userId, token };
}

/** Verificador real: valida o JWT do Supabase Auth (multi-usuário, spec §3). */
export function verificadorSupabase(env: AuthEnv): Verificador {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id };
  };
}

/**
 * Envolve um handler exigindo auth. Se não autenticado, responde 401 e o
 * handler NUNCA roda — o dado fica inacessível por padrão.
 */
export function comAuth(
  verify: Verificador,
  handler: (req: Request, user: Usuario) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    const r = await autenticar(req, verify);
    if (r instanceof Response) return r;
    return handler(req, r);
  };
}
