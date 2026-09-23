import type { Difficulty } from './types';

export const WORLD = { width: 820, height: 850, startY: 66, finishY: 774, marginX: 110 } as const;

export const BARRIER = { topY: WORLD.finishY - 46, bottomY: WORLD.finishY, clearance: 20 } as const;

// Slow the shared simulation clock, preserving gravity and acceleration profiles.
export const PLAYBACK_RATE = 0.5;
export const simulationTime = (realTime: number) => realTime * PLAYBACK_RATE;

export const PHYSICS = {
  // World distances are millimetres; velocities use mm/s, time uses seconds.
  gravity: 9810,
  ballRadius: 12,
  finishToleranceMs: 30,
  rollingInertia: 1.4,
  rollingResistance: 0.012,
  drag: 0.0000023,
  maxSpatialStep: 1,
  maxSimulationMs: 30000,
} as const;

export const DIFFICULTIES: Record<Difficulty, { trackCount: number }> = {
  easy: { trackCount: 4 },
  normal: { trackCount: 6 },
  hard: { trackCount: 8 },
};

export const TRACK_COLORS = [
  { color: '#ee241b', name: 'Coral' },
  { color: '#ffac00', name: 'Âmbar' },
  { color: '#ffe000', name: 'Dourada' },
  { color: '#00a36a', name: 'Jade' },
  { color: '#245de8', name: 'Azul' },
  { color: '#8441d9', name: 'Lilás' },
  { color: '#dd6ea8', name: 'Rosa' },
  { color: '#35b6bd', name: 'Turquesa' },
] as const;

export const RATINGS = [
  { maxSpread: 10, label: 'PERFEITO', message: 'Um só instante. Sincronia perfeita.' },
  { maxSpread: 30, label: 'ABSURDO', message: 'Você encontrou o ritmo de cada caminho.' },
  { maxSpread: 100, label: 'EXCELENTE', message: 'Quase um encontro perfeito.' },
  { maxSpread: 250, label: 'ÓTIMO', message: 'Você está pegando o ritmo.' },
  { maxSpread: 500, label: 'BOM', message: 'Um pequeno ajuste faz toda a diferença.' },
  { maxSpread: Infinity, label: 'TENTE NOVAMENTE', message: 'Observe quem chegou primeiro. Ajuste e tente de novo.' },
] as const;

export function getRating(spread: number) {
  return RATINGS.find((rating) => spread <= rating.maxSpread) ?? RATINGS[RATINGS.length - 1];
}

