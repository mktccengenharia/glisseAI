"use client"
// Modo de Aprendizado Interativo — Onda 1 (Story 1.8).
//
// Formato validado com o usuário: tópicos fixos + exemplo real calculado ao
// vivo (nunca hardcoded) + pergunta ancorada só no texto do tópico + dados
// reais (nunca conhecimento livre da LLM — ver /api/chat, ramo `topicoId`).
//
// Navegação client-side (estado local), mesmo padrão que src/app/page.jsx já
// usa (`hasStarted`) — não existe infraestrutura de rota por tópico ainda, e
// não era necessária para 4 tópicos fixos (Dev Notes da story, restrição 2).

import { useState, useEffect, useCallback } from 'react'
import { LucideArrowLeft, LucideSend } from 'lucide-react'
import {
  NAO_CONSTA,
  formatValorBRL,
  formatNumero,
  isAusente,
  DEFAULT_AUX_PCT,
  valorAuxiliar,
} from '@/lib/procedure-display'
import { TOPICOS, CODIGO_EXEMPLO, VERSAO_EXEMPLO } from '@/lib/aprendizado-content'

function ExemploAoVivo({ topicoId, exemplo, carregando }) {
  if (carregando) {
    return <p className="text-sm text-gray-400">Carregando exemplo real…</p>
  }
  if (!exemplo) {
    return <p className="text-sm text-gray-400">Exemplo indisponível no momento.</p>
  }

  const valorPorte = exemplo.valor_porte ?? null
  const AUX_PCT = Array.isArray(exemplo.aux_pct) && exemplo.aux_pct.length ? exemplo.aux_pct : DEFAULT_AUX_PCT
  const numeroAuxiliares = exemplo.numero_auxiliares ?? null

  const cabecalho = (
    <p className="text-xs text-gray-500 mb-2">
      Exemplo real: <span className="font-mono">{exemplo.codigo}</span> · {exemplo.procedimento} ({exemplo.versao})
    </p>
  )

  if (topicoId === 'porte') {
    return (
      <div>
        {cabecalho}
        <p className="text-sm text-black">
          Porte {exemplo.porte} · {formatValorBRL(valorPorte)}
        </p>
      </div>
    )
  }

  if (topicoId === 'quatro-numeros') {
    return (
      <div>
        {cabecalho}
        <ul className="text-sm text-black space-y-1">
          <li>Porte: {exemplo.porte} · {formatValorBRL(valorPorte)}</li>
          <li>UCO: {formatNumero(exemplo.uco)} · {formatValorBRL(exemplo.valor_uco)}</li>
          <li>Nº de Auxiliares: {isAusente(numeroAuxiliares) ? NAO_CONSTA : numeroAuxiliares}</li>
          <li>
            Porte Anestésico:{' '}
            {isAusente(exemplo.porte_anestesico) ? NAO_CONSTA : exemplo.porte_anestesico}
          </li>
        </ul>
      </div>
    )
  }

  if (topicoId === 'modificadores') {
    // Exemplo ILUSTRATIVO de cálculo (mesmo padrão da própria pesquisa, ver
    // "Exemplo de cálculo, não norma" no relatório, seção 3.3): a fonte não
    // tem campo de "caráter do atendimento" nem "via de acesso" no banco.
    // Não afirma que ESTE procedimento específico foi urgente ou teve mais
    // de uma via de acesso — só demonstra a fórmula com um valor real.
    const comUrgencia = isAusente(valorPorte) ? null : valorPorte * 1.3
    return (
      <div>
        {cabecalho}
        <p className="text-sm text-black">Porte {exemplo.porte} · {formatValorBRL(valorPorte)}</p>
        <p className="text-sm text-gray-500 mt-1">
          Se fosse atendimento de urgência/emergência (exemplo ilustrativo do cálculo, não uma
          informação sobre este procedimento): + 30% = {formatValorBRL(comUrgencia)}
        </p>
      </div>
    )
  }

  if (topicoId === 'quem-recebe') {
    return (
      <div>
        {cabecalho}
        <p className="text-sm text-black mb-1">Porte do cirurgião: {exemplo.porte} · {formatValorBRL(valorPorte)}</p>
        {numeroAuxiliares > 0 && (
          <ul className="text-sm text-black space-y-0.5 mb-1">
            {Array.from({ length: numeroAuxiliares }, (_, j) => (
              <li key={j}>
                {j + 1}º auxiliar · {(AUX_PCT[j] * 100).toFixed(0)}% · {formatValorBRL(valorAuxiliar(valorPorte, AUX_PCT[j]))}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-black">
          Porte Anestésico: {isAusente(exemplo.porte_anestesico) ? NAO_CONSTA : exemplo.porte_anestesico}
          {/* Story 1.7 (valor em R$ do porte anestésico) pode não estar
              disponível ainda — degrada com graça para só o código, sem
              inventar um valor (ver Contexto/Fora de escopo desta story). */}
          {typeof exemplo.valor_porte_anestesico === 'number' && (
            <> · {formatValorBRL(exemplo.valor_porte_anestesico)}</>
          )}
        </p>
      </div>
    )
  }

  return null
}

export default function ModoAprendizado() {
  const [topicoAtivo, setTopicoAtivo] = useState(TOPICOS[0].id)
  const [exemplo, setExemplo] = useState(null)
  const [carregandoExemplo, setCarregandoExemplo] = useState(true)
  const [pergunta, setPergunta] = useState('')
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    let cancelado = false
    async function buscarExemplo() {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(CODIGO_EXEMPLO)}&version=${encodeURIComponent(VERSAO_EXEMPLO)}`)
        const data = await res.json()
        if (!cancelado) setExemplo(data.results?.[0] ?? null)
      } catch {
        if (!cancelado) setExemplo(null)
      } finally {
        if (!cancelado) setCarregandoExemplo(false)
      }
    }
    buscarExemplo()
    return () => { cancelado = true }
  }, [])

  const topico = TOPICOS.find((t) => t.id === topicoAtivo)

  const trocarTopico = useCallback((id) => {
    setTopicoAtivo(id)
    setPergunta('')
    setResposta('')
    setErro(null)
  }, [])

  async function enviarPergunta() {
    if (!pergunta.trim() || !exemplo || enviando) return
    setEnviando(true)
    setErro(null)
    setResposta('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: pergunta, procedures: [exemplo], topicoId: topicoAtivo }),
      })
      const data = await res.json()
      if (data.error) {
        setErro(data.error)
      } else {
        setResposta(data.text || 'Não foi possível responder agora.')
      }
    } catch {
      setErro('Erro ao consultar. Tente novamente.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black mb-4">
          <LucideArrowLeft className="w-4 h-4" /> Voltar à busca
        </a>

        <h1 className="text-xl font-semibold text-black mb-1">Modo de Aprendizado</h1>
        <p className="text-sm text-gray-500 mb-4">
          Fundamentos do faturamento médico via CBHPM, para quem está começando na área.
        </p>

        {/* AC1: aviso permanente e visível, não só num rodapé. */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-6">
          <p className="text-xs text-amber-800">
            <strong>Material de estudo.</strong> Toda regra aqui é citada por item e edição da CBHPM.
            O contrato do seu convênio pode divergir da tabela. Confirme antes de faturar.
          </p>
        </div>

        <nav className="flex flex-wrap gap-2 mb-6">
          {TOPICOS.map((t) => (
            <button
              key={t.id}
              onClick={() => trocarTopico(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                t.id === topicoAtivo ? 'bg-black text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {t.titulo}
            </button>
          ))}
        </nav>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-black mb-3">{topico.titulo}</h2>
          <div className="space-y-3">
            {topico.paragrafos.map((p, i) => (
              <div key={i}>
                <p className="text-sm text-black leading-relaxed">{p.texto}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Fonte: {p.fonte}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 border border-gray-100 rounded-2xl p-4 bg-gray-50">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Exemplo ao vivo</p>
          <ExemploAoVivo topicoId={topicoAtivo} exemplo={exemplo} carregando={carregandoExemplo} />
        </section>

        <section>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">
            Tire sua dúvida sobre este tópico
          </p>
          <div className="flex gap-2">
            <input
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') enviarPergunta() }}
              placeholder="Ex.: por que esse exemplo tem esse número de auxiliares?"
              disabled={enviando || carregandoExemplo}
              className="flex-1 border border-gray-200 bg-white px-4 py-2 text-sm rounded-md placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
            />
            <button
              onClick={enviarPergunta}
              disabled={enviando || carregandoExemplo || !pergunta.trim()}
              className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-black text-white disabled:opacity-50"
            >
              <LucideSend className="w-4 h-4" />
            </button>
          </div>
          {erro && <p className="text-sm text-red-600 mt-2">{erro}</p>}
          {resposta && <p className="text-sm text-black mt-3 whitespace-pre-wrap leading-relaxed">{resposta}</p>}
        </section>
      </div>
    </div>
  )
}
