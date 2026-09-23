export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameState = 'READY' | 'RUNNING' | 'FINISHED';
export type BallState = 'idle' | 'running' | 'finished' | 'blocked';

export interface Point { x: number; y: number; z?: number }

export interface MotionSample { time: number; distance: number; speed: number; acceleration: number }

export interface Track {
  id: number;
  color: string;
  name: string;
  path: Point[];
  cumulativeLengths: number[];
  length: number;
  travelDuration: number;
  cumulativeTimes: number[];
  speeds: number[];
  motion?: MotionSample[];
}

export interface Puzzle {
  seed: number;
  difficulty: Difficulty;
  tracks: Track[];
}

export interface Ball {
  trackId: number;
  state: BallState;
  releasedAt: number | null;
  arrivedAt: number | null;
  progress: number;
}

export interface GameResult {
  outcome: 'success' | 'failure';
  spread: number | null;
  stoppedAt: number;
  arrivals: { trackId: number; arrivedAt: number; offset: number }[];
}

export interface ScoreRecord { bestSpread: number | null; attempts: number }
