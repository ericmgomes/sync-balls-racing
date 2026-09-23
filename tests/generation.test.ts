import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, WORLD } from '../src/game/config';
import { pointAtProgress } from '../src/game/Track';
import { motionProfile } from '../src/game/Physics';
import type { Difficulty, Track } from '../src/game/types';
import { createSeed, generatePuzzle, parseSeed } from '../src/generation/generatePuzzle';
import { seededRandom } from '../src/generation/seededRandom';

const difficulties: Difficulty[] = ['easy', 'normal', 'hard'];

test('a mesma seed reproduz a sequência aleatória e o puzzle completos', () => {
  for (const seed of [0, 1, 48291, 4294967295]) {
    const randomA = seededRandom(seed);
    const randomB = seededRandom(seed);
    const valuesA = Array.from({ length: 100 }, () => randomA());
    const valuesB = Array.from({ length: 100 }, () => randomB());
    assert.deepEqual(valuesA, valuesB);
    assert.ok(valuesA.every((value) => value >= 0 && value < 1));
    for (const difficulty of difficulties) {
      assert.deepEqual(generatePuzzle(seed, difficulty), generatePuzzle(seed, difficulty));
    }
  }
  assert.notDeepEqual(generatePuzzle(48291), generatePuzzle(48292));
});

test('a seed da URL deve ser um inteiro decimal uint32 canônico', () => {
  for (const value of ['0', '1', '48291', '4294967295']) {
    assert.equal(parseSeed(value), Number(value));
  }
  for (const value of [null, '', ' ', '01', ' 1', '1 ', '-1', '+1', '1.5', '1e3', '0x10', 'NaN', 'Infinity', '4294967296']) {
    assert.equal(parseSeed(value), null, `seed inválida: ${value}`);
  }
  for (let index = 0; index < 20; index++) {
    const seed = createSeed();
    assert.ok(Number.isInteger(seed) && seed >= 0 && seed <= 4294967295);
  }
});

test('300 puzzles respeitam as faixas, a chegada comum e as três dificuldades', () => {
  for (const difficulty of difficulties) {
    const settings = DIFFICULTIES[difficulty];
    const laneWidth = (WORLD.width - WORLD.marginX * 2) / settings.trackCount;
    for (let seed = 0; seed < 100; seed++) {
      const puzzle = generatePuzzle(seed, difficulty);
      assert.equal(puzzle.seed, seed);
      assert.equal(puzzle.difficulty, difficulty);
      assert.equal(puzzle.tracks.length, settings.trackCount);
      assert.equal(new Set(puzzle.tracks.map((track) => track.id)).size, settings.trackCount);
      assert.equal(new Set(puzzle.tracks.map((track) => track.color)).size, settings.trackCount);
      assert.equal(new Set(puzzle.tracks.map((track) => track.travelDuration)).size, settings.trackCount);
      const shapes: string[] = [];

      for (const [index, track] of puzzle.tracks.entries()) {
        const laneStart = WORLD.marginX + index * laneWidth;
        const center = laneStart + laneWidth / 2;
        assert.equal(track.path[0].y, WORLD.startY);
        assert.equal(track.path.at(-1)!.y, WORLD.finishY);
        assert.ok(Math.abs(track.path[0].x - center) < 0.001);
        assert.ok(Math.abs(track.path.at(-1)!.x - center) < 0.001);
        assert.ok(Number.isFinite(track.travelDuration) && track.travelDuration > 0);
        assert.deepEqual(motionProfile(track.path, track.cumulativeLengths), {
          travelDuration: track.travelDuration, cumulativeTimes: track.cumulativeTimes, speeds: track.speeds, motion: track.motion,
        });
        assert.equal(track.cumulativeLengths.length, track.path.length);
        assert.equal(track.cumulativeLengths[0], 0);
        assert.equal(track.cumulativeLengths.at(-1), track.length);
        let measuredLength = 0;

        for (const [pointIndex, point] of track.path.entries()) {
          assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
          assert.ok(point.x >= laneStart + 16 - 0.001 && point.x <= laneStart + laneWidth - 16 + 0.001);
          assert.ok(point.y >= WORLD.startY && point.y <= WORLD.finishY);
          if (pointIndex > 0) {
            const previous = track.path[pointIndex - 1];
            measuredLength += Math.hypot(point.x - previous.x, point.y - previous.y, point.z! - previous.z!);
            assert.ok(track.cumulativeLengths[pointIndex] > track.cumulativeLengths[pointIndex - 1]);
          }
        }
        assert.ok(Math.abs(measuredLength - track.length) < 0.000001);
        assert.ok(track.length > WORLD.finishY - WORLD.startY + 5, 'a pista deve conter curvas');
        shapes.push(JSON.stringify(track.path.map((point) => [Number((point.x - center).toFixed(4)), Number(point.y.toFixed(4))])));
      }
      assert.equal(new Set(shapes).size, settings.trackCount, 'pistas devem ter geometria própria, além da translação');
    }
  }
});

test('interpolação usa a distância ao longo do caminho e limita os extremos', () => {
  const track: Track = {
    id: 0, color: '#ffffff', name: 'Teste', travelDuration: 3000,
    cumulativeTimes: [], speeds: [],
    path: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }],
    cumulativeLengths: [0, 30, 70], length: 70,
  };
  assert.deepEqual(pointAtProgress(track, 0), { x: 0, y: 0 });
  assert.deepEqual(pointAtProgress(track, 3 / 7), { x: 30, y: 0 });
  assert.deepEqual(pointAtProgress(track, 0.5), { x: 30, y: 5 });
  assert.deepEqual(pointAtProgress(track, 1), { x: 30, y: 40 });
  assert.deepEqual(pointAtProgress(track, -1), { x: 0, y: 0 });
  assert.deepEqual(pointAtProgress(track, 2), { x: 30, y: 40 });
});

