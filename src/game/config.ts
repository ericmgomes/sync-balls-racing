import type { Difficulty } from './types';

export const WORLD = { width: 1000, height: 590, startY: 66, finishY: 514, marginX: 110 } as const;

export const BARRIER = { topY: 468, bottomY: WORLD.finishY, clearance: 20 } as const;

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
  { color: '#f05252', name: 'Coral' },
  { color: '#f49b27', name: 'Âmbar' },
  { color: '#e7c52e', name: 'Dourada' },
  { color: '#36b88b', name: 'Jade' },
  { color: '#359de8', name: 'Azul' },
  { color: '#9060db', name: 'Lilás' },
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

