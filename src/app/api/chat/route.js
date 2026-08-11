// Rota de API: /api/chat
// Usada para processar consultas via Groq (OpenAI-compatible) + dados do Supabase

export async function POST(request) {
  try {
    const { query, procedures } = await request.json()

    if (!query || !procedures || procedures.length === 0) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return Response.json({ error: 'Chave da API não configurada' }, { status: 500 })
    }

    // Monta o contexto preciso a partir dos dados da tabela CBHPM
    const procedureContext = procedures.map((p, i) => `
[${i + 1}] Procedimento: ${p.procedimento}
  Código CBHPM: ${p.codigo}
  Porte: ${p.porte}
  Valor do Porte: R$ ${p.valor_porte?.toFixed(2).replace('.', ',')}
  UCO: ${p.uco}
  Valor UCO: R$ ${p.valor_uco?.toFixed(2).replace('.', ',')}
  Anestesia: ${p.anestesia || 'Não informado'}
  Versão da Tabela: ${p.versao}
  ${p.observacao ? `Observação: ${p.observacao}` : ''}
`).join('\n')

    const systemPrompt = `Você é o Glisse AI, um assistente especializado em cobranças médicas brasileiras.
Você tem acesso aos dados exatos da tabela CBHPM. Sua função é apresentar essas informações de forma clara e precisa.

REGRAS ABSOLUTAS:
- Nunca invente ou altere valores monetários, portes ou UCOs
- Use exatamente os dados fornecidos no contexto abaixo
- Não use emojis
- Responda em português brasileiro
- Seja direto e objetivo
- Se houver mais de um resultado, liste todos de forma clara

DADOS DA TABELA (use apenas estes):
${procedureContext}`

    // Chama a API do Groq (compatível com OpenAI)
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1, // Baixo para respostas precisas e determinísticas
        max_tokens: 1024,
      }),
    })

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
