// Story 1.6 — paridade de colunas (AC2), identificação do ramo de match (AC4)
// e log de toda busca (AC5) em /api/search.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Estado controlável pelos testes: o que cada ramo da cascata devolve.
const state = {
  rows: {},
  rpcRows: {},
  rpcErrors: {},
  inserts: [],
  insertBehavior: 'ok',
  // Story 1.7: linhas de cbhpm_porte_valores para o lookup de porte anestésico.
  porteValores: [],
  porteValoresError: null,
}

function makeQueryBuilder() {
  const ctx = { kind: null }
  const builder = {
    select: () => builder,
    eq: () => builder,
    ilike: (coluna) => {
      ctx.kind = coluna === 'codigo' ? 'codigo' : 'ilike'
      return builder
    },
    textSearch: () => {
      ctx.kind = 'fulltext'
      return builder
    },
    limit: () => Promise.resolve({ data: state.rows[ctx.kind] ?? [], error: null }),
  }
  return builder
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table) => {
      if (table === 'search_events') {
        return {
          insert: (row) => {
            state.inserts.push(row)
            if (state.insertBehavior === 'reject') {
              // Simula a tabela ainda não existir (migration da seção 11 pendente).
              return Promise.reject(new Error('relation "search_events" does not exist'))
            }
            if (state.insertBehavior === 'hang') {
              return new Promise(() => {}) // nunca resolve
            }
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'cbhpm_porte_valores') {
        const builder = {
          select: () => builder,
          in: () => builder,
          then: (resolve) =>
            resolve({
              data: state.porteValoresError ? null : state.porteValores,
              error: state.porteValoresError,
            }),
        }
        return builder
      }
      return makeQueryBuilder()
    },
    rpc: (name) =>
      Promise.resolve({
        data: state.rpcRows[name] ?? [],
        error: state.rpcErrors[name] ?? null,
      }),
  }),
}))

vi.mock('@/lib/embeddings', () => ({
  embedQuery: async () => new Array(384).fill(0),
}))

// Linha completa da tabela, como as RPCs `returns setof` devolvem: inclui
// embedding e colunas fora do conjunto exposto ao frontend.
function linhaCompleta(overrides = {}) {
  return {
    id: 1,
    codigo: '4.08.01.03-8',
    procedimento: 'RX Crânio 3 incidências',
    porte: '2A',
    valor_porte: 45.6,
    uco: 1.2,
    valor_uco: 12.34,
    anestesia: '0',
    versao: 'CBHPM 2018',
    observacao: null,
    created_at: '2026-08-01T00:00:00Z',
    capitulo: '4',
    numero_auxiliares: null,
    porte_anestesico: null,
    custo_operacional: 1.2,
    custo_filme_doc: 0.5,
    numero_incidencias: 3,
    unidade_radiofarmaco: '*',
    valor_versao: 'CBHPM 2018',
    aux_pct: [0.6, 0.4, 0.3, 0.3],
    embedding: new Array(384).fill(0.1),
    ...overrides,
  }
}

// Linha como o `select` reduzido devolve (sem embedding).
function linhaSelect(overrides = {}) {
  const { embedding, ...rest } = linhaCompleta(overrides)
  return rest
}

let ipCounter = 0
function getRequest(url) {
  ipCounter += 1
  const ip = `9.9.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`
  return { url, headers: { get: (name) => (name.toLowerCase() === 'x-forwarded-for' ? ip : null) } }
}

async function loadRoute() {
  return import('../src/app/api/search/route.js')
}

