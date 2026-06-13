// ════════════════════════════════════════════════════════════════════════
// Fonte única de verdade do schema — "um valor, um lugar" (CLAUDE.md / spec §2).
// Worker, painel, demo e setup importam DAQUI. Os CHECK da migration
// (supabase/migrations/0001_init.sql) espelham estas listas; tests/schema.test.ts
// quebra se SQL e código divergirem.
// ════════════════════════════════════════════════════════════════════════

/** As 5 entidades do painel (spec §6). */
export const TABLES = [
  "clientes",
  "casos",
  "documentos",
  "prazos",
  "pecas_geradas",
] as const;
export type Table = (typeof TABLES)[number];

/** Áreas do direito de um caso (spec §6.2 / §8 — áreas variadas na demo). */
export const AREAS = [
  "trabalhista",
  "civel",
  "familia",
  "consumidor",
  "tributario",
  "empresarial",
  "penal",
  "previdenciario",
] as const;
export type Area = (typeof AREAS)[number];

/** Estados do ciclo de vida de um caso. */
export const STATUS_CASO = [
  "novo",
  "ativo",
  "suspenso",
  "encerrado",
  "arquivado",
] as const;
export type StatusCaso = (typeof STATUS_CASO)[number];

/** Estados de um prazo na agenda (spec §6.4). */
export const STATUS_PRAZO = ["pendente", "cumprido", "vencido"] as const;
export type StatusPrazo = (typeof STATUS_PRAZO)[number];

/** Os 5 agentes — `pecas_geradas.agente` registra qual produziu o output (spec §4). */
export const AGENTES = [
  "analisador_contratos",
  "gerador_pecas",
  "resumidor_processos",
  "extrator_prazos",
  "triagem_cliente",
] as const;
export type Agente = (typeof AGENTES)[number];

/** Janela (em dias) para destacar prazos "vencendo" na agenda (spec §6.4). */
export const PRAZO_ALERTA_DIAS = 5;
