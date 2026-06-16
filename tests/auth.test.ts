import { describe, it, expect } from "vitest";
import { autenticar, type Verificador } from "../src/auth";

const req = (auth?: string) =>
  new Request("https://x/api/clientes", auth ? { headers: { Authorization: auth } } : {});

// Verificador falso: só aceita o token literal "valido".
const verify: Verificador = async (t) => (t === "valido" ? { userId: "u1" } : null);

const ehResposta = (r: unknown): r is Response => r instanceof Response;

describe("autenticar — fail-closed (spec §3 / bug CRITICAL do Corretor PR#2)", () => {
  it("sem header Authorization → 401", async () => {
    const r = await autenticar(req(), verify);
    expect(ehResposta(r) && r.status).toBe(401);
  });

  it('"Bearer " vazio → 401 (nunca aceitar token vazio)', async () => {
    const r = await autenticar(req("Bearer "), verify);
    expect(ehResposta(r) && r.status).toBe(401);
  });

  it('"Bearer    " só com espaços → 401', async () => {
    const r = await autenticar(req("Bearer    "), verify);
    expect(ehResposta(r) && r.status).toBe(401);
  });

  it("token presente mas inválido → 401", async () => {
    const r = await autenticar(req("Bearer falso"), verify);
    expect(ehResposta(r) && r.status).toBe(401);
  });

  it("esquema não-Bearer → 401", async () => {
    const r = await autenticar(req("Basic dXNlcjpwYXNz"), verify);
    expect(ehResposta(r) && r.status).toBe(401);
  });

  it("token válido → retorna o usuário (não é Response)", async () => {
    const r = await autenticar(req("Bearer valido"), verify);
    expect(ehResposta(r)).toBe(false);
    expect((r as { userId: string }).userId).toBe("u1");
  });

  it("401 não vaza corpo com dado sensível (LGPD §7.4)", async () => {
    const r = (await autenticar(req("Bearer falso"), verify)) as Response;
    const body = await r.text();
    expect(body).not.toContain("falso");
  });
});
