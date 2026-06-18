-- ════════════════════════════════════════════════════════════════════════
-- 0001_init — schema base do Jurídico ZX Control (spec §6) + RLS + Storage.
--
-- Invariantes desta migration (CLAUDE.md / spec §2, §7):
--  • RLS habilitado em TODA tabela (o job smoke-db do CI reprova sem isso).
--  • Idempotente: o smoke-db aplica 2× com ON_ERROR_STOP=1 — tudo é
--    `if not exists` / `drop ... if exists` / `on conflict do nothing`.
--  • Roda no Postgres PURO do CI (sem Supabase): o shim de auth e o bucket de
--    Storage só são criados sob guarda de existência, e o shim NUNCA
--    sobrescreve o `auth.*` real do Supabase em produção.
--  • Modelo da linha: 1 instalação = 1 escritório. Todos os advogados logados
--    compartilham os dados (spec §3) → policy `to authenticated using (true)`.
--  • Os valores dos CHECK espelham src/schema.ts (tests/schema.test.ts trava o drift).
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Compat com o Postgres puro do CI ──────────────────────────────────────
-- No Supabase o schema `auth` e a role `authenticated` já existem; aqui só
-- garantimos que existam pra que as policies `to authenticated` apliquem no CI.
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

-- ── 1. clientes (spec §6.1) ───────────────────────────────────────────────
create table if not exists clientes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  contato     text,
  cpf_cnpj    text,
  created_at  timestamptz not null default now()
);
alter table clientes enable row level security;
drop policy if exists clientes_escritorio_all on clientes;
create policy clientes_escritorio_all on clientes
  for all to authenticated using (true) with check (true);

-- ── 2. casos (spec §6.2) ──────────────────────────────────────────────────
create table if not exists casos (
  id              uuid primary key default gen_random_uuid(),
  cliente_id      uuid not null references clientes (id) on delete cascade,
  numero_processo text,
  area            text not null check (area in (
                    'trabalhista','civel','familia','consumidor',
                    'tributario','empresarial','penal','previdenciario')),
  status          text not null default 'novo' check (status in (
                    'novo','ativo','suspenso','encerrado','arquivado')),
  created_at      timestamptz not null default now()
);
create index if not exists idx_casos_cliente on casos (cliente_id);
alter table casos enable row level security;
drop policy if exists casos_escritorio_all on casos;
create policy casos_escritorio_all on casos
  for all to authenticated using (true) with check (true);

-- ── 3. documentos (spec §6.3 / §5 — original no Storage, vinculado ao caso) ─
create table if not exists documentos (
  id           uuid primary key default gen_random_uuid(),
  caso_id      uuid not null references casos (id) on delete cascade,
  nome         text not null,
  storage_path text,
  mime         text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_documentos_caso on documentos (caso_id);
alter table documentos enable row level security;
drop policy if exists documentos_escritorio_all on documentos;
create policy documentos_escritorio_all on documentos
  for all to authenticated using (true) with check (true);

-- ── 4. prazos — agenda (spec §6.4) ────────────────────────────────────────
create table if not exists prazos (
  id               uuid primary key default gen_random_uuid(),
  caso_id          uuid references casos (id) on delete set null,
  tipo             text,
  data_publicacao  date,
  data_fatal       date not null,
  dias             integer,
  status           text not null default 'pendente'
                     check (status in ('pendente','cumprido','vencido')),
  created_at       timestamptz not null default now()
);
create index if not exists idx_prazos_caso on prazos (caso_id);
create index if not exists idx_prazos_data_fatal on prazos (data_fatal);
alter table prazos enable row level security;
drop policy if exists prazos_escritorio_all on prazos;
create policy prazos_escritorio_all on prazos
  for all to authenticated using (true) with check (true);

-- ── 5. pecas_geradas — histórico dos outputs dos agentes (spec §6.5) ───────
create table if not exists pecas_geradas (
  id          uuid primary key default gen_random_uuid(),
  caso_id     uuid references casos (id) on delete set null,
  agente      text not null check (agente in (
                'analisador_contratos','gerador_pecas','resumidor_processos',
                'extrator_prazos','triagem_cliente','roteirista_social')),
  tipo        text,
  conteudo    text not null,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pecas_caso on pecas_geradas (caso_id);
alter table pecas_geradas enable row level security;
drop policy if exists pecas_geradas_escritorio_all on pecas_geradas;
create policy pecas_geradas_escritorio_all on pecas_geradas
  for all to authenticated using (true) with check (true);

-- ── Storage: bucket privado dos documentos (spec §5) ──────────────────────
-- Só roda no Supabase (onde o schema `storage` existe). No Postgres puro do CI
-- o bloco é pulado, mantendo o smoke-db verde.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public)
      values ('documentos', 'documentos', false)
      on conflict (id) do nothing;

    execute $p$drop policy if exists documentos_storage_escritorio on storage.objects$p$;
    execute $p$create policy documentos_storage_escritorio on storage.objects
      for all to authenticated
      using (bucket_id = 'documentos') with check (bucket_id = 'documentos')$p$;
  end if;
end $$;
