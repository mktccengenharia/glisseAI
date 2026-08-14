// Rota de API: /api/versions
// Retorna as versões disponíveis da CBHPM no banco de dados

import { createClient } from '@supabase/supabase-js'

// Ordem cronológica real das edições. O `.sort()` alfabético anterior colocava
// "CBHPM 3ª edição" (vigência 2003, a MAIS ANTIGA) depois de "CBHPM 2018",
// pela ordem léxica da string — o faturista lia o topo da lista como a edição
// mais nova e podia selecionar a errada, que produz cobrança errada.
//
// Mapeamento ESTÁTICO de propósito, não uma consulta a
// `cbhpm_versoes.vigencia_inicio`: essa coluna só é gravada de forma confiável
// para a edição 2018 (scripts/cbhpm-import/05-import-to-supabase.mjs), enquanto
// o import das outras 6 (08-import-multi.mjs) faz upsert sem ela. Ordenar por
// ela deixaria 6 de 7 edições com vigência nula. Esta rota também não consulta
// `cbhpm_versoes` — lê a view `public.cbhpm_versions` (supabase/schema.sql,
// seção 5), então não há join a ajustar.
//
// Os anos vêm do campo `vigencia` de scripts/cbhpm-import/config/editions.mjs
// (3ed=2003, 2008, 2010, 2014, 2015-2016 para 2015 e 2016), mais o rótulo fixo
// "CBHPM 2018", que não está naquele arquivo por já ter sido importado antes.
// As edições 2015 e 2016 compartilham a mesma `vigencia` ('2015-2016') porque
// esse campo é a vigência dos VALORES de porte, não o ano da edição; a ordem
// entre as duas vem do ano da própria edição, que é inequívoco.
export const EDITION_CHRONOLOGICAL_ORDER = {
  'CBHPM 3ª edição': 2003,
  'CBHPM 2008': 2008,
  'CBHPM 2010': 2010,
  'CBHPM 2014': 2014,
  'CBHPM 2015': 2015,
  'CBHPM 2016': 2016,
  'CBHPM 2018': 2018,
}

// Mais antiga primeiro. Rótulo desconhecido (edição nova importada antes de
// este mapa ser atualizado) vai para o fim, em ordem alfabética estável, em vez
// de sumir ou cair numa posição arbitrária no meio.
export function sortVersionsChronologically(versions) {
  return [...(versions || [])].sort((a, b) => {
    const ordemA = EDITION_CHRONOLOGICAL_ORDER[a]
    const ordemB = EDITION_CHRONOLOGICAL_ORDER[b]
    if (ordemA !== undefined && ordemB !== undefined) return ordemA - ordemB
    if (ordemA !== undefined) return -1
    if (ordemB !== undefined) return 1
    return String(a).localeCompare(String(b), 'pt-BR')
  })
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ versions: [] }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data, error } = await supabase
    .from('cbhpm_versions')
    .select('versao')

  if (error) {
    console.error('Erro ao buscar versões:', error)
    return Response.json({ versions: [] }, { status: 500 })
  }

  const versions = sortVersionsChronologically((data || []).map((v) => v.versao))
  return Response.json({ versions })
}
