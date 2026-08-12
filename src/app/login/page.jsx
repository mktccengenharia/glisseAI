"use client"
import { useState } from 'react'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Não foi possível entrar')
        return
      }
      const params = new URLSearchParams(window.location.search)
      window.location.href = params.get('from') || '/'
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-black mb-1">Glisse AI</h1>
        <p className="text-sm text-gray-500 mb-5">Acesso restrito. Informe a senha para continuar.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="w-full h-10 px-3 rounded-md border border-gray-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-black/10"
        />
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full h-10 rounded-md bg-black text-white text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
