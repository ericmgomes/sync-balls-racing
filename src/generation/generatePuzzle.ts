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

function cubic(a: Point, b: Point, c: Point, d: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function sweep(anchors: Point[]): Point[] {
  const path = [anchors[0]];
  for (let index = 1; index < anchors.length; index++) {
    const start = anchors[index - 1];
    const end = anchors[index];
    const bend = (end.y - start.y) * 0.56;
    for (let sample = 1; sample <= 48; sample++) {
      path.push(cubic(start, { x: start.x, y: start.y + bend }, { x: end.x, y: end.y - bend }, end, sample / 48));
    }
  }
  return path;
}

function mix(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function roundedZigzag(anchors: Point[]): Point[] {
  const path = [anchors[0]];
  for (let index = 1; index < anchors.length - 1; index++) {
    const corner = anchors[index];
    const entry = mix(corner, anchors[index - 1], 0.27);
    const exit = mix(corner, anchors[index + 1], 0.27);
    path.push(entry);
    for (let sample = 1; sample <= 24; sample++) {
      const t = sample / 24;
      path.push(mix(mix(entry, corner, t), mix(corner, exit, t), t));
    }
  }
  path.push(anchors[anchors.length - 1]);
  return path;
}

function makeFamily(family: number, random: Random): Point[] {
  const start = { x: 0, y: 0 };
  const finish = { x: 0, y: 1 };
  const sway = 0.76 + random() * 0.17;
  const shift = (random() - 0.5) * 0.06;

  switch (family) {
    case 0:
      return sweep([start, { x: -sway, y: 0.25 + shift }, { x: sway, y: 0.71 + shift }, finish]);
    case 1:
      return sweep([start, { x: sway, y: 0.16 }, { x: -sway, y: 0.37 + shift }, { x: sway, y: 0.60 }, { x: -sway, y: 0.82 + shift }, finish]);
    case 2:
      return roundedZigzag([
        start, { x: 0, y: 0.11 }, { x: -sway, y: 0.11 }, { x: -sway, y: 0.32 + shift },
        { x: sway, y: 0.32 + shift }, { x: sway, y: 0.59 }, { x: -sway, y: 0.59 },
        { x: -sway, y: 0.85 }, { x: 0, y: 0.85 }, finish,
      ]);
    case 3: {
      const loopDepth = 0.27 + random() * 0.035;
      return Array.from({ length: 401 }, (_, index) => {
        const t = index / 400;
        const angle = t * Math.PI * 2;
        return {
          x: (-0.45 * (1 - Math.cos(angle)) + 0.50 * (1 - Math.cos(angle * 2))) * sway,
          y: t + Math.sin(angle) * loopDepth,
        };
      });
    }
    case 4:
      return sweep([start, { x: sway, y: 0.14 }, { x: -sway, y: 0.31 + shift }, { x: sway, y: 0.48 }, { x: -sway * 0.22, y: 0.77 }, finish]);
    case 5:
      return roundedZigzag([
        start, { x: sway, y: 0.15 }, { x: -sway, y: 0.34 + shift },
        { x: sway, y: 0.53 }, { x: -sway, y: 0.72 + shift }, { x: sway * 0.4, y: 0.89 }, finish,
      ]);
    case 6:
      return sweep([start, { x: sway * 0.18, y: 0.26 }, { x: sway, y: 0.46 + shift }, { x: -sway, y: 0.64 }, { x: sway, y: 0.82 }, finish]);
    default:
      return roundedZigzag([
        start, { x: -sway, y: 0.13 }, { x: -sway, y: 0.65 }, { x: -sway * 0.12, y: 0.65 },
        { x: -sway * 0.12, y: 0.29 }, { x: sway, y: 0.29 }, { x: sway, y: 0.85 }, finish,
      ]);
  }
}

function geometry(family: number, centerX: number, halfWidth: number, random: Random): Pick<Track, 'path' | 'cumulativeLengths' | 'length'> {
  const mirror = random() < 0.5 ? -1 : 1;
  const path = makeFamily(family, random).map((point) => ({
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
    { t: 0.14 + random() * 0.04, z: 60 + random() * 15 },
    { t: 0.30 + random() * 0.04, z: 125 + random() * 20 },
    { t: 0.48 + random() * 0.03, z: 24 + random() * 12 },
    { t: 0.63 + random() * 0.03, z: 80 + random() * 20 },
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
