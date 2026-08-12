import { rateLimit } from '@/lib/rate-limit'

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(request) {
  const { allowed, retryAfterSeconds } = rateLimit(request, {
    scope: 'auth-login',
    limit: 10,
    windowMs: 60_000,
  })
  if (!allowed) {
    return Response.json(
      { error: 'Muitas tentativas. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword) {
    return Response.json({ error: 'Controle de acesso não configurado' }, { status: 500 })
  }

  const { password } = await request.json().catch(() => ({}))
  if (typeof password !== 'string' || password !== sitePassword) {
    return Response.json({ error: 'Senha incorreta' }, { status: 401 })
  }

  const hash = await sha256Hex(`${sitePassword}:glisse-ai-gate`)
  const response = Response.json({ ok: true })
  response.headers.append(
    'Set-Cookie',
    `glisse_gate=${hash}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  )
  return response
}
