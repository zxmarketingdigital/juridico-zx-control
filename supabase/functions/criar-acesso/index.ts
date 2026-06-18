// Edge Function `criar-acesso` — cria o login (Supabase Auth) de um membro da
// equipe. Roda com a service role NATIVA do Supabase (injetada no ambiente da
// Edge Function), então NENHUM segredo de admin precisa viver no Worker/painel.
//
// SEGURANÇA (fail-closed): só um ADVOGADO JÁ LOGADO pode criar acesso. NÃO basta
// o `verify_jwt` da plataforma — a anon key (pública, embarcada no painel) é um
// JWT válido e passaria nesse gate, deixando qualquer um criar logins com a
// service role. Por isso validamos o chamador AQUI, no código: o token recebido
// é resolvido para um usuário real; anon key / token inválido → usuário nulo →
// 401. Independe de config de plataforma e é seguro por instalação.
//
// Deploy: via MCP do Supabase (deploy_edge_function) ou
//   supabase functions deploy criar-acesso
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", ...cors } });
}

function senhaTemp(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return "Adv-" + Array.from(b, (x) => x.toString(36)).join("").slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gate fail-closed: valida que o chamador é um usuário logado de verdade.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "nao_autorizado" }, 401);
    const { data: chamador, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !chamador?.user) return json({ error: "nao_autorizado" }, 401);

    const { email } = await req.json();
    if (!email) return json({ error: "email_obrigatorio" }, 422);
    const senha = senhaTemp();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ email: data.user?.email ?? email, senha_temporaria: senha }, 201);
  } catch (_e) {
    return json({ error: "falha_interna" }, 500);
  }
});
