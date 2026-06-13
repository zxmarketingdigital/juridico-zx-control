// Entrypoint do Worker — PLACEHOLDER fail-closed.
//
// Nesta fatia (PR schema/RLS) ainda não há rotas: o produto começa pelo banco
// (supabase/migrations) e pelas constantes (src/schema.ts). Até o PR de núcleo
// (auth middleware + wrapper Gemini), o Worker não expõe NADA — toda requisição
// cai em 404. Assim o `wrangler dry-run` do CI passa sem abrir nenhuma rota sem
// auth (invariante da linha: nenhuma rota nasce sem o JWT no caminho dela).

export default {
  async fetch(): Promise<Response> {
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler;
