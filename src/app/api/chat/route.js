// Rota de API: /api/chat
// Usada para processar consultas via Groq (OpenAI-compatible) + dados do Supabase

import { rateLimit } from '@/lib/rate-limit'
import { TOPICOS } from '@/lib/aprendizado-content'

export async function POST(request) {
  const { allowed, retryAfterSeconds } = rateLimit(request, {
    scope: 'chat',
    limit: 15,
    windowMs: 60_000,
  })
  if (!allowed) {
    return Response.json(
      { error: 'Muitas requisições. Tente novamente em instantes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  try {
    const { query, procedures, topicoId } = await request.json()

    if (typeof query !== 'string' || !query.trim() || query.length > 2000) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    if (!Array.isArray(procedures) || procedures.length === 0 || procedures.length > 20) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    // Story 1.8 — modo de aprendizado: pergunta ancorada por tópico.
    // `topicoId` nunca é texto livre do client — é validado contra a lista
    // fixa de TOPICOS (src/lib/aprendizado-content.js), a mesma fonte que a
    // tela /aprender usa para renderizar o conteúdo. O texto da lição em si
    // nunca vem do client, só o ID: isso evita que um cliente injete
    // "contexto de lição" arbitrário no system prompt.
    const topico = typeof topicoId === 'string' ? TOPICOS.find((t) => t.id === topicoId) : null
    if (topicoId !== undefined && !topico) {
      return Response.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return Response.json({ error: 'Chave da API não configurada' }, { status: 500 })
    }

    // Percentual pago a cada auxiliar sobre o valor do porte do cirurgião
    // (CBHPM, Normas Gerais, item 5 "Auxiliares de Cirurgia") MUDA por edição:
    // 3ª edição até 2016 usam 30/20/20/20; só a 2018 usa 60/40/30/30. Por isso
    // vem de p.aux_pct (dado por procedimento, calculado no import a partir da
    // edição) em vez de constante fixa — fallback só para linhas antigas sem
    // esse campo populado.
    const DEFAULT_AUX_PCT = [0.3, 0.2, 0.2, 0.2]
    const formatR$ = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`

    function auxiliaresLine(p) {
      if (p.numero_auxiliares === null || p.numero_auxiliares === undefined) {
        return '  Nº de Auxiliares: Não consta na fonte para este código (não informar um número, dizer que não há esse dado)'
      }
      if (p.numero_auxiliares === 0) {
        return '  Nº de Auxiliares: 0 (este código NÃO paga auxiliares de cirurgia)'
      }
      const auxPct = Array.isArray(p.aux_pct) && p.aux_pct.length ? p.aux_pct : DEFAULT_AUX_PCT
      const linhas = Array.from({ length: p.numero_auxiliares }, (_, j) => {
        const valor = typeof p.valor_porte === 'number' ? formatR$(p.valor_porte * auxPct[j]) : 'valor do porte indisponível'
        return `    ${j + 1}º auxiliar: ${auxPct[j] * 100}% do valor do porte = ${valor}`
      }).join('\n')
      return `  Nº de Auxiliares: ${p.numero_auxiliares}\n${linhas}`
    }

    function porteAnestesicoLine(p) {
      if (p.porte_anestesico === null || p.porte_anestesico === undefined) {
        return '  Porte Anestésico: Não consta na fonte para este código'
      }
      if (p.porte_anestesico === 0) {
        return '  Porte Anestésico: 0 (0 = não participação do anestesiologista)'
      }
      // Story 1.7: valor em R$ já calculado por /api/search (não repetir o
      // lookup aqui — ver comentário em /api/search/route.js). Rotulagem
      // obrigatória: é o valor do ANESTESISTA, nunca somado ao honorário do
      // cirurgião nem apresentado como valor total do procedimento.
      const valor = typeof p.valor_porte_anestesico === 'number'
        ? formatR$(p.valor_porte_anestesico)
        : 'Não consta na fonte para este código'
      return `  Porte Anestésico: ${p.porte_anestesico} — Valor do anestesista: ${valor} (remuneração exclusiva do anestesista; NUNCA somar ao valor do porte do cirurgião nem apresentar como "valor total do procedimento" — essa soma não existe nesta fonte)`
    }

    const ausente = (v) => v === null || v === undefined
    const ausenteTexto = (v) => ausente(v) || (typeof v === 'string' && v.trim() === '')
    const NAO_CONSTA = 'Não consta na fonte para este código (não informar um número, dizer que não há esse dado)'

    // Campos exclusivos de Radiologia / Medicina Nuclear (Capítulo 4). Só
    // entram no contexto quando a fonte trouxe o dado: mandar "não consta"
    // para todo procedimento fora desses grupos é ruído que a LLM tende a
    // repetir na resposta.
    function capitulo4Lines(p) {
      const linhas = []
      // custo_filme_doc é multiplicador da fonte, não valor em reais — nunca
      // formatar como R$ (Article IV). custo_operacional NÃO entra aqui de
      // propósito (decisão do usuário em 2026-08-17, gate UX-001): os scripts
      // de import gravam uco = custo_operacional, é o mesmo número que já
      // aparece na linha "UCO" abaixo — listar os dois lia como dois dados
      // diferentes para a LLM.
      if (!ausente(p.custo_filme_doc)) linhas.push(`  Custo de Filme/Documentação: ${p.custo_filme_doc}`)
      if (!ausente(p.numero_incidencias)) linhas.push(`  Nº de Incidências: ${p.numero_incidencias}`)
      if (!ausenteTexto(p.unidade_radiofarmaco)) {
        linhas.push(
          `  Unidade de Radiofármaco (UR): ${p.unidade_radiofarmaco} ` +
          '(reproduzir EXATAMENTE este símbolo; "*" significa que a fonte remete à tabela de preços do ' +
          'Colégio Brasileiro de Radiologia, externa a esta tabela, e NÃO a um valor numérico ou em reais)'
        )
      }
      return linhas.join('\n')
    }

    // Monta o contexto preciso a partir dos dados da tabela CBHPM
    const procedureContext = procedures.map((p, i) => [
      `[${i + 1}] Procedimento: ${p.procedimento}`,
      `  Código CBHPM: ${p.codigo}`,
      `  Porte: ${p.porte}`,
      `  Valor do Porte: ${typeof p.valor_porte === 'number' ? formatR$(p.valor_porte) : NAO_CONSTA}`,
      auxiliaresLine(p),
      porteAnestesicoLine(p),
      `  UCO: ${ausente(p.uco) ? NAO_CONSTA : p.uco}`,
      `  Valor UCO: ${typeof p.valor_uco === 'number' ? formatR$(p.valor_uco) : NAO_CONSTA}`,
      capitulo4Lines(p),
      `  Versão da Tabela: ${p.versao}${p.valor_versao ? ` (valores de porte da vigência ${p.valor_versao})` : ''}`,
      p.observacao ? `  Observação: ${p.observacao}` : '',
    ].filter(Boolean).join('\n')).join('\n\n')

    // Story 1.8 — modo de aprendizado: quando `topico` está presente, o
    // system prompt é outro (professor ancorado), não o de busca/faturamento
    // normal. Grounding restrito ao texto do tópico (`aprendizado-content.js`,
    // única fonte, citada no card de origem — validado contra o relatório de
    // pesquisa) + aos dados reais do exemplo ao vivo já em procedureContext.
    // Nunca conhecimento geral do modelo sobre faturamento médico.
    const systemPrompt = topico
      ? `Você é um professor do Glisse AI, ensinando faturamento médico CBHPM para alguém novo na área.

REGRAS ABSOLUTAS DESTE MODO:
- Responda SOMENTE com base no MATERIAL DA LIÇÃO e nos DADOS DO EXEMPLO abaixo. Nunca use conhecimento geral seu sobre faturamento médico, mesmo que pareça correto
- Se a pergunta não puder ser respondida com o material abaixo, diga explicitamente algo como "isso não está no material deste tópico" e sugira que a pessoa confirme com quem já trabalha no setor — nunca invente uma resposta plausível
- Cite a fonte de cada afirmação exatamente como aparece no material (ex: "CBHPM, item 5.1")
- Nunca some Porte + Custo Operacional + valor do anestesista como se fosse um "valor total do procedimento" — essa soma não existe nesta fonte
- Nunca explique "por que" um procedimento paga ou não paga auxiliar além do que o material diz (a CBHPM não publica esse critério)
- Não use emojis, não use o caractere travessão (—)
- Não use formatação markdown (sem **negrito**, sem listas com "*" ou "-", sem #): a interface exibe texto puro, e markdown apareceria como asteriscos literais para quem está lendo
- Responda em português brasileiro, direto e objetivo

MATERIAL DA LIÇÃO — "${topico.titulo}":
${topico.paragrafos.map((p) => `- ${p.texto} (Fonte: ${p.fonte})`).join('\n')}

DADOS DO EXEMPLO (procedimento real, mesma convenção de "Não consta na fonte" do resto do produto):
${procedureContext}`
      : `Você é o Glisse AI, um assistente especializado em cobranças médicas brasileiras.
Você tem acesso aos dados exatos da tabela CBHPM. Sua função é apresentar essas informações de forma clara e precisa.

REGRAS ABSOLUTAS:
- Nunca invente ou altere valores monetários, portes, UCOs, número de auxiliares ou porte anestésico
- Use exatamente os dados fornecidos no contexto abaixo
- Os valores em R$ de cada auxiliar já vêm calculados no contexto — NUNCA recalcule, apenas reproduza os números fornecidos
- "Não consta na fonte" é diferente de "0": "0" significa que o código explicitamente não paga aquele item; "não consta" significa que a tabela de origem não trouxe esse dado para esse código. Nunca trate os dois casos como iguais nem responda com um número quando o dado for "não consta"
- Se o usuário perguntar sobre atualidade dos valores, informe a vigência dos valores de porte mostrada no contexto (ex: "2020-2021") e recomende conferência, pois pode estar desatualizada
- O "Valor do anestesista" (linha "Porte Anestésico") remunera exclusivamente o anestesista. NUNCA some esse valor ao "Valor do Porte" do cirurgião, ao valor de UCO, nem a qualquer outro campo — não existe "valor total do procedimento" nesta fonte, e apresentar uma soma inventaria um dado que a CBHPM não fornece
- Não use emojis
- Não use formatação markdown (sem **negrito**, sem listas com "*" ou "-", sem #): a interface exibe texto puro, e markdown apareceria como asteriscos literais para quem está lendo
- Responda em português brasileiro
- Seja direto e objetivo
- Se houver mais de um resultado, liste todos de forma clara
- Nunca use o caractere travessão (—); prefira vírgula, ponto ou frases curtas
- Estruture a resposta: quando houver mais de um procedimento, apresente cada um em um bloco ou item de lista separado (código, porte e valor em linhas próprias), nunca em texto corrido misturando vários procedimentos no mesmo parágrafo

REGRA DE UNIDADE DE RADIOFÁRMACO (UR), quando o campo aparecer no contexto: reproduza o símbolo exatamente como está (normalmente "*"). Ele remete a uma tabela de preços do Colégio Brasileiro de Radiologia, externa a esta base. NUNCA converta em reais, nunca estime um número, nunca diga que o valor é zero.

REGRA DE AUXILIARES DE CIRURGIA (Normas Gerais da CBHPM, item 5): o percentual de rateio muda por edição da tabela (algumas usam 60/40/30/30, outras 30/20/20/20) — os percentuais e valores em R$ de cada auxiliar já vêm calculados corretamente no contexto abaixo para a edição correta, apenas reproduza.

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
          // 2026-08-18: 'llama-3.1-8b-instant' não existe mais na API da Groq
          // (model_not_found, achado do QA gate da Story 1.8 — derrubava o
          // chat inteiro). Confirmado contra GET /v1/models (lista real da
          // API, não documentação desatualizada) que 'openai/gpt-oss-20b' é o
          // substituto adequado: mesma faixa de tamanho/custo, testado com o
          // system prompt real do produto (segue "nunca usar travessão",
          // reproduz dado fornecido sem inventar, responde em ~0,5s). É
          // modelo de raciocínio (chain-of-thought interno), mas a Groq
          // devolve o raciocínio em `choices[0].message.reasoning`, separado
          // de `content` — não vaza para a resposta exibida ao usuário
          // (diferente de outros modelos testados, ex. 'qwen/qwen3.6-27b',
          // que vazam `<think>...</think>` dentro do próprio `content`).
          model: 'openai/gpt-oss-20b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: query }
          ],
          temperature: 0.1, // Baixo para respostas precisas e determinísticas
          max_tokens: 1024,
          // 2026-08-18: achado na verificação visual pós-troca de modelo —
          // busca com várias edições (ex: 7 procedimentos) voltava
          // "Não foi possível processar a resposta" (content vazio) ou texto
          // cortado no meio. Causa: sem este parâmetro, o raciocínio interno
          // do gpt-oss-20b consumia até 90% do max_tokens antes de escrever a
          // resposta visível, e com o contexto real (7 procedimentos) o
          // orçamento acabava antes do texto terminar. Confirmado via API
          // direta: reasoning_tokens caiu de ~200 para ~10 com este valor, e
          // finish_reason passou de corte precoce para "stop" (resposta
          // completa, todos os procedimentos listados, sem markdown).
          reasoning_effort: 'low',
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
