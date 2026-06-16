// Validação de entrada (zod) — schemas de criação por entidade (spec §6).
// Enums saem de src/schema.ts (um valor, um lugar).
import { z } from "zod";
import { AREAS, STATUS_CASO, STATUS_PRAZO, AGENTES, LEAD_STATUS, RECEITA_TIPO, CUSTO_TIPO, type Table } from "./schema";

export const clienteCreate = z.object({
  nome: z.string().min(1),
  contato: z.string().optional(),
  cpf_cnpj: z.string().optional(),
});

export const casoCreate = z.object({
  cliente_id: z.uuid(),
  numero_processo: z.string().optional(),
  area: z.enum(AREAS),
  status: z.enum(STATUS_CASO).optional(),
});

export const documentoCreate = z.object({
  caso_id: z.uuid(),
  nome: z.string().min(1),
  storage_path: z.string().optional(),
  mime: z.string().optional(),
});

export const prazoCreate = z.object({
  caso_id: z.uuid().nullable().optional(),
  tipo: z.string().optional(),
  data_publicacao: z.string().optional(),
  data_fatal: z.string().min(1),
  dias: z.number().int().optional(),
  status: z.enum(STATUS_PRAZO).optional(),
});

export const pecaCreate = z.object({
  caso_id: z.uuid().nullable().optional(),
  agente: z.enum(AGENTES),
  tipo: z.string().optional(),
  conteudo: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const advogadoCreate = z.object({
  nome: z.string().min(1),
  oab: z.string().optional(),
  email: z.email().optional(),
});

export const leadCreate = z.object({
  nome: z.string().min(1),
  contato: z.string().optional(),
  origem: z.string().optional(),
  status: z.enum(LEAD_STATUS).optional(),
  observacao: z.string().optional(),
});

export const receitaCreate = z.object({
  cliente_id: z.uuid().nullable().optional(),
  descricao: z.string().optional(),
  valor: z.number(),
  tipo: z.enum(RECEITA_TIPO),
  data: z.string().optional(),
});

export const custoCreate = z.object({
  descricao: z.string().min(1),
  valor: z.number(),
  tipo: z.enum(CUSTO_TIPO),
  data: z.string().optional(),
});

export const preNotaCreate = z.object({
  cliente_id: z.uuid().nullable().optional(),
  numero: z.string().optional(),
  descricao_servico: z.string().min(1),
  valor: z.number(),
  vencimento: z.string().optional(),
  conteudo: z.string().optional(),
});

export const VALIDADORES: Record<Table, z.ZodType> = {
  clientes: clienteCreate,
  casos: casoCreate,
  documentos: documentoCreate,
  prazos: prazoCreate,
  pecas_geradas: pecaCreate,
  advogados: advogadoCreate,
  leads: leadCreate,
  receitas: receitaCreate,
  custos: custoCreate,
  pre_notas: preNotaCreate,
};
