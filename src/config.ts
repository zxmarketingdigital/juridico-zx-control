// ════════════════════════════════════════════════════════════════════════
// Configuração da linha — "um valor, um lugar" (CLAUDE.md / spec §2).
// Model id, provider de IA, fuso e feriados ficam SÓ aqui. Worker, agentes,
// setup e painel importam destas constantes; nunca repita um literal.
// ════════════════════════════════════════════════════════════════════════

/** Fuso de contagem de prazos — NUNCA UTC, NUNCA data corrida (spec §7.3). */
export const TIMEZONE = "America/Sao_Paulo";

// ── IA: Gemini Flash é o default; provider trocável pelo aluno (spec §2) ──
export const IA_PROVIDER_DEFAULT = "gemini";
export const GEMINI_MODEL = "gemini-2.0-flash";
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
/** Retry/timeout do wrapper de IA. */
export const IA_TIMEOUT_MS = 60_000;
export const IA_MAX_RETRIES = 2;

// ── Feriados nacionais (Lei 662/49, 6.802/80, 14.759/23) ──────────────────
// Fixos no formato MM-DD. Inclui 20/11 (Consciência Negra, nacional desde 2024).
export const FERIADOS_FIXOS = [
  "01-01", // Confraternização Universal
  "04-21", // Tiradentes
  "05-01", // Dia do Trabalho
  "09-07", // Independência
  "10-12", // Nossa Senhora Aparecida
  "11-02", // Finados
  "11-15", // Proclamação da República
  "11-20", // Consciência Negra
  "12-25", // Natal
] as const;
