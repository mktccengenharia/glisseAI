// Rate limiter em memória (janela fixa por IP). Suficiente como primeira camada
// de proteção contra abuso/custo inesperado na Groq API; não é distribuído
// entre instâncias — para múltiplas instâncias simultâneas, evoluir para um
// store compartilhado (ex: Upstash Redis) seria o próximo passo.

const buckets = new Map()

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}

export function rateLimit(request, { limit, windowMs, scope }) {
  const ip = getClientIp(request)
  const key = `${scope}:${ip}`
  const now = Date.now()

  const bucket = buckets.get(key)

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { windowStart: now, count: 1 })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

// Limpeza periódica para não crescer indefinidamente em processos long-lived
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > 10 * 60 * 1000) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref?.()
