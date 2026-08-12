// Rota de API: /api/feedback
// Persiste avaliação (útil / não útil) das respostas do chat — ver
// docs/opportunity-mapping.md item 3.1.

import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request) {
  const { allowed, retryAfterSeconds } = rateLimit(request, {
    scope: 'feedback',
    limit: 20,
    windowMs: 60_000,
  })
  if (!allowed) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  const { messageId, query, rating } = await request.json().catch(() => ({}))

  if (typeof messageId !== 'string' || !messageId) {
    return Response.json({ error: 'messageId inválido' }, { status: 400 })
  }
  if (rating !== 'up' && rating !== 'down') {
    return Response.json({ error: 'rating inválido' }, { status: 400 })
  }
  if (typeof query !== 'string' || query.length > 2000) {
    return Response.json({ error: 'query inválida' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env vars ausentes ao registrar feedback')
    return Response.json({ error: 'Serviço não configurado' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { error } = await supabase.from('chat_feedback').insert({
    message_id: messageId,
    query,
    rating,
  })

  if (error) {
    // Tabela pode ainda não existir (migration pendente) — não falhar
    // ruidosamente para o usuário final por causa de uma feature best-effort.
    console.error('Erro ao registrar feedback (migration aplicada?):', error.message)
    return Response.json({ error: 'Não foi possível registrar o feedback' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
