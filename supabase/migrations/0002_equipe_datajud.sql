-- ════════════════════════════════════════════════════════════════════════
-- 0002 — Jurídico Otimizado: Equipe (advogados + vínculo a clientes) e DataJud
-- (movimentações dos processos). Aditiva sobre 0001. Mesmas regras: idempotente
-- (smoke-db aplica 2×), RLS em TODA tabela nova, política da linha
-- (1 instalação = 1 escritório → `to authenticated using (true)`).
-- A role `authenticated` já existe (criada em 0001 / Supabase).
-- ════════════════════════════════════════════════════════════════════════

-- ── Equipe: advogados do escritório ───────────────────────────────────────
create table if not exists advogados (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  oab         text,
  email       text,
  created_at  timestamptz not null default now()
);
alter table advogados enable row level security;
drop policy if exists advogados_escritorio_all on advogados;
create policy advogados_escritorio_all on advogados
  for all to authenticated using (true) with check (true);

-- ── Vínculo advogado ⇄ cliente (N:N) ──────────────────────────────────────
create table if not exists advogado_clientes (
  advogado_id uuid not null references advogados (id) on delete cascade,
  cliente_id  uuid not null references clientes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (advogado_id, cliente_id)
);
create index if not exists idx_adv_cli_cliente on advogado_clientes (cliente_id);
alter table advogado_clientes enable row level security;
drop policy if exists advogado_clientes_escritorio_all on advogado_clientes;
create policy advogado_clientes_escritorio_all on advogado_clientes
  for all to authenticated using (true) with check (true);

-- ── DataJud: movimentações/andamentos por caso (base do monitoramento) ─────
create table if not exists movimentacoes (
  id          uuid primary key default gen_random_uuid(),
  caso_id     uuid references casos (id) on delete cascade,
  data        date,
  codigo      integer,
  descricao   text not null,
  fonte       text not null default 'datajud',
  created_at  timestamptz not null default now()
);
create index if not exists idx_mov_caso on movimentacoes (caso_id);
create index if not exists idx_mov_data on movimentacoes (data);
alter table movimentacoes enable row level security;
drop policy if exists movimentacoes_escritorio_all on movimentacoes;
create policy movimentacoes_escritorio_all on movimentacoes
  for all to authenticated using (true) with check (true);
