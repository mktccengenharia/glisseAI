"use client"
import React, { useState, useRef, useCallback } from 'react'
import { LucideSend, LucideClipboard, LucideCheck, LucideChevronDown, LucideThumbsUp, LucideThumbsDown, LucideArrowLeft, LucideGraduationCap } from 'lucide-react'
import {
  NAO_CONSTA,
  formatValorBRL,
  formatNumero,
  isAusente,
  camposCapitulo4Presentes,
  resumoResultados,
  isResultadoAproximado,
  AVISO_RESULTADO_APROXIMADO,
  SELO_RESULTADO_APROXIMADO,
  MAX_CARDS_EXIBIDOS,
  DEFAULT_AUX_PCT,
  valorAuxiliar,
} from '@/lib/procedure-display'

// ─── Utilitários ───────────────────────────────────────────────────────────

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Componentes Inline ────────────────────────────────────────────────────

function Button({ children, onClick, variant = 'default', size = 'default', className = '' }) {
  const base = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'
  const variants = {
    default: 'bg-black text-white hover:bg-gray-900',
    outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-black',
    ghost: 'hover:bg-gray-100 text-black bg-transparent',
  }
  const sizes = {
    default: 'h-10 px-4 py-2 text-sm rounded-md',
    sm: 'h-8 px-3 text-xs rounded-md',
    icon: 'h-9 w-9 rounded-full',
  }
  return (
    <button
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

function Input({ value, onChange, onKeyDown, placeholder, className = '', autoFocus }) {
  return (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`flex w-full border border-gray-200 bg-white px-4 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 ${className}`}
    />
  )
}

// ─── Componente de Seletor de Versão ───────────────────────────────────────

function VersionSelector({ versions, selectedVersion, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Fecha ao clicar fora
  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const label = selectedVersion === 'ALL' ? 'Versão' : selectedVersion

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black text-white text-xs font-medium hover:bg-gray-900 transition-colors focus:outline-none"
      >
        {label}
        <LucideChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-52 max-h-64 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-lg z-50">
          {versions.map((v) => (
            <button
              key={v}
              onClick={() => { onChange(v); setOpen(false) }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${selectedVersion === v ? 'font-semibold' : 'font-normal text-gray-700'}`}
            >
              {v === 'ALL' ? 'Todas as versões' : v}
              {selectedVersion === v && <LucideCheck className="w-3.5 h-3.5 text-black" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Componente de Cartão de Procedimento ─────────────────────────────────

function ProcedureCard({ item, aproximado = false }) {
  const [copiedField, setCopiedField] = useState(null)

  const copyField = (field, text) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000)
  }

  const copyCode = () => copyField('codigo', item.codigo || item.code || '')
  const copyName = () => copyField('procedimento', item.procedimento || item.name || '')
  const copyToClipboard = () => copyField(
    'tudo',
    `Código: ${item.codigo || item.code} | Procedimento: ${item.procedimento || item.name} | Porte: ${item.porte || item.port}`
  )

  const codigo = item.codigo || item.code || '-'
  const procedimento = item.procedimento || item.name || '-'
  const porte = item.porte || item.port || '-'
  // null/undefined = a fonte CBHPM não traz o valor para esse código, o que é
  // DIFERENTE de zero. As coerções `|| 0` e `|| '-'` que existiam aqui
  // transformavam ausência em "R$ 0,00" / "-", que numa ferramenta de
  // faturamento é lido como "não paga" em vez de "não sei" (Story 1.6, AC1).
  // `??` em vez de `||` também nos aliases: um valor 0 legítimo não pode cair
  // para o campo seguinte.
  const uco = item.uco ?? null
  const valorPorte = item.valorPorteR$ ?? item.valor_porte ?? null
  const valorUco = item.valorUcoR$ ?? item.valor_uco ?? null
  const versao = item.versao || '-'
  const camposCap4 = camposCapitulo4Presentes(item)
  const anestesia = item.anestesia || '0'
  // null = não consta na fonte (não é o mesmo que 0) — nunca usar `|| 0` aqui
  const numeroAuxiliares = item.numero_auxiliares ?? null
  const porteAnestesico = item.porte_anestesico ?? null
  // Story 1.7: valor em R$ já calculado por /api/search (mapeamento porte
  // anestésico -> porte CBHPM). null quando não se aplica (porte 0/ausente)
  // OU quando a edição não tem valor cadastrado para o porte equivalente —
  // as duas situações são visualmente idênticas de propósito ("Não consta na
  // fonte"), a distinção de qual é qual não muda a ação do faturista.
  const valorPorteAnestesico = item.valor_porte_anestesico ?? null
  // Percentual de rateio muda por edição (60/40/30/30 na 2018, 30/20/20/20 nas
  // demais) — vem do próprio registro, com fallback só para dado antigo.
  const AUX_PCT = Array.isArray(item.aux_pct) && item.aux_pct.length ? item.aux_pct : DEFAULT_AUX_PCT

  return (
    <div className="mt-3 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
      <div className="px-4 pt-4 pb-3">
        {aproximado && (
          <p className="inline-block mb-2 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-medium uppercase tracking-wider text-amber-700">
            {SELO_RESULTADO_APROXIMADO}
          </p>
        )}
        <p className="font-semibold text-[15px] leading-snug text-black mb-4">{procedimento}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Código</p>
            <p className="text-sm font-mono font-medium text-black">{codigo}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Porte</p>
            {isAusente(valorPorte) ? (
              <p className="text-sm font-medium text-black">
                {porte} · <span className="text-gray-400">{NAO_CONSTA}</span>
              </p>
            ) : (
              <p className="text-sm font-medium text-black">{porte} · {formatValorBRL(valorPorte)}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">UCO</p>
            {/* Quando nem o UCO nem o valor em R$ constam, uma frase só — repetir
                "Não consta na fonte · Não consta na fonte" seria ruído. */}
            {isAusente(uco) && isAusente(valorUco) ? (
              <p className="text-sm font-medium text-gray-400">{NAO_CONSTA}</p>
            ) : (
              <p className="text-sm font-medium text-black">
                <span className={isAusente(uco) ? 'text-gray-400' : undefined}>{formatNumero(uco)}</span>
                {' · '}
                <span className={isAusente(valorUco) ? 'text-gray-400' : undefined}>{formatValorBRL(valorUco)}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Porte Anestésico</p>
            {porteAnestesico !== null && porteAnestesico !== 0 ? (
              <>
                <p className="text-sm font-medium text-black">
                  {porteAnestesico}{' · '}
                  <span className={isAusente(valorPorteAnestesico) ? 'text-gray-400' : undefined}>
                    {isAusente(valorPorteAnestesico) ? NAO_CONSTA : formatValorBRL(valorPorteAnestesico)}
                  </span>
                </p>
                {/* Rotulagem obrigatória (Story 1.7, Article IV): valor do
                    anestesista, nunca parte de um total do procedimento. */}
                <p className="text-[10px] text-gray-400 mt-0.5">Valor do anestesista</p>
              </>
            ) : (
              <p className="text-sm font-medium text-black">
                {porteAnestesico !== null ? porteAnestesico : (anestesia !== '0' ? anestesia : 'Sem anestesia')}
              </p>
            )}
          </div>
          <div className="col-span-2">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">Auxiliares de Cirurgia</p>
            {numeroAuxiliares === null && (
              <p className="text-sm font-medium text-gray-400">{NAO_CONSTA}</p>
            )}
            {numeroAuxiliares === 0 && (
              <p className="text-sm font-medium text-black">0 (não paga auxiliar)</p>
            )}
            {numeroAuxiliares > 0 && (
              <ul className="text-sm text-black space-y-0.5">
                {Array.from({ length: numeroAuxiliares }, (_, j) => (
                  <li key={j}>
                    {j + 1}º auxiliar · {AUX_PCT[j] * 100}% ·{' '}
                    {formatValorBRL(valorAuxiliar(valorPorte, AUX_PCT[j]))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Campos de Radiologia / Medicina Nuclear (Capítulo 4). Política de
              null diferente da dos valores em R$ acima, de propósito: aqui o
              campo é OMITIDO quando ausente, porque só se aplica a esses
              grupos — "Não consta" em todo procedimento viraria ruído. */}
          {camposCap4.map((campo) => (
            <div key={campo.key} className={campo.legenda ? 'col-span-2' : undefined}>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-0.5">{campo.label}</p>
              <p className="text-sm font-medium text-black">{campo.value}</p>
              {campo.legenda && <p className="text-[11px] text-gray-400 mt-0.5">{campo.legenda}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 pb-3 pt-1 border-t border-gray-50">
        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Versão</p>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{versao}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={copyCode}
              title="Copiar apenas o código"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors py-1 px-2 rounded-lg hover:bg-gray-50"
            >
              {copiedField === 'codigo'
                ? <><LucideCheck className="w-3 h-3 text-black" /> Copiado</>
                : <><LucideClipboard className="w-3 h-3" /> Código</>
              }
            </button>
            <button
              onClick={copyName}
              title="Copiar apenas o nome do procedimento"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors py-1 px-2 rounded-lg hover:bg-gray-50"
            >
              {copiedField === 'procedimento'
                ? <><LucideCheck className="w-3 h-3 text-black" /> Copiado</>
                : <><LucideClipboard className="w-3 h-3" /> Nome</>
              }
            </button>
            <button
              onClick={copyToClipboard}
              title="Copiar código, procedimento e porte"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-black transition-colors py-1 px-2 rounded-lg hover:bg-gray-50"
            >
              {copiedField === 'tudo'
                ? <><LucideCheck className="w-3 h-3 text-black" /> Copiado</>
                : <><LucideClipboard className="w-3 h-3" /> Tudo</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Feedback da Resposta (útil / não útil) ───────────────────────────────

function FeedbackButtons({ messageId, query }) {
  const [sent, setSent] = useState(null)

  const sendFeedback = async (rating) => {
    if (sent) return
    setSent(rating)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, query, rating }),
      })
    } catch {
      // Best-effort: não interrompe a experiência se o envio falhar
    }
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        onClick={() => sendFeedback('up')}
        disabled={!!sent}
        title="Resposta útil"
        className="p-1.5 rounded-lg hover:bg-gray-50 disabled:hover:bg-transparent transition-colors"
      >
        <LucideThumbsUp className={`w-3.5 h-3.5 ${sent === 'up' ? 'text-black' : 'text-gray-300'}`} />
      </button>
      <button
        onClick={() => sendFeedback('down')}
        disabled={!!sent}
        title="Resposta não útil"
        className="p-1.5 rounded-lg hover:bg-gray-50 disabled:hover:bg-transparent transition-colors"
      >
        <LucideThumbsDown className={`w-3.5 h-3.5 ${sent === 'down' ? 'text-black' : 'text-gray-300'}`} />
      </button>
      {sent && <span className="text-[10px] text-gray-400">Obrigado pelo feedback</span>}
    </div>
  )
}

// ─── Sugestões de Busca Rápida ────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  'Consulta em Consultório',
  'Visita hospitalar',
  'RTU de Próstata',
  'Holter de 24 horas',
]

// ─── Página Principal ─────────────────────────────────────────────────────

export default function GlisseAI() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [versions, setVersions] = useState(['ALL'])
  const [selectedVersion, setSelectedVersion] = useState('ALL')
  const [hasStarted, setHasStarted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  // Carrega versões disponíveis do banco
  React.useEffect(() => {
    fetch('/api/versions')
      .then(res => res.json())
      .then(data => {
        if (data.versions && data.versions.length > 0) {
          setVersions(['ALL', ...data.versions])
        }
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleExitChat = useCallback(() => {
    setMessages([])
    setInputValue('')
    setHasStarted(false)
  }, [])

  const handleSend = useCallback(async (queryOverride) => {
    const query = typeof queryOverride === 'string' ? queryOverride : inputValue.trim()
    if (!query || isLoading) return

    if (!hasStarted) setHasStarted(true)
    setInputValue('')
    setIsLoading(true)

    setMessages(prev => [...prev, { role: 'user', text: query }])

    try {
      // 1. Buscar na API local (que consulta Supabase ou engine local)
      const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}&version=${selectedVersion}`)
      const searchData = await searchRes.json()
      const procedures = searchData.results || []

      if (procedures.length === 0) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'bot',
          text: `Nenhum procedimento encontrado para "${query}". Cobrimos todos os capítulos da CBHPM: pode ser um termo/código que não existe na tabela, ou que não está presente na edição selecionada. Tente palavras-chave parciais ou confira o código.`,
          cards: []
        }])
        return
      }

      // 2. Enviar para a LLM (Groq) para formatação natural
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, procedures })
      })
      const chatData = await chatRes.json()

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'bot',
        text: chatData.text || 'Resultado encontrado.',
        cards: procedures,
        // Ramo da cascata que respondeu — a UI rotula como aproximado só o que
        // veio do fallback semântico (ver /api/search).
        matchType: searchData.matchType ?? null,
        feedbackEligible: true,
        query
      }])

    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'Erro ao processar a consulta. Tente novamente.',
        cards: []
      }])
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, hasStarted, selectedVersion])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Input Bar (inline JSX, NÃO como sub-componente, para evitar
  //    re-mount e perda de foco a cada re-render) ──────────────────────────
  const renderInputBar = (autoFocus = false) => (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Digite o código ou procedimento..."
        autoFocus={autoFocus}
        className="flex w-full border border-gray-200 bg-white pr-12 pl-5 py-4 rounded-full shadow-sm text-[15px] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
      />
      <button
        onClick={() => handleSend()}
        disabled={isLoading || !inputValue.trim()}
        className="absolute right-2 flex items-center justify-center w-9 h-9 rounded-full bg-black text-white hover:bg-gray-900 disabled:opacity-30 transition-all"
      >
        <LucideSend className="w-4 h-4" />
      </button>
    </div>
  )

  // ── Home Screen ─────────────────────────────────────────────────────────
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes glisse-pulse {
            0%   { opacity: 0.7; letter-spacing: -0.02em; }
            100% { opacity: 1;   letter-spacing: -0.01em; }
          }
        `}} />

        {/* Logo */}
        <h1
          style={{
            fontFamily: 'Helvetica, Arial, sans-serif',
            animation: 'glisse-pulse 3s ease-in-out infinite alternate',
          }}
          className="text-[72px] font-light text-black mb-10 select-none tracking-tight"
        >
          Glisse AI
        </h1>

        {/* Sugestões acima do input */}
        <div className="flex flex-wrap justify-center gap-2 mb-5 max-w-xl">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-full hover:border-gray-400 hover:text-black transition-colors bg-white"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="w-full max-w-xl mb-3">
          {renderInputBar(true)}
        </div>

        {/* Seletor de Versão + entrada para o Modo de Aprendizado (Story 1.8) */}
        <div className="flex items-center justify-between w-full max-w-xl">
          <VersionSelector
            versions={versions}
            selectedVersion={selectedVersion}
            onChange={setSelectedVersion}
          />
          <a
            href="/aprender"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-full hover:border-gray-400 hover:text-black transition-colors bg-white"
          >
            <LucideGraduationCap className="w-3.5 h-3.5" />
            Modo de Aprendizado
          </a>
        </div>
      </div>
    )
  }

  // ── Chat Screen ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-100 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExitChat}
              title="Voltar ao início"
              className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
            >
              <LucideArrowLeft className="w-4 h-4" />
            </button>
            <h1
              style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
              className="text-xl font-light tracking-tight text-black"
            >
              Glisse AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/aprender"
              title="Modo de Aprendizado"
              className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
            >
              <LucideGraduationCap className="w-4 h-4" />
            </a>
            <VersionSelector
              versions={versions}
              selectedVersion={selectedVersion}
              onChange={setSelectedVersion}
            />
          </div>
        </div>
      </header>

      {/* Mensagens */}
      <main className="flex-1 pt-16 pb-32">
        <div ref={scrollRef} className="max-w-2xl mx-auto px-4 py-6 space-y-10">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] bg-black text-white px-5 py-3 rounded-3xl rounded-tr-md text-sm leading-relaxed">
                  {msg.text}
                </div>
              ) : (
                <div className="w-full">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Glisse AI</p>
                  <div
                    className="text-sm text-black leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(msg.text)
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/`(.*?)`/g, '<code class="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">$1</code>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="mt-2 space-y-3 max-w-md">
                      {isResultadoAproximado(msg.matchType) && (
                        <p className="text-xs leading-relaxed text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          {AVISO_RESULTADO_APROXIMADO}
                        </p>
                      )}
                      {/* Contagem explícita: a UI cortava em 5 os 10 que a API
                          devolve e descartava metade em silêncio. */}
                      {resumoResultados(msg.cards.length) && (
                        <p className="text-xs text-gray-500">{resumoResultados(msg.cards.length)}</p>
                      )}
                      {msg.cards.slice(0, MAX_CARDS_EXIBIDOS).map((card, ci) => (
                        <ProcedureCard key={ci} item={card} aproximado={isResultadoAproximado(msg.matchType)} />
                      ))}
                    </div>
                  )}
                  {msg.feedbackEligible && (
                    <FeedbackButtons messageId={msg.id} query={msg.query} />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Indicador de carregamento */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-full">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Glisse AI</p>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Input fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-5 px-4">
        <div className="max-w-2xl mx-auto">
          {renderInputBar(false)}
          <p className="text-center text-[10px] text-gray-400 mt-2">
            Glisse AI pode cometer erros. Verifique os valores antes de faturar.
          </p>
        </div>
      </div>
    </div>
  )
}
