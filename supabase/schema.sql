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

drop policy if exists "Leitura pública" on public.cbhpm_procedures;
create policy "Leitura pública"
  on public.cbhpm_procedures
  for select
  using (true);

-- 5. View auxiliar para listar versões disponíveis
create or replace view public.cbhpm_versions as
  select distinct versao
  from public.cbhpm_procedures
  order by versao;

-- 6. Campos adicionais para dados reais de auxiliares/anestesia/custo operacional
--    (ver scripts/cbhpm-import/ para o pipeline que popula esses campos a partir
--    dos PDFs oficiais da CBHPM). Semântica: null = não se aplica (procedimento
--    fora do Capítulo 3, sem esse conceito); valor numérico = dado real da tabela.
alter table public.cbhpm_procedures
  add column if not exists capitulo           text,
  add column if not exists numero_auxiliares  smallint,
  add column if not exists porte_anestesico   smallint,
  add column if not exists custo_operacional  numeric(10,2),
  add column if not exists valor_versao       text;

alter table public.cbhpm_procedures
  drop constraint if exists uq_cbhpm_codigo_versao;
alter table public.cbhpm_procedures
  add constraint uq_cbhpm_codigo_versao unique (codigo, versao);

-- 7. Tabela de metadados por vigência de valores de porte (desacoplada da
--    estrutura de procedimentos, que muda em calendário diferente)
create table if not exists public.cbhpm_versoes (
  versao          text primary key,
  vigencia_inicio date,
  vigencia_fim    date,
  valor_uco       numeric(10,2) not null,
  fonte_arquivo   text,
  created_at      timestamptz default now()
);

-- 8. Tabela de valores de porte (código de porte -> R$), versionada por vigência
create table if not exists public.cbhpm_porte_valores (
  id           bigserial primary key,
  versao       text not null references public.cbhpm_versoes(versao),
  codigo_porte text not null,
  valor        numeric(10,2) not null,
  unique (versao, codigo_porte)
);

alter table public.cbhpm_versoes enable row level security;
alter table public.cbhpm_porte_valores enable row level security;

drop policy if exists "Leitura pública" on public.cbhpm_versoes;
create policy "Leitura pública"
  on public.cbhpm_versoes
  for select
  using (true);

drop policy if exists "Leitura pública" on public.cbhpm_porte_valores;
create policy "Leitura pública"
  on public.cbhpm_porte_valores
  for select
  using (true);

-- 9. Percentual de rateio de auxiliares por edição (muda entre edições: 3ª a
--    2016 usam 30/20/20/20, a 2018 usa 60/40/30/30). Denormalizado também em
--    cbhpm_procedures (calculado no import) porque /api/search e /api/chat
--    não fazem join com cbhpm_versoes.
alter table public.cbhpm_versoes add column if not exists aux_pct jsonb;
alter table public.cbhpm_procedures add column if not exists aux_pct jsonb;
