import { NextResponse } from 'next/server'

// Gate de acesso simples (senha compartilhada) para mitigar a exposição da
// URL pública em produção — ver docs/opportunity-mapping.md item 2.4.
// Paliativo intencional: não substitui SSO corporativo, mas fecha o risco
// imediato de dados de precificação interna ficarem abertos para qualquer
// pessoa com o link. Só ativa se SITE_PASSWORD estiver configurada — sem
// essa env var o middleware deixa o app aberto (comportamento atual), para
// não quebrar ambientes onde a senha ainda não foi configurada.

const COOKIE_NAME = 'glisse_gate'
const PUBLIC_PATHS = ['/login', '/api/auth/login']

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function middleware(request) {
  const sitePassword = process.env.SITE_PASSWORD
  if (!sitePassword) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  const expectedHash = await sha256Hex(`${sitePassword}:glisse-ai-gate`)
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value

  if (cookieValue === expectedHash) {
    return NextResponse.next()
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
