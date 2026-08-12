// Rota de API: /api/chat
// Usada para processar consultas via Groq (OpenAI-compatible) + dados do Supabase

export async function POST(request) {
  try {
    const { query, procedures } = await request.json()

    if (typeof query !== 'string' || !query.trim() || query.length > 2000) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    if (!Array.isArray(procedures) || procedures.length === 0 || procedures.length > 20) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return Response.json({ error: 'Chave da API não configurada' }, { status: 500 })
    }

    // Percentual pago a cada auxiliar sobre o valor do porte do cirurgião
    // (CBHPM, Normas Gerais, item 5 "Auxiliares de Cirurgia"): 60% para o 1º,
    // 40% para o 2º, 30% para o 3º e para o 4º.
    const AUX_PCT = [0.6, 0.4, 0.3, 0.3]
    const formatR$ = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`

    function auxiliaresLine(p) {
      if (p.numero_auxiliares === null || p.numero_auxiliares === undefined) {
        return '  Nº de Auxiliares: Não consta na fonte para este código (não informar um número, dizer que não há esse dado)'
      }
      if (p.numero_auxiliares === 0) {
        return '  Nº de Auxiliares: 0 (este código NÃO paga auxiliares de cirurgia)'
      }
      const linhas = Array.from({ length: p.numero_auxiliares }, (_, j) => {
        const valor = typeof p.valor_porte === 'number' ? formatR$(p.valor_porte * AUX_PCT[j]) : 'valor do porte indisponível'
        return `    ${j + 1}º auxiliar: ${AUX_PCT[j] * 100}% do valor do porte = ${valor}`
      }).join('\n')
      return `  Nº de Auxiliares: ${p.numero_auxiliares}\n${linhas}`
    }

    function porteAnestesicoLine(p) {
      if (p.porte_anestesico === null || p.porte_anestesico === undefined) {
        return '  Porte Anestésico: Não consta na fonte para este código'
      }
      return `  Porte Anestésico: ${p.porte_anestesico}${p.porte_anestesico === 0 ? ' (0 = não participação do anestesiologista)' : ''}`
    }

    // Monta o contexto preciso a partir dos dados da tabela CBHPM
    const procedureContext = procedures.map((p, i) => `
[${i + 1}] Procedimento: ${p.procedimento}
  Código CBHPM: ${p.codigo}
  Porte: ${p.porte}
  Valor do Porte: ${typeof p.valor_porte === 'number' ? formatR$(p.valor_porte) : 'não informado'}
${auxiliaresLine(p)}
${porteAnestesicoLine(p)}
  UCO: ${p.uco ?? 'não informado'}
  Valor UCO: ${typeof p.valor_uco === 'number' ? formatR$(p.valor_uco) : 'não informado'}
  Versão da Tabela: ${p.versao}${p.valor_versao ? ` (valores de porte da vigência ${p.valor_versao})` : ''}
  ${p.observacao ? `Observação: ${p.observacao}` : ''}
`).join('\n')

    const systemPrompt = `Você é o Glisse AI, um assistente especializado em cobranças médicas brasileiras.
Você tem acesso aos dados exatos da tabela CBHPM. Sua função é apresentar essas informações de forma clara e precisa.

REGRAS ABSOLUTAS:
- Nunca invente ou altere valores monetários, portes, UCOs, número de auxiliares ou porte anestésico
- Use exatamente os dados fornecidos no contexto abaixo
- Os valores em R$ de cada auxiliar já vêm calculados no contexto — NUNCA recalcule, apenas reproduza os números fornecidos
- "Não consta na fonte" é diferente de "0": "0" significa que o código explicitamente não paga aquele item; "não consta" significa que a tabela de origem não trouxe esse dado para esse código. Nunca trate os dois casos como iguais nem responda com um número quando o dado for "não consta"
- Se o usuário perguntar sobre atualidade dos valores, informe a vigência dos valores de porte mostrada no contexto (ex: "2020-2021") e recomende conferência, pois pode estar desatualizada
- Não use emojis
- Responda em português brasileiro
- Seja direto e objetivo
- Se houver mais de um resultado, liste todos de forma clara

REGRA DE AUXILIARES DE CIRURGIA (Normas Gerais da CBHPM, item 5): a valoração dos auxiliares corresponde a 60% do valor do porte do cirurgião para o 1º auxiliar, 40% para o 2º, 30% para o 3º e 30% para o 4º.

DADOS DA TABELA (use apenas estes):
${procedureContext}`

    // Chama a API do Groq (compatível com OpenAI)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    let response
    try {
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          temperature: 0.1, // Baixo para respostas precisas e determinísticas
          max_tokens: 1024,
        }),
        signal: controller.signal,
      })
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        return Response.json({ error: 'Tempo limite ao consultar a IA excedido' }, { status: 504 })
      }
      throw fetchError
    } finally {
      clearTimeout(timeout)
    }

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq API error:', error)
      return Response.json({ error: 'Erro na API da LLM' }, { status: 502 })
    }

    const data = await response.json()
    const assistantMessage = data.choices[0]?.message?.content || 'Não foi possível processar a resposta.'

    return Response.json({ text: assistantMessage })

  } catch (error) {
    console.error('Erro na rota /api/chat:', error)
    return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
