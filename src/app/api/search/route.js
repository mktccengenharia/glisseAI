// Rota de API: /api/search
// Busca procedimentos no Supabase (por código exato ou similaridade de texto)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Usar service key no backend
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const version = searchParams.get('version') || 'ALL'

  if (!query || query.trim().length < 2) {
    return Response.json({ results: [] })
  }

  const term = query.trim()

  // Detecta se é busca por código (padrão numérico com pontos/hífens)
  const isCodeSearch = /^[\d\.\-]+$/.test(term)

  let dbQuery = supabase
    .from('cbhpm_procedures')
    .select('*')

  if (version !== 'ALL') {
    dbQuery = dbQuery.eq('versao', version)
  }

  if (isCodeSearch) {
    // Busca exata por código
    dbQuery = dbQuery.ilike('codigo', `%${term}%`)
  } else {
    // Busca por nome do procedimento (full-text simples)
    dbQuery = dbQuery.ilike('procedimento', `%${term}%`)
  }

  const { data, error } = await dbQuery.limit(10)

  if (error) {
    console.error('Supabase query error:', error)
    return Response.json({ error: 'Erro ao buscar no banco de dados' }, { status: 500 })
  }

  return Response.json({ results: data || [] })
}
