import { DIFFICULTIES, TRACK_COLORS, WORLD } from '../game/config';
import type { Difficulty, Point, Puzzle, Track } from '../game/types';
import { seededRandom } from './seededRandom';
import { motionProfile } from '../game/Physics';

type Random = () => number;

function shuffled<T>(values: T[], random: Random): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function mix(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function roundedZigzag(anchors: Point[], halfWidth: number): Point[] {
  const path = [anchors[0]];
  for (let index = 1; index < anchors.length - 1; index++) {
    const corner = anchors[index];
    const span = (p: Point) => Math.hypot((p.x-corner.x)*halfWidth,(p.y-corner.y)*(WORLD.finishY-WORLD.startY));
    const radius = Math.min(26,span(anchors[index-1])*.4,span(anchors[index+1])*.4);
    const entry = mix(corner, anchors[index - 1], radius/span(anchors[index-1]));
    const exit = mix(corner, anchors[index + 1], radius/span(anchors[index+1]));
    path.push(entry);
    for (let sample = 1; sample <= 24; sample++) {
      const t = sample / 24;
      path.push(mix(mix(entry, corner, t), mix(corner, exit, t), t));
    }
  }
  path.push(anchors[anchors.length - 1]);
  return path;
}

function makeFamily(family: number, random: Random, halfWidth: number): Point[] {
  const steps = 3 + family % 4;
  const sway = 0.58 + random() * 0.10;
  const anchors: Point[] = [{x:0,y:0}, {x:0,y:0.07}];
  let previousY = 0.07;
  for (let step = 0; step < steps; step++) {
    const sign = step % 2 === 0 ? 1 : -1;
    const x = sign * sway * (family >= 4 && step % 2 ? 0.72 : 1);
    anchors.push({x,y:previousY});
    const y = 0.07 + (step + 1) * (0.82 / steps) + (random() - .5) * .025;
    anchors.push({x,y});
    previousY = y;
  }
  anchors.push({x:0,y:previousY}, {x:0,y:1});
  return roundedZigzag(anchors,halfWidth);
}
function geometry(family: number, centerX: number, halfWidth: number, random: Random): Pick<Track, 'path' | 'cumulativeLengths' | 'length'> {
  const mirror = random() < 0.5 ? -1 : 1;
  const path = makeFamily(family, random, halfWidth).map((point) => ({
    x: centerX + point.x * halfWidth * mirror,
    y: WORLD.startY + point.y * (WORLD.finishY - WORLD.startY),
  }));
  path[0] = { x: centerX, y: WORLD.startY };
  path[path.length - 1] = { x: centerX, y: WORLD.finishY };

  const planarLengths = [0];
  for (let i = 1; i < path.length; i++) {
    planarLengths.push(planarLengths[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
  }
  const profile = [
    { t: 0, z: 180 },
    { t: 0.14 + random() * 0.04, z: 100 + random() * 10 },
    { t: 0.30 + random() * 0.04, z: 125 + random() * 10 },
    { t: 0.48 + random() * 0.03, z: 45 + random() * 10 },
    { t: 0.63 + random() * 0.03, z: 70 + random() * 10 },
    { t: 0.83, z: 10 },
    { t: 1, z: 0 },
  ];
  const raisedPath: Point[] = [];
  // Subdivide straight spans too, so every hill is represented in the geometry.
  for (let index = 1; index < path.length; index++) {
    const before = path[index - 1];
    const after = path[index];
    const steps = Math.max(1, Math.ceil((planarLengths[index] - planarLengths[index - 1]) / 3));
    for (let sample = index === 1 ? 0 : 1; sample <= steps; sample++) {
      const fraction = sample / steps;
      const t = (planarLengths[index - 1] + fraction * (planarLengths[index] - planarLengths[index - 1])) / planarLengths[planarLengths.length - 1];
      let segment = 1;
      while (segment < profile.length - 1 && profile[segment].t < t) segment++;
      const a = profile[segment - 1];
      const b = profile[segment];
      const u = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
      const smooth = segment === 1 ? u : u * u * (3 - 2 * u);
      raisedPath.push({ x: before.x + fraction * (after.x - before.x), y: before.y + fraction * (after.y - before.y), z: a.z + (b.z - a.z) * smooth });
    }
  }

  const cumulativeLengths = [0];
  for (let index = 1; index < raisedPath.length; index++) {
    cumulativeLengths.push(cumulativeLengths[index - 1] + Math.hypot(raisedPath[index].x - raisedPath[index - 1].x, raisedPath[index].y - raisedPath[index - 1].y, raisedPath[index].z! - raisedPath[index - 1].z!));
  }

  return { path: raisedPath, cumulativeLengths, length: cumulativeLengths[cumulativeLengths.length - 1] };
}

export function generatePuzzle(seed: number, difficulty: Difficulty = 'normal'): Puzzle {
  const normalizedSeed = seed >>> 0;
  const geometryRandom = seededRandom(normalizedSeed ^ 0x7f4a7c15);
  const { trackCount } = DIFFICULTIES[difficulty];
  const families = shuffled([0, 1, 2, 3, 4, 5, 6, 7], geometryRandom);
  const width = (WORLD.width - WORLD.marginX * 2) / trackCount;

  return {
    seed: normalizedSeed,
    difficulty,
    tracks: Array.from({ length: trackCount }, (_, id) => {
      let shape = geometry(families[id], WORLD.marginX + width * (id + 0.5), width / 2 - 16, geometryRandom);
      let motion = motionProfile(shape.path, shape.cumulativeLengths);
      const original = shape;
      for (let attempt = 1; !Number.isFinite(motion.travelDuration) && attempt <= 12; attempt++) {
        const relief = attempt === 12 ? 0 : 0.85 ** attempt;
        const path = original.path.map((point, index) => ({
          ...point,
          z: point.z! * relief + 180 * (1 - original.cumulativeLengths[index] / original.length) * (1 - relief),
        }));
        const cumulativeLengths = [0];
        for (let index = 1; index < path.length; index++) {
          const a = path[index - 1];
          const b = path[index];
          cumulativeLengths.push(cumulativeLengths[index - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
        }
        shape = { path, cumulativeLengths, length: cumulativeLengths[cumulativeLengths.length - 1] };
        motion = motionProfile(shape.path, shape.cumulativeLengths);
      }
      if (!Number.isFinite(motion.travelDuration)) throw new Error('Não foi possível gerar uma pista percorrível.');
      return {
      id,
      color: TRACK_COLORS[id].color,
      name: TRACK_COLORS[id].name,
      ...shape,
      ...motion,
      };
    }),
  };
}

export function createSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function parseSeed(value: string | null): number | null {
  if (value === null || !/^(0|[1-9]\d{0,9})$/.test(value)) return null;
  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed <= 0xffffffff ? seed : null;
}
