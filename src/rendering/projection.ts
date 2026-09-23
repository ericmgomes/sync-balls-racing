import { PHYSICS, WORLD } from '../game/config';
import type { Point } from '../game/types';
export const BALL_LIFT = PHYSICS.ballRadius;
export function projectPoint(point: Point, lift = 0): Point {
    const u = point.x / WORLD.width;
    const v = point.y / WORLD.height;
    return {
        x: 0.5 + (u - 0.5) * (0.72 + 0.23 * v) + 0.035 * (1 - v),
        y: 0.21 + 0.64 * v + 0.035 * (u - 0.5) - ((point.z ?? 0) + lift) / WORLD.height * 0.5,
    };
}
