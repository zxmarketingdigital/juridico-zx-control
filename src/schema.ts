// ════════════════════════════════════════════════════════════════════════
// Fonte única de verdade do schema — "um valor, um lugar" (CLAUDE.md / spec §2).
// Worker, painel, demo e setup importam DAQUI. Os CHECK da migration
// (supabase/migrations/0001_init.sql) espelham estas listas; tests/schema.test.ts
// quebra se SQL e código divergirem.
// ════════════════════════════════════════════════════════════════════════

/** Entidades com CRUD genérico no painel (spec §6 + Equipe + Growth/CRM). */
export const TABLES = [
  "clientes",
  "casos",
  "documentos",
  "prazos",
  "pecas_geradas",
  "advogados",
  "leads",
  "receitas",
  "custos",
  "pre_notas",
] as const;
export type Table = (typeof TABLES)[number];

/** Tabelas de apoio (não têm CRUD genérico; rotas dedicadas) — precisam de RLS. */
export const TABELAS_APOIO = ["advogado_clientes", "movimentacoes"] as const;

/** CRM — caminho do lead (em ordem; `convertido` migra para clientes). */
export const LEAD_STATUS = [
  "desqualificado",
  "recebeu_formulario",
  "respondeu_formulario",
  "reuniao_agendada",
  "convertido",
] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

/** Tipos de receita — MRR conta só `recorrente` (Growth). */
export const RECEITA_TIPO = ["recorrente", "unica"] as const;
export type ReceitaTipo = (typeof RECEITA_TIPO)[number];

/** Tipos de custo — CAC usa `anuncios` (Growth). */
export const CUSTO_TIPO = ["fixo_mensal", "unico", "anuncios"] as const;
export type CustoTipo = (typeof CUSTO_TIPO)[number];

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

/** Agentes — `pecas_geradas.agente` registra qual produziu o output (spec §4 + social). */
export const AGENTES = [
  "analisador_contratos",
  "gerador_pecas",
  "resumidor_processos",
  "extrator_prazos",
  "triagem_cliente",
  "roteirista_social",
] as const;
export type Agente = (typeof AGENTES)[number];

/** Formatos do Roteirista de Conteúdo (redes sociais). */
export const FORMATOS_SOCIAL = ["reel", "carrossel"] as const;
export type FormatoSocial = (typeof FORMATOS_SOCIAL)[number];

/** CTAs selecionáveis no roteiro (um valor, um lugar — painel e prompt usam). */
export const CTA_OPCOES = [
  "link do whatsapp na bio",
  "comente palavra do nicho",
  "compartilhe",
  "link na bio",
  "chame no direct",
  "salve este post",
] as const;
export type CtaOpcao = (typeof CTA_OPCOES)[number];

/** Janela (em dias) para destacar prazos "vencendo" na agenda (spec §6.4). */
export const PRAZO_ALERTA_DIAS = 5;