beforeEach(() => {
  state.rows = {}
  state.rpcRows = {}
  state.rpcErrors = {}
  state.inserts = []
  state.insertBehavior = 'ok'
  state.porteValores = []
  state.porteValoresError = null
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('AC2 — paridade de campos entre os quatro caminhos de busca', () => {
  it('SELECT_COLUMNS inclui os campos do Capítulo 4', async () => {
    const { RESULT_FIELDS } = await loadRoute()
    expect(RESULT_FIELDS).toContain('custo_filme_doc')
    expect(RESULT_FIELDS).toContain('numero_incidencias')
    expect(RESULT_FIELDS).toContain('unidade_radiofarmaco')
    expect(RESULT_FIELDS).toContain('custo_operacional')
  })

  it('nunca expõe o vetor de embedding ao client', async () => {
    const { RESULT_FIELDS, pickResultFields } = await loadRoute()
    expect(RESULT_FIELDS).not.toContain('embedding')
    expect(pickResultFields(linhaCompleta())).not.toHaveProperty('embedding')
  })

  it('pickResultFields normaliza campo ausente para null (mesmo conjunto de chaves)', async () => {
    const { RESULT_FIELDS, pickResultFields } = await loadRoute()
    const parcial = pickResultFields({ codigo: '1.01.01.01-2' })
    expect(Object.keys(parcial).sort()).toEqual([...RESULT_FIELDS].sort())
    expect(parcial.custo_filme_doc).toBeNull()
  })

  // O mesmo procedimento pelos 4 ramos tem que chegar com o mesmo conjunto de campos.
  const caminhos = [
    {
      nome: 'código exato',
      query: '4.08.01.03-8',
      setup: () => {
        state.rows.codigo = [linhaSelect()]
      },
    },
    {
      nome: 'full-text',
      query: 'cranio',
      setup: () => {
        state.rows.fulltext = [linhaSelect()]
      },
    },
    {
      nome: 'RPC unaccent',
      query: 'cranio',
      setup: () => {
        state.rows.fulltext = []
        state.rpcRows.search_cbhpm_procedures_unaccent = [linhaCompleta()]
      },
    },
    {
      nome: 'RPC semântica',
      query: 'raio x cabeca',
      setup: () => {
        state.rows.fulltext = []
        state.rpcRows.search_cbhpm_procedures_unaccent = []
        state.rpcRows.match_cbhpm_procedures = [linhaCompleta()]
      },
    },
  ]

  for (const caminho of caminhos) {
    it(`devolve o conjunto completo de campos pelo caminho ${caminho.nome}`, async () => {
      caminho.setup()
      const { GET, RESULT_FIELDS } = await loadRoute()
      const res = await GET(getRequest(`http://localhost/api/search?q=${encodeURIComponent(caminho.query)}`))
      const data = await res.json()

      expect(data.results).toHaveLength(1)
      // RESPONSE_FIELDS, não RESULT_FIELDS: inclui valor_porte_anestesico
      // (Story 1.7), que é calculado, não uma coluna de cbhpm_procedures —
      // ver comentário em RESPONSE_FIELDS no route.js.
      const { RESPONSE_FIELDS } = await loadRoute()
      expect(Object.keys(data.results[0]).sort()).toEqual([...RESPONSE_FIELDS].sort())
      expect(data.results[0].custo_filme_doc).toBe(0.5)
      expect(data.results[0].numero_incidencias).toBe(3)
      // Article IV: chega ao frontend sem transformação.
      expect(data.results[0].unidade_radiofarmaco).toBe('*')
      expect(data.results[0]).not.toHaveProperty('embedding')
    })
  }
})

describe('AC4 — identificação do ramo que respondeu', () => {
  it('marca matchType "codigo" na busca por código', async () => {
    state.rows.codigo = [linhaSelect()]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.matchType).toBe('codigo')
  })

  it('marca matchType "texto" no full-text', async () => {
    state.rows.fulltext = [linhaSelect()]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=cranio'))).json()
    expect(data.matchType).toBe('texto')
  })

  it('marca matchType "texto-sem-acento" quando a RPC unaccent responde', async () => {
    state.rows.fulltext = []
    state.rpcRows.search_cbhpm_procedures_unaccent = [linhaCompleta()]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=disseccao'))).json()
    expect(data.matchType).toBe('texto-sem-acento')
  })

  it('marca matchType "semantico" só quando o fallback semântico responde', async () => {
    state.rows.fulltext = []
    state.rpcRows.search_cbhpm_procedures_unaccent = []
    state.rpcRows.match_cbhpm_procedures = [linhaCompleta()]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=tirar prostata'))).json()
    expect(data.matchType).toBe('semantico')
  })

  it('matchType é null quando nenhum ramo encontrou nada', async () => {
    state.rows.fulltext = []
    state.rpcRows.search_cbhpm_procedures_unaccent = []
    state.rpcRows.match_cbhpm_procedures = []
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=xyzabc'))).json()
    expect(data.results).toEqual([])
    expect(data.matchType).toBeNull()
  })
})

describe('AC5 — log de toda busca em search_events', () => {
  it('grava teve_resultado true quando a busca encontrou', async () => {
    state.rows.codigo = [linhaSelect()]
    const { GET } = await loadRoute()
    await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8&version=CBHPM%202018'))
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({
      teve_resultado: true,
      tipo: 'codigo',
      versao: 'CBHPM 2018',
    })
  })

  it('grava o ramo semântico como tipo do match', async () => {
    state.rows.fulltext = []
    state.rpcRows.search_cbhpm_procedures_unaccent = []
    state.rpcRows.match_cbhpm_procedures = [linhaCompleta()]
    const { GET } = await loadRoute()
    await GET(getRequest('http://localhost/api/search?q=tirar prostata'))
    expect(state.inserts[0]).toMatchObject({ tipo: 'semantico', teve_resultado: true })
  })

  it('busca vazia continua gravando teve_resultado false', async () => {
    state.rows.fulltext = []
    state.rpcRows.search_cbhpm_procedures_unaccent = []
    state.rpcRows.match_cbhpm_procedures = []
    const { GET } = await loadRoute()
    await GET(getRequest('http://localhost/api/search?q=xyzabc'))
    expect(state.inserts).toHaveLength(1)
    expect(state.inserts[0]).toMatchObject({ teve_resultado: false, tipo: 'texto' })
  })

  // Migration da seção 11 de supabase/schema.sql pode não estar aplicada.
  it('falha de escrita (tabela ausente) não derruba a resposta da rota', async () => {
    state.insertBehavior = 'reject'
    state.rows.codigo = [linhaSelect()]
    const { GET } = await loadRoute()
    const res = await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))
    const data = await res.json()
    expect(res.status ?? 200).toBe(200)
    expect(data.results).toHaveLength(1)
  })

  // Restrição 4: /api/search é a rota mais quente do produto.
  it('não bloqueia a resposta esperando o insert', async () => {
    state.insertBehavior = 'hang'
    state.rows.codigo = [linhaSelect()]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.results).toHaveLength(1)
    expect(state.inserts).toHaveLength(1)
  })

  it('query curta demais não gera evento nem consulta o banco', async () => {
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=a'))).json()
    expect(data.results).toEqual([])
    expect(data.matchType).toBeNull()
    expect(state.inserts).toHaveLength(0)
  })
})

