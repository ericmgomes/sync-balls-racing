import { PHYSICS } from './config';
import { progressAtTime } from './Physics';
import { barrierContactProgress } from './Track';
import type { Ball, GameResult, GameState, Puzzle } from './types';

export class Game {
  public balls: Ball[];
  public state: GameState = 'READY';
  public startedAt: number | null = null;
  public firstArrivalAt: number | null = null;
  public result: GameResult | null = null;

  constructor(public readonly puzzle: Puzzle) {
    this.balls = this.createBalls();
  }

  release(trackId: number, now = performance.now()): boolean {
    if (!Number.isFinite(now) || !Number.isInteger(trackId)) return false;
    this.update(now);
    if (this.state === 'FINISHED' || this.firstArrivalAt !== null) return false;
    const ball = this.balls.find((candidate) => candidate.trackId === trackId);
    if (!ball || ball.state !== 'idle') return false;
    ball.state = 'running';
    ball.releasedAt = now;
    if (this.startedAt === null) this.startedAt = now;
    this.state = 'RUNNING';
    return true;
  }

  update(now = performance.now()): void {
    if (!Number.isFinite(now) || this.state === 'READY' || this.result?.outcome === 'success') return;
    const scheduled = this.balls.map((ball, index) => ball.releasedAt === null
      ? Infinity : ball.releasedAt + this.puzzle.tracks[index].travelDuration);
    const earliest = Math.min(...scheduled);
    if (now >= earliest) this.firstArrivalAt = earliest;
    const deadline = earliest + PHYSICS.finishToleranceMs;
    const latest = Math.max(...scheduled);
    const success = latest <= deadline && now >= latest;
    const ended = success || now >= deadline;
    const stoppedAt = success ? latest : deadline;

    for (const [index, ball] of this.balls.entries()) {
      if (ball.state === 'finished' || ball.state === 'blocked') continue;
      if (ball.releasedAt !== null) {
        const track = this.puzzle.tracks[index];
        const progress = progressAtTime(track, now - ball.releasedAt);
        const retained = this.firstArrivalAt !== null && scheduled[index] > deadline;
        if (retained) {
          // A faixa fecha sobre quem já entrou nela, sem puxar a bola para trás.
          const stop = Math.max(barrierContactProgress(track), progressAtTime(track, earliest - ball.releasedAt));
          ball.progress = Math.min(progress, stop);
          if (progress >= stop) ball.state = 'blocked';
        } else {
          ball.progress = progress;
        }
        if (!retained && scheduled[index] <= now) {
          ball.progress = 1;
          ball.arrivedAt = scheduled[index];
          ball.state = 'finished';
        }
      }
      if (ended && ball.releasedAt === null) ball.state = 'blocked';
    }

    if (ended && !this.result) {
      this.result = {
        outcome: success ? 'success' : 'failure',
        spread: success ? latest - earliest : null,
        stoppedAt,
        arrivals: this.balls.filter((ball) => ball.arrivedAt !== null).map((ball) => ({
          trackId: ball.trackId, arrivedAt: ball.arrivedAt!, offset: ball.arrivedAt! - earliest,
        })),
      };
      this.state = 'FINISHED';
    }
  }

  elapsed(now = performance.now()): number {
    if (this.startedAt === null) return 0;
    this.update(now);
    return Math.max(0, (this.result?.stoppedAt ?? now) - this.startedAt);
  }

  reset(): void {
    this.balls = this.createBalls();
    this.state = 'READY';
    this.startedAt = null;
    this.firstArrivalAt = null;
    this.result = null;
  }

  private createBalls(): Ball[] {
    return this.puzzle.tracks.map((track) => ({
      trackId: track.id, state: 'idle', releasedAt: null, arrivedAt: null, progress: 0,
    }));
  }
}
