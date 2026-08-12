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

-- 10. Feedback do usuário sobre respostas do chat (útil / não útil).
--     Ver docs/opportunity-mapping.md item 3.1 e src/app/api/feedback/route.js.
--     APLICAR MANUALMENTE no SQL Editor do Supabase (sem isso, o botão de
--     feedback na UI continua funcionando na interface, mas o registro falha
--     silenciosamente no backend até a tabela existir).
create table if not exists public.chat_feedback (
  id          bigserial primary key,
  message_id  text not null,
  query       text,
  rating      text not null check (rating in ('up', 'down')),
  created_at  timestamptz default now()
);

alter table public.chat_feedback enable row level security;

drop policy if exists "Escrita via service role" on public.chat_feedback;
create policy "Escrita via service role"
  on public.chat_feedback
  for insert
  with check (true);

-- 11. Log de buscas sem resultado, para priorizar expansão de cobertura de
--     capítulos com dado real de uso em vez de achismo.
--     Ver docs/opportunity-mapping.md item 1.4 e src/app/api/search/route.js.
--     APLICAR MANUALMENTE no SQL Editor do Supabase (best-effort: a busca
--     continua funcionando normalmente enquanto essa tabela não existir).
create table if not exists public.search_events (
  id             bigserial primary key,
  termo          text,
  versao         text,
  tipo           text,
  teve_resultado boolean not null default false,
  created_at     timestamptz default now()
);

alter table public.search_events enable row level security;

drop policy if exists "Escrita via service role" on public.search_events;
create policy "Escrita via service role"
  on public.search_events
  for insert
  with check (true);

-- 12. Busca semântica com embeddings open source (rodados localmente via
--     @huggingface/transformers, sem API externa — ver src/lib/embeddings.js
--     e scripts/cbhpm-import/11-generate-embeddings.mjs).
--     APLICAR MANUALMENTE no SQL Editor do Supabase. Depois de aplicar,
--     rodar `node scripts/cbhpm-import/11-generate-embeddings.mjs` para
--     popular a coluna embedding dos procedimentos já importados.
create extension if not exists vector;

alter table public.cbhpm_procedures
  add column if not exists embedding vector(384);

-- ivfflat funciona melhor depois que a tabela já tem dados; se a busca
-- vetorial ficar lenta após o backfill, rodar `analyze cbhpm_procedures;`
-- ou recriar o índice com um `lists` ajustado ao volume real de linhas.
create index if not exists idx_cbhpm_embedding
  on public.cbhpm_procedures
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC chamável via supabase-js (.rpc('match_cbhpm_procedures', {...})) —
-- REST/PostgREST não expõe operadores de distância vetorial diretamente.
create or replace function public.match_cbhpm_procedures(
  query_embedding vector(384),
  match_count int default 10,
  filter_versao text default null
)
returns setof public.cbhpm_procedures
language sql stable
as $$
  select *
  from public.cbhpm_procedures
  where embedding is not null
    and (filter_versao is null or versao = filter_versao)
  order by embedding <=> query_embedding
  limit match_count
$$;

-- 13. Campos específicos dos grupos de Radiologia/Medicina Nuclear do
--     Capítulo 4 (Métodos Diagnósticos por Imagem / Medicina Nuclear), que
--     não existem em nenhum capítulo já importado. Definições confirmadas
--     no próprio texto-fonte da CBHPM (seção "INSTRUÇÕES ESPECÍFICAS PARA
--     MEDICINA NUCLEAR" e nomes de procedimento auto-consistentes com a
--     contagem de incidências, ex: "RX – Crânio – 3 incidências" -> 3):
--       - custo_filme_doc: consumo de filmes radiográficos ou documentação
--         (grupos Radiologia e Medicina Nuclear)
--       - numero_incidencias: nº de incidências/tomadas radiográficas
--         (grupo Radiologia)
--       - unidade_radiofarmaco: "UR" (Unidade de Radiofármaco) — quase
--         sempre aparece como "*" na fonte, remetendo a uma tabela de
--         preços EXTERNA do Colégio Brasileiro de Radiologia, não a um
--         valor numérico presente neste documento. Guardado como texto para
--         preservar fielmente o que a fonte mostra (não inventar um número).
alter table public.cbhpm_procedures
  add column if not exists custo_filme_doc     numeric(10,4),
  add column if not exists numero_incidencias  smallint,
  add column if not exists unidade_radiofarmaco text;

-- 14. Busca tolerante a acento (ex: "dissecçao" também encontra
--     "Dissecção"). A busca full-text ('portuguese') e o ILIKE simples
--     comparam os bytes exatos e falham quando o usuário digita sem
--     acentuação — comum ao digitar rápido no celular. Usa a extensão
--     unaccent (já habilitada na seção 1). APLICAR MANUALMENTE no SQL
--     Editor do Supabase — enquanto não aplicada, /api/search cai de volta
--     no ILIKE simples anterior (best-effort, não quebra a busca).
create or replace function public.search_cbhpm_procedures_unaccent(
  search_term text,
  filter_versao text default null,
  match_count int default 10
)
returns setof public.cbhpm_procedures
language sql stable
as $$
  select *
  from public.cbhpm_procedures
  where (filter_versao is null or versao = filter_versao)
    and unaccent(procedimento) ilike '%' || unaccent(search_term) || '%'
  limit match_count
$$;
