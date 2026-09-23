import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game/Game';
import { PHYSICS } from '../src/game/config';
import { barrierContactProgress, pointAtProgress } from '../src/game/Track';
import { generatePuzzle } from '../src/generation/generatePuzzle';
import { progressAtTime } from '../src/game/Physics';
import { BARRIER } from '../src/game/config';
import type { Puzzle } from '../src/game/types';

function puzzle(durations: number[]): Puzzle {
  return {
    seed: 48291, difficulty: 'normal',
    tracks: durations.map((travelDuration, id) => {
      const seconds = travelDuration / 1000;
      const length = 0.5 * PHYSICS.gravity * seconds ** 2;
      return {
        id, color: '#ffffff', name: `Pista ${id}`, travelDuration,
        path: [{ x: id * 10, y: 0 }, { x: id * 10, y: length }],
        cumulativeLengths: [0, length], length,
        cumulativeTimes: [0, travelDuration], speeds: [0, PHYSICS.gravity * seconds],
      };
    }),
  };
}

test('bolas partem do repouso e aceleram, em vez de viajar a velocidade constante', () => {
  const game = new Game(puzzle([2000, 4000]));
  assert.equal(game.state, 'READY');
  assert.equal(game.elapsed(1000), 0);
  game.release(0, 100);
  game.update(1100);
  assert.equal(game.balls[0].progress, 0.25);
  assert.equal(game.balls[1].state, 'idle');
  assert.equal(game.elapsed(1100), 1000);
});

test('primeira chegada fecha a prova; um frame atrasado não deixa as outras concluírem', () => {
  const game = new Game(puzzle([2000, 4000]));
  game.release(0, 100.125);
  game.release(1, 500.375);
  game.update(50000);
  assert.equal(game.state, 'FINISHED');
  assert.equal(game.result!.outcome, 'failure');
  assert.equal(game.result!.spread, null);
  assert.deepEqual(game.balls.map(ball => ball.arrivedAt), [2100.125, null]);
  assert.equal(game.balls[1].state, 'blocked');
  assert.ok(game.balls[1].progress > 0 && game.balls[1].progress < 1);
  assert.equal(game.elapsed(60000), 2000 + PHYSICS.finishToleranceMs);
  const frozen = structuredClone(game.balls);
  game.update(100000);
  assert.deepEqual(game.balls, frozen);
});

test('frequência de frames não muda o resultado nem a posição de bloqueio', () => {
  const frequent = new Game(puzzle([2000, 4000]));
  const stalled = new Game(puzzle([2000, 4000]));
  for (const game of [frequent, stalled]) { game.release(0, 100); game.release(1, 400); }
  for (let now = 400; now < 5000; now += 16.67) frequent.update(now);
  stalled.update(60000);
  assert.deepEqual(frequent.result, stalled.result);
  assert.deepEqual(frequent.balls, stalled.balls);
});

test('liberações ideais concluem a prova com todas juntas', () => {
  const game = new Game(puzzle([5000, 2000, 4000, 3000]));
  for (const [id, now] of [[0, 100], [2, 1100], [3, 2100], [1, 3100]]) game.release(id, now);
  game.update(5099.99);
  assert.equal(game.state, 'RUNNING');
  game.update(5100);
  assert.equal(game.result!.outcome, 'success');
  assert.equal(game.result!.spread, 0);
  assert.ok(game.balls.every(ball => ball.arrivedAt === 5100));
});

test('a tolerância é inclusiva e uma bola fora dela não conclui', () => {
  for (const offset of [PHYSICS.finishToleranceMs - 0.01, PHYSICS.finishToleranceMs, PHYSICS.finishToleranceMs + 0.01]) {
    const game = new Game(puzzle([2000, 2000]));
    game.release(0, 0);
    game.release(1, offset);
    game.update(50000);
    assert.equal(game.result!.outcome, offset <= PHYSICS.finishToleranceMs ? 'success' : 'failure');
    assert.equal(game.balls[1].state, offset <= PHYSICS.finishToleranceMs ? 'finished' : 'blocked');
  }
});

test('bola não liberada perde; não se pode liberar depois da primeira chegada', () => {
  const game = new Game(puzzle([2000, 3000]));
  assert.equal(game.release(999, 0), false);
  game.release(0, 100);
  assert.equal(game.release(0, 200), false);
  assert.equal(game.balls[0].releasedAt, 100);
  assert.equal(game.release(1, 2100), false);
  game.update(10000);
  assert.equal(game.result!.outcome, 'failure');
  assert.equal(game.balls[1].state, 'blocked');
  assert.equal(game.balls[1].progress, 0);
  assert.equal(game.release(1, 12000), false);
});

test('liberação após prazo é rejeitada mesmo sem frame intermediário', () => {
  const game = new Game(puzzle([2000, 3000]));
  game.release(0, 0);
  assert.equal(game.release(1, 50000), false);
  assert.equal(game.state, 'FINISHED');
  assert.equal(game.balls[1].releasedAt, null);
});

test('reinício limpa o bloqueio e preserva a geometria', () => {
  const original = puzzle([2000, 3000]);
  const game = new Game(original);
  game.release(0, 100);
  game.update(10000);
  game.reset();
  assert.equal(game.state, 'READY');
  assert.equal(game.firstArrivalAt, null);
  assert.equal(game.result, null);
  assert.deepEqual(game.puzzle, original);
  assert.ok(game.balls.every(ball => ball.state === 'idle' && ball.progress === 0 && ball.arrivedAt === null));
  assert.equal(game.release(1, 15000), true);
});

test('após a derrota, bolas continuam até a faixa e ficam retidas antes da chegada', () => {
  const game = new Game(puzzle([2000, 4000]));
  game.release(0, 0);
  game.release(1, 0);
  game.update(2031);
  assert.equal(game.result!.outcome, 'failure');
  assert.equal(game.balls[1].state, 'running');
  const before = game.balls[1].progress;
  game.update(2500);
  assert.ok(game.balls[1].progress > before);
  assert.equal(game.elapsed(2500), 2030);
  game.update(10000);
  assert.equal(game.balls[1].progress, barrierContactProgress(game.puzzle.tracks[1]));
  assert.equal(game.balls[1].state, 'blocked');
  assert.equal(game.balls[1].arrivedAt, null);
});

test('uma bola já dentro da faixa fica retida sem voltar para trás', () => {
  const game = new Game(puzzle([2000, 2040]));
  game.release(0, 0);
  game.release(1, 0);
  const atClosure = progressAtTime(game.puzzle.tracks[1], 2000);
  assert.ok(atClosure > barrierContactProgress(game.puzzle.tracks[1]));
  game.update(10000);
  assert.equal(game.balls[1].progress, atClosure);
  assert.equal(game.balls[1].arrivedAt, null);
});

test('pistas geradas encontram a faixa na altura desenhada', () => {
  for (let seed = 0; seed < 100; seed++) {
    for (const track of generatePuzzle(seed).tracks) {
      const progress = barrierContactProgress(track);
      assert.ok(progress > 0 && progress < 1);
      const point = pointAtProgress(track, progress);
      assert.ok(Math.abs(point.y - (BARRIER.topY - BARRIER.clearance)) < 1e-7);
    }
  }
});
