// Validação de entrada (zod) — schemas de criação por entidade (spec §6).
// Enums saem de src/schema.ts (um valor, um lugar).
import { z } from "zod";
import { AREAS, STATUS_CASO, STATUS_PRAZO, AGENTES, type Table } from "./schema";

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

export const VALIDADORES: Record<Table, z.ZodType> = {
  clientes: clienteCreate,
  casos: casoCreate,
  documentos: documentoCreate,
  prazos: prazoCreate,
  pecas_geradas: pecaCreate,
};
