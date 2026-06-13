import { describe, it, expect } from "vitest";
import worker from "../src/index";

const env = {
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
  GEMINI_API_KEY: "gemini-key",
};
const chamar = (path: string, method = "GET", headers: Record<string, string> = {}) =>
  worker.fetch(new Request(`https://worker${path}`, { method, headers }), env);

// Toda rota de dados; o gate roda ANTES de qualquer acesso (sem rede no 401).
const ROTAS: Array<[string, string]> = [
  ["/api/clientes", "GET"],
  ["/api/clientes", "POST"],
  ["/api/clientes/abc", "PATCH"],
  ["/api/clientes/abc", "DELETE"],
  ["/api/casos", "GET"],
  ["/api/casos", "POST"],
  ["/api/documentos", "GET"],
  ["/api/documentos", "POST"],
  ["/api/prazos", "GET"],
  ["/api/pecas_geradas", "GET"],
  ["/api/agenda", "GET"],
  ["/api/agentes/extrator_prazos", "POST"],
  ["/api/agentes/analisador_contratos", "POST"],
];

describe("fail-closed em TODA rota /api (spec §3 / bug CRITICAL do Corretor)", () => {
  for (const [path, method] of ROTAS) {
    it(`${method} ${path} sem token → 401`, async () => {
      const r = await chamar(path, method);
      expect(r.status).toBe(401);
    });

    it(`${method} ${path} com "Bearer " vazio → 401`, async () => {
      const r = await chamar(path, method, { Authorization: "Bearer " });
      expect(r.status).toBe(401);
    });
  }
});

describe("roteamento", () => {
  it("caminho fora de /api → 404 (nada exposto)", async () => {
    const r = await chamar("/", "GET");
    expect(r.status).toBe(404);
  });
  it("recurso /api desconhecido sem token → 401 (auth antes de tudo)", async () => {
    const r = await chamar("/api/inexistente", "GET");
    expect(r.status).toBe(401);
  });
});
