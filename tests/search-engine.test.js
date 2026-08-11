import assert from 'node:assert';
import { test, describe } from 'node:test';
import { CBHPMSearchEngine } from '../src/services/search-engine.js';
import { CBHPMAssistantRAG } from '../src/services/rag-assistant.js';
import { CBHPMDataLoader } from '../src/services/data-loader.js';

describe('CBHPM Search Engine Tests', () => {
  const engine = new CBHPMSearchEngine();

  test('Busca exata por código numérico com pontuação/traço', () => {
    const results = engine.search('3.10.02.01-0');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].codigo, '3.10.02.01-0');
    assert.strictEqual(results[0].porte, '9A');
    assert.strictEqual(results[0].valorPorteR$, 4290.00);
  });

  test('Busca por código sem formatação (apenas números)', () => {
    const results = engine.search('31002010');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].codigo, '3.10.02.01-0');
  });

  test('Busca semântica por descrição de procedimento (ex: próstata)', () => {
    const results = engine.search('ressecção próstata');
    assert.ok(results.length >= 1);
    assert.strictEqual(results[0].codigo, '3.10.02.01-0');
  });

  test('Cálculo determinístico de Porte e UCO', () => {
    const results = engine.search('4.08.08.04-1'); // RX Tórax
    assert.strictEqual(results[0].porte, '1C');
    assert.strictEqual(results[0].valorPorteR$, 66.00);
    assert.strictEqual(results[0].valorUcoR$, 5.20 * 12.50); // 65.00
    assert.strictEqual(results[0].valorTotalR$, 66.00 + 65.00); // 131.00
  });
});

describe('CBHPM Assistant RAG Tests', () => {
  const engine = new CBHPMSearchEngine();
  const assistant = new CBHPMAssistantRAG(engine);

  test('Processamento de mensagem vazia', async () => {
    const res = await assistant.processQuery('');
    assert.ok(res.text.includes('Como posso ajudar'));
  });

  test('Resposta estilo Claude para procedimento específico', async () => {
    const res = await assistant.processQuery('3.01.01.00-7');
    assert.ok(res.text.includes('Biópsia de pele'));
    assert.strictEqual(res.cards.length, 1);
    assert.strictEqual(res.cards[0].porte, '3C');
  });
});

describe('CBHPM Data Loader Tests', () => {
  test('Parsing de CSV de tabela customizada', () => {
    const csvData = `codigo;procedimento;porte;uco\n9.99.99.99-9;Procedimento Teste Especial;5A;10.0`;
    const parsed = CBHPMDataLoader.parseCSV(csvData, 'Tabela Teste');

    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].codigo, '9.99.99.99-9');
    assert.strictEqual(parsed[0].procedimento, 'Procedimento Teste Especial');
    assert.strictEqual(parsed[0].porte, '5A');
    assert.strictEqual(parsed[0].uco, 10.0);
  });
});
