// Rota de API: /api/versions
// Retorna as versões disponíveis da CBHPM no banco de dados

import { createClient } from '@supabase/supabase-js'

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

  const versions = (data || []).map((v) => v.versao).sort()
  return Response.json({ versions })
}
