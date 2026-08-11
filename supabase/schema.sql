-- Script de setup do banco de dados Glisse AI no Supabase
-- Execute no SQL Editor do Supabase

-- 1. Habilitar extensão para busca full-text em português (opcional)
create extension if not exists unaccent;

-- 2. Criar a tabela principal de procedimentos
create table if not exists public.cbhpm_procedures (
  id          bigserial primary key,
  codigo      text not null,
  procedimento text not null,
  porte       text,
  valor_porte numeric(10, 2),
  uco         numeric(10, 4),
  valor_uco   numeric(10, 2),
  anestesia   text,
  versao      text not null default 'CBHPM 2023',
  observacao  text,
  created_at  timestamptz default now()
);

-- 3. Índices para performance nas buscas mais comuns
create index if not exists idx_cbhpm_codigo     on public.cbhpm_procedures (codigo);
create index if not exists idx_cbhpm_versao     on public.cbhpm_procedures (versao);
create index if not exists idx_cbhpm_procedimento
  on public.cbhpm_procedures using gin (to_tsvector('portuguese', procedimento));

-- 4. RLS (Row Level Security): permitir leitura pública, escrita apenas via service key
alter table public.cbhpm_procedures enable row level security;

create policy "Leitura pública"
  on public.cbhpm_procedures
  for select
  using (true);

-- 5. View auxiliar para listar versões disponíveis
create or replace view public.cbhpm_versions as
  select distinct versao
  from public.cbhpm_procedures
  order by versao;
