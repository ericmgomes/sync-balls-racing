import { PHYSICS } from '../game/config';
import type { Track } from '../game/types';

type Quaternion = [number, number, number, number];
export type Vector = [number, number, number];
const cache = new WeakMap<Track, Quaternion[]>();

function advance(q: Quaternion, track: Track, segment: number, distance: number): Quaternion {
  const a = track.path[segment - 1];
  const b = track.path[segment];
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!length) return q;
  const halfAngle = distance / PHYSICS.ballRadius / 2;
  const x = -(b.y - a.y) / length * Math.sin(halfAngle);
  const y = (b.x - a.x) / length * Math.sin(halfAngle);
  const w = Math.cos(halfAngle);
  // Rolling axis is perpendicular to the direction of travel and the support normal.
  return [w*q[0]+x*q[3]+y*q[2], w*q[1]+y*q[3]-x*q[2],
    w*q[2]+x*q[1]-y*q[0], w*q[3]-x*q[0]-y*q[1]];
}

export function rollingOrientation(track: Track, progress: number): Quaternion {
  let rotations = cache.get(track);
  if (!rotations) {
    rotations = [[0, 0, 0, 1]];
    for (let i = 1; i < track.path.length; i++) {
      rotations.push(advance(rotations[i-1], track, i, track.cumulativeLengths[i]-track.cumulativeLengths[i-1]));
    }
    cache.set(track, rotations);
  }
  const distance = Math.max(0, Math.min(1, progress)) * track.length;
  let low = 1;
  let high = track.path.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.cumulativeLengths[middle] < distance) low = middle + 1;
    else high = middle;
  }
  return advance(rotations[low-1], track, low, distance-track.cumulativeLengths[low-1]);
}

export function rotateSurface(q: Quaternion, v: Vector): Vector {
  const [x, y, z, w] = q;
  const tx = 2 * (y*v[2]-z*v[1]);
  const ty = 2 * (z*v[0]-x*v[2]);
  const tz = 2 * (x*v[1]-y*v[0]);
  return [v[0]+w*tx+y*tz-z*ty, v[1]+w*ty+z*tx-x*tz, v[2]+w*tz+x*ty-y*tx];
}
