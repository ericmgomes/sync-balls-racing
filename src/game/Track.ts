import type { Point, Track } from './types';
import { BARRIER, WORLD } from './config';

export function barrierContactProgress(track: Track): number {
  const start = track.path[0];
  const end = track.path[track.path.length - 1];
  const fraction = (BARRIER.topY - BARRIER.clearance - WORLD.startY) / (WORLD.finishY - WORLD.startY);
  const stopY = start.y + (end.y - start.y) * fraction;
  for (let index = track.path.length - 1; index > 0; index--) {
    const before = track.path[index - 1];
    const after = track.path[index];
    if (before.y <= stopY && after.y > stopY) {
      const segmentFraction = (stopY - before.y) / (after.y - before.y);
      return (track.cumulativeLengths[index - 1] + segmentFraction * (track.cumulativeLengths[index] - track.cumulativeLengths[index - 1])) / track.length;
    }
  }
  return 0;
}

export function pointAtProgress(track: Track, progress: number): Point {
  const { path, cumulativeLengths, length } = track;
  if (path.length === 0) return { x: 0, y: 0 };
  if (progress <= 0 || Number.isNaN(progress) || length === 0) return { ...path[0] };
  if (progress >= 1) return { ...path[path.length - 1] };

  const distance = progress * length;
  let low = 1;
  let high = cumulativeLengths.length - 1;

  while (low < high) {
    const middle = (low + high) >>> 1;
    if (cumulativeLengths[middle] < distance) low = middle + 1;
    else high = middle;
  }

  const before = path[low - 1];
  const after = path[low];
  const segmentLength = cumulativeLengths[low] - cumulativeLengths[low - 1];
  const fraction = segmentLength > 0 ? (distance - cumulativeLengths[low - 1]) / segmentLength : 0;

  return {
    x: before.x + (after.x - before.x) * fraction,
    y: before.y + (after.y - before.y) * fraction,
    ...(before.z === undefined ? {} : { z: before.z + (after.z! - before.z) * fraction }),
  };
}
