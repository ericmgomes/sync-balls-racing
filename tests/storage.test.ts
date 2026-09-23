import test from 'node:test';
import assert from 'node:assert/strict';
import { readScore, saveResult, startAttempt } from '../src/storage/scores';
import type { ScoreStorage } from '../src/storage/scores';

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: ScoreStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
  };
  return { data, storage };
}

const scoreKey = (seed: number, difficulty = 'normal') => `sincrono:scores:v4:${difficulty}:${seed}`;

test('tentativas e recorde persistem sem resultados piores apagarem o melhor', () => {
  const { data, storage } = memoryStorage();
  assert.deepEqual(readScore(48291, 'normal', storage), { attempts: 0, bestSpread: null });
  assert.deepEqual(startAttempt(48291, 'normal', storage), { attempts: 1, bestSpread: null });
  assert.deepEqual(saveResult(48291, 45.125, 'normal', storage), { attempts: 1, bestSpread: 45.125 });
  assert.deepEqual(startAttempt(48291, 'normal', storage), { attempts: 2, bestSpread: 45.125 });
  assert.deepEqual(saveResult(48291, 70, 'normal', storage), { attempts: 2, bestSpread: 45.125 });
  assert.deepEqual(saveResult(48291, 0, 'normal', storage), { attempts: 2, bestSpread: 0 });
  assert.deepEqual(JSON.parse(data.get(scoreKey(48291))!), { attempts: 2, bestSpread: 0 });
  const reloaded: ScoreStorage = { getItem: storage.getItem, setItem: storage.setItem };
  assert.deepEqual(readScore(48291, 'normal', reloaded), { attempts: 2, bestSpread: 0 });
});

test('históricos de seeds e dificuldades diferentes ficam isolados', () => {
  const { storage } = memoryStorage();
  startAttempt(1, 'normal', storage);
  saveResult(1, 20, 'normal', storage);
  startAttempt(1, 'hard', storage);
  saveResult(1, 400, 'hard', storage);
  assert.deepEqual(readScore(1, 'normal', storage), { attempts: 1, bestSpread: 20 });
  assert.deepEqual(readScore(1, 'hard', storage), { attempts: 1, bestSpread: 400 });
  assert.deepEqual(readScore(1, 'easy', storage), { attempts: 0, bestSpread: null });
  assert.deepEqual(readScore(2, 'normal', storage), { attempts: 0, bestSpread: null });
});

test('dados corrompidos ou de tipos inesperados não interrompem a partida', () => {
  for (const raw of ['{quebrado', 'null', '[]', 'true', '42', '"texto"', '{"bestSpread":-2,"attempts":-1}', '{"bestSpread":"20","attempts":2.5}', '{"bestSpread":1e309,"attempts":1e309}']) {
    const { data, storage } = memoryStorage();
    data.set(scoreKey(12), raw);
    assert.deepEqual(readScore(12, 'normal', storage), { attempts: 0, bestSpread: null }, raw);
    assert.deepEqual(startAttempt(12, 'normal', storage), { attempts: 1, bestSpread: null });
    assert.deepEqual(saveResult(12, 25, 'normal', storage), { attempts: 1, bestSpread: 25 });
  }
});

test('resultados inválidos são ignorados e campos válidos de histórico são preservados', () => {
  const { data, storage } = memoryStorage();
  data.set(scoreKey(12), '{"bestSpread":27,"attempts":"inválido"}');
  assert.deepEqual(readScore(12, 'normal', storage), { attempts: 0, bestSpread: 27 });
  for (const spread of [-1, Number.NaN, Infinity, -Infinity]) {
    assert.deepEqual(saveResult(12, spread, 'normal', storage), { attempts: 0, bestSpread: 27 });
  }
  data.set(scoreKey(12), '{"bestSpread":null,"attempts":9007199254740991}');
  assert.equal(startAttempt(12, 'normal', storage).attempts, Number.MAX_SAFE_INTEGER);
});

test('armazenamento bloqueado mantém a sessão em memória', () => {
  const storage: ScoreStorage = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
  };
  assert.deepEqual(startAttempt(88, 'normal', storage), { attempts: 1, bestSpread: null });
  saveResult(88, 31, 'normal', storage);
  startAttempt(88, 'normal', storage);
  assert.deepEqual(readScore(88, 'normal', storage), { attempts: 2, bestSpread: 31 });
  const independent: ScoreStorage = { ...storage };
  assert.deepEqual(readScore(88, 'normal', independent), { attempts: 0, bestSpread: null });
});

test('falha de escrita não faz uma leitura antiga apagar os resultados da sessão', () => {
  const data = new Map([[scoreKey(7), '{"bestSpread":100,"attempts":3}']]);
  let writable = false;
  const storage: ScoreStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      if (!writable) throw new Error('QuotaExceededError');
      data.set(key, value);
    },
  };
  assert.deepEqual(startAttempt(7, 'normal', storage), { attempts: 4, bestSpread: 100 });
  saveResult(7, 40, 'normal', storage);
  assert.deepEqual(readScore(7, 'normal', storage), { attempts: 4, bestSpread: 40 });
  writable = true;
  assert.deepEqual(startAttempt(7, 'normal', storage), { attempts: 5, bestSpread: 40 });
  assert.deepEqual(JSON.parse(data.get(scoreKey(7))!), { attempts: 5, bestSpread: 40 });
});

test('ler um recorde retorna uma cópia, sem permitir mutações acidentais no cache', () => {
  const storage: ScoreStorage = {
    getItem: () => { throw new Error('bloqueado'); },
    setItem: () => { throw new Error('bloqueado'); },
  };
  const record = startAttempt(42, 'normal', storage);
  record.attempts = 999;
  record.bestSpread = -1;
  assert.deepEqual(readScore(42, 'normal', storage), { attempts: 1, bestSpread: null });
});


