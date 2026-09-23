import type { Difficulty, ScoreRecord } from '../game/types';

export type ScoreStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface ScoreCache {
  records: Map<string, ScoreRecord>;
  pending: Set<string>;
}

const createCache = (): ScoreCache => ({ records: new Map(), pending: new Set() });
const browserCache = createCache();
const injectedCaches = new WeakMap<ScoreStorage, ScoreCache>();
const emptyRecord = (): ScoreRecord => ({ bestSpread: null, attempts: 0 });

function context(injected?: ScoreStorage | null): { storage: ScoreStorage | null; cache: ScoreCache } {
  if (injected) {
    let cache = injectedCaches.get(injected);
    if (!cache) {
      cache = createCache();
      injectedCaches.set(injected, cache);
    }
    return { storage: injected, cache };
  }
  if (injected === null) return { storage: null, cache: browserCache };
  try {
    return { storage: typeof localStorage === 'undefined' ? null : localStorage, cache: browserCache };
  } catch {
    return { storage: null, cache: browserCache };
  }
}

function keyFor(seed: number, difficulty: Difficulty): string {
  return `sincrono:scores:v4:${difficulty}:${seed}`;
}

function decode(raw: string | null): ScoreRecord {
  if (raw === null) return emptyRecord();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyRecord();
    const record = value as Partial<ScoreRecord>;
    return {
      bestSpread: typeof record.bestSpread === 'number' && Number.isFinite(record.bestSpread) && record.bestSpread >= 0
        ? record.bestSpread
        : null,
      attempts: typeof record.attempts === 'number' && Number.isSafeInteger(record.attempts) && record.attempts >= 0
        ? record.attempts
        : 0,
    };
  } catch {
    return emptyRecord();
  }
}

export function readScore(seed: number, difficulty: Difficulty = 'normal', storage?: ScoreStorage | null): ScoreRecord {
  const { storage: backend, cache } = context(storage);
  const key = keyFor(seed, difficulty);
  if (backend && !cache.pending.has(key)) {
    try {
      const record = decode(backend.getItem(key));
      cache.records.set(key, record);
      return { ...record };
    } catch {
      // Private browsing and quota/security restrictions must not interrupt a round.
    }
  }
  return { ...(cache.records.get(key) ?? emptyRecord()) };
}

function writeScore(seed: number, difficulty: Difficulty, record: ScoreRecord, storage?: ScoreStorage | null): ScoreRecord {
  const { storage: backend, cache } = context(storage);
  const key = keyFor(seed, difficulty);
  cache.records.set(key, { ...record });
  cache.pending.add(key);
  try {
    if (backend) {
      backend.setItem(key, JSON.stringify(record));
      cache.pending.delete(key);
    }
  } catch {
    // The cached value remains authoritative after a failed write.
  }
  return { ...record };
}

export function startAttempt(seed: number, difficulty: Difficulty = 'normal', storage?: ScoreStorage | null): ScoreRecord {
  const record = readScore(seed, difficulty, storage);
  record.attempts = Math.min(Number.MAX_SAFE_INTEGER, record.attempts + 1);
  return writeScore(seed, difficulty, record, storage);
}

export function saveResult(seed: number, spread: number, difficulty: Difficulty = 'normal', storage?: ScoreStorage | null): ScoreRecord {
  const record = readScore(seed, difficulty, storage);
  if (!Number.isFinite(spread) || spread < 0) return record;
  record.bestSpread = record.bestSpread === null ? spread : Math.min(record.bestSpread, spread);
  return writeScore(seed, difficulty, record, storage);
}


