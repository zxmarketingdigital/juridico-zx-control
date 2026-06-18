// Camada de dados — client Supabase POR USUÁRIO (RLS aplica).
// O token validado é repassado no header Authorization, então a RLS do
// Supabase enxerga o usuário autenticado (spec §3/§7). Nunca usamos service
// key no caminho de request — o Worker não fura a RLS.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DbEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
}

export function dbDoUsuario(env: DbEnv, token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
