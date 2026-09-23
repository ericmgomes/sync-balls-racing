import { PHYSICS } from './config';
import type { MotionSample, Point, Track } from './types';

export function motionProfile(path: Point[], lengths: number[]) {
  const total = lengths[lengths.length - 1];
  const height = (index: number) => path[index].z ?? -path[index].y;
  const motion: MotionSample[] = [{ time: 0, distance: 0, speed: 0, acceleration: 0 }];
  let distance = 0;
  let speed = 0;
  let time = 0;
  let direction = 1;
  let reached = false;

  for (let iteration = 0; iteration < 40000 && time < PHYSICS.maxSimulationMs; iteration++) {
    if (distance >= total - 1e-8) { reached = true; break; }
    let low = 1;
    let high = lengths.length - 1;
    const probe = distance + direction * 1e-7;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (lengths[middle] < probe) low = middle + 1;
      else high = middle;
    }
    const segment = low;
    const slope = (height(segment) - height(segment - 1)) / (lengths[segment] - lengths[segment - 1]);
    const gravity = -PHYSICS.gravity * slope;
    const resistance = PHYSICS.rollingResistance * PHYSICS.gravity * Math.sqrt(Math.max(0, 1 - slope * slope));
    if (Math.abs(speed) < 1e-7) {
      if (Math.abs(gravity) <= resistance) break;
      direction = Math.sign(gravity);
      if (distance <= 0 && direction < 0) break;
    } else direction = Math.sign(speed);

    const acceleration = (gravity - direction * (resistance + PHYSICS.drag * speed * speed)) / PHYSICS.rollingInertia;
    const boundary = direction > 0 ? lengths[segment] : lengths[segment - 1];
    const step = direction * Math.min(PHYSICS.maxSpatialStep, Math.abs(boundary - distance));
    if (Math.abs(step) < 1e-9) {
      // At a vertex, select the segment in the new direction without adding energy.
      distance = Math.max(0, Math.min(total, distance + direction * 1e-8));
      continue;
    }
    const squaredSpeed = speed * speed + 2 * acceleration * step;
    let seconds: number;
    let nextSpeed: number;
    let nextDistance: number;
    if (squaredSpeed < 0) {
      seconds = -speed / acceleration;
      nextSpeed = 0;
      nextDistance = distance + speed * seconds + 0.5 * acceleration * seconds * seconds;
    } else {
      nextSpeed = direction * Math.sqrt(squaredSpeed);
      seconds = 2 * step / (speed + nextSpeed);
      nextDistance = distance + step;
    }
    if (!Number.isFinite(seconds) || seconds <= 0) break;
    motion[motion.length - 1].acceleration = acceleration;
    time += seconds * 1000;
    distance = nextDistance;
    speed = nextSpeed;
    motion.push({ time, distance, speed, acceleration: 0 });
  }
  return {
    travelDuration: reached ? time : Infinity,
    cumulativeTimes: motion.map(sample => sample.time),
    speeds: motion.map(sample => sample.speed),
    motion,
  };
}

export function progressAtTime(track: Track, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  if (elapsedMs >= track.travelDuration) return 1;
  if (track.motion) {
    const samples = track.motion;
    let low = 0;
    let high = samples.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (samples[middle].time <= elapsedMs) low = middle;
      else high = middle - 1;
    }
    const sample = samples[low];
    const seconds = low === samples.length - 1 ? 0 : (elapsedMs - sample.time) / 1000;
    return Math.max(0, Math.min(1, (sample.distance + sample.speed * seconds + 0.5 * sample.acceleration * seconds ** 2) / track.length));
  }
  let low = 1;
  let high = track.cumulativeTimes.length - 1;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (track.cumulativeTimes[middle] < elapsedMs) low = middle + 1;
    else high = middle;
  }
  const seconds = (elapsedMs - track.cumulativeTimes[low - 1]) / 1000;
  const segmentSeconds = (track.cumulativeTimes[low] - track.cumulativeTimes[low - 1]) / 1000;
  const speed = track.speeds[low - 1];
  const acceleration = (track.speeds[low] - speed) / segmentSeconds;
  return Math.max(0, Math.min(1, (track.cumulativeLengths[low - 1] + speed * seconds + 0.5 * acceleration * seconds ** 2) / track.length));
}
