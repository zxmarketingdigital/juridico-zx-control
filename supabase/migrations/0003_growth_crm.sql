-- ════════════════════════════════════════════════════════════════════════
-- 0003 — Jurídico Otimizado 2: módulo Growth + CRM.
-- leads (pipeline do CRM), receitas (MRR), custos (CAC/registro) e pre_notas.
-- Aditiva sobre 0001/0002. Idempotente (smoke-db 2×), RLS em TODA tabela nova,
-- política da linha (`to authenticated using (true)`).
-- ════════════════════════════════════════════════════════════════════════

-- ── CRM: leads e seu caminho até virar cliente ────────────────────────────
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  contato     text,
  origem      text,
  status      text not null default 'recebeu_formulario' check (status in (
                'desqualificado','recebeu_formulario','respondeu_formulario',
                'reuniao_agendada','convertido')),
  cliente_id  uuid references clientes (id) on delete set null,
  observacao  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_leads_status on leads (status);
alter table leads enable row level security;
drop policy if exists leads_escritorio_all on leads;
create policy leads_escritorio_all on leads
  for all to authenticated using (true) with check (true);

-- ── Growth: receitas (base do MRR) ────────────────────────────────────────
create table if not exists receitas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references clientes (id) on delete set null,
  descricao   text,
  valor       numeric(12,2) not null,
  tipo        text not null check (tipo in ('recorrente','unica')),
  data        date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_receitas_tipo on receitas (tipo);
alter table receitas enable row level security;
drop policy if exists receitas_escritorio_all on receitas;
create policy receitas_escritorio_all on receitas
  for all to authenticated using (true) with check (true);

-- ── Growth: custos (fixo mensal / único / anúncios → CAC) ─────────────────
create table if not exists custos (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  valor       numeric(12,2) not null,
  tipo        text not null check (tipo in ('fixo_mensal','unico','anuncios')),
  data        date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_custos_tipo on custos (tipo);
alter table custos enable row level security;
drop policy if exists custos_escritorio_all on custos;
create policy custos_escritorio_all on custos
  for all to authenticated using (true) with check (true);

-- ── Growth: pré-notas geradas (documento auxiliar, não-fiscal) ────────────
create table if not exists pre_notas (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid references clientes (id) on delete set null,
  numero            text,
  descricao_servico text not null,
  valor             numeric(12,2) not null,
  vencimento        date,
  conteudo          text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_pre_notas_cliente on pre_notas (cliente_id);
alter table pre_notas enable row level security;
drop policy if exists pre_notas_escritorio_all on pre_notas;
create policy pre_notas_escritorio_all on pre_notas
  for all to authenticated using (true) with check (true);
