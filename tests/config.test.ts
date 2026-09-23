import test from 'node:test';
import assert from 'node:assert/strict';
import { getRating } from '../src/game/config';

test('classificação respeita todos os limites inclusivos em milissegundos', () => {
  const examples = [
    [0, 'PERFEITO'], [10, 'PERFEITO'], [10.01, 'ABSURDO'],
    [30, 'ABSURDO'], [30.01, 'EXCELENTE'], [100, 'EXCELENTE'],
    [100.01, 'ÓTIMO'], [250, 'ÓTIMO'], [250.01, 'BOM'],
    [500, 'BOM'], [500.01, 'TENTE NOVAMENTE'],
  ] as const;

  for (const [spread, expected] of examples) {
    assert.equal(getRating(spread).label, expected, `spread=${spread}`);
  }
});
