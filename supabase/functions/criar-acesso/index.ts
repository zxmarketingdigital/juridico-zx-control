// Edge Function `criar-acesso` — cria o login (Supabase Auth) de um membro da
// equipe. Roda com a service role NATIVA do Supabase (injetada no ambiente da
// Edge Function), então NENHUM segredo de admin precisa viver no Worker/painel.
// verify_jwt=true: só chamadas com JWT válido (usuário logado) são aceitas.
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
    const { email } = await req.json();
    if (!email) return json({ error: "email_obrigatorio" }, 422);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
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