describe('Story 1.7 — valor em R$ do porte anestésico', () => {
  it('AC1: mapeia os 9 valores (0 a 8) para o porte CBHPM correto', async () => {
    const { PORTE_ANESTESICO_PARA_CBHPM } = await loadRoute()
    expect(PORTE_ANESTESICO_PARA_CBHPM).toEqual({
      1: '3A',
      2: '3C',
      3: '4C',
      4: '6B',
      5: '7C',
      6: '9B',
      7: '10C',
      8: '12A',
    })
    // 0 é caso especial ("não participação do anestesiologista") — não mapeia
    // para nenhum porte CBHPM.
    expect(PORTE_ANESTESICO_PARA_CBHPM[0]).toBeUndefined()
  })

  it('AC2: porte_anestesico 4 busca o valor de "6B" na edição do procedimento', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: 4, versao: 'CBHPM 2018' })]
    state.porteValores = [{ versao: 'CBHPM 2018', codigo_porte: '6B', valor: 608 }]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.results[0].valor_porte_anestesico).toBe(608)
  })

  it('AC2: porte_anestesico null não dispara busca em cbhpm_porte_valores', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: null })]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.results[0].valor_porte_anestesico).toBeNull()
  })

  it('AC2: porte_anestesico 0 não dispara busca em cbhpm_porte_valores', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: 0 })]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.results[0].valor_porte_anestesico).toBeNull()
  })

  it('AC2: edição sem valor cadastrado para o porte equivalente resulta em null, não erro', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: 4, versao: 'CBHPM 2018' })]
    state.porteValores = [] // nenhuma linha para "6B" nessa edição
    const { GET } = await loadRoute()
    const res = await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))
    const data = await res.json()
    expect(res.status ?? 200).toBe(200)
    expect(data.results[0].valor_porte_anestesico).toBeNull()
  })

  it('AC2: falha no lookup de porte anestésico não derruba a busca', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: 4, versao: 'CBHPM 2018' })]
    state.porteValoresError = new Error('conexão indisponível')
    const { GET } = await loadRoute()
    const res = await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))
    const data = await res.json()
    expect(res.status ?? 200).toBe(200)
    expect(data.results).toHaveLength(1)
    expect(data.results[0].valor_porte_anestesico).toBeNull()
  })

  it('AC2: busca por edição — não usa valor de outra edição para o mesmo código de porte', async () => {
    state.rows.codigo = [linhaSelect({ porte_anestesico: 4, versao: 'CBHPM 2018' })]
    // "6B" só tem valor cadastrado numa edição DIFERENTE da do procedimento.
    state.porteValores = [{ versao: 'CBHPM 2016', codigo_porte: '6B', valor: 400 }]
    const { GET } = await loadRoute()
    const data = await (await GET(getRequest('http://localhost/api/search?q=4.08.01.03-8'))).json()
    expect(data.results[0].valor_porte_anestesico).toBeNull()
  })
})
