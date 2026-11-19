import type { WebEntity } from '../entity';
import type { CabinClass, SeatType } from './types';

export interface Seat {
  id: string;
  row: number;
  letter: string;
  type: SeatType;
  occupied: boolean;
}

export interface SeatMap {
  /** Seat letters with '|' marking aisles, e.g. ['A','B','C','|','D','E','F','|','H','J','K']. */
  layout: string[];
  rows: { number: number; exit: boolean; seats: Seat[] }[];
  legend: SeatType[];
}

interface CabinLayout {
  layout: string[];
  rows: [number, number];
  typeFor(row: number, letter: string): SeatType;
  exitRows?: number[];
}

/** Deterministic PRNG so the same flight always shows the same occupied seats. */
function seeded(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const L = (s: string) => s.split('');

/**
 * Mock seat layouts. SQ economy zones follow singaporeair-ancillaries.md §1 (Standard,
 * Forward Zone, Extra Legroom exit rows); Premium Economy adds Solo seats on A350s.
 * Scoot has one paid seat type in Economy plus a ScootPlus cabin on 787s.
 */
function cabinLayout(entity: WebEntity, cabin: CabinClass, aircraft: string): CabinLayout {
  const wide = /787|A350|777|A330/.test(aircraft);
  if (entity === 'SQ') {
    if (cabin === 'business') return { layout: L('A|DF|K'), rows: [11, 18], typeFor: () => 'standard' };
    if (cabin === 'premium_economy') {
      return {
        layout: L('AC|DEFG|HK'),
        rows: [31, 37],
        exitRows: [31],
        typeFor: (row, letter) => (row === 31 ? 'extra_legroom' : /A350/.test(aircraft) && row === 37 && /[AK]/.test(letter) ? 'solo' : 'standard'),
      };
    }
    return {
      layout: wide ? L('ABC|DEF|HJK') : L('ABC|DEF'),
      rows: [41, 66],
      exitRows: [41, 54],
      typeFor: (row) => (row === 41 || row === 54 ? 'extra_legroom' : row <= 46 ? 'forward_zone' : 'standard'),
    };
  }
  if (cabin === 'scootplus') return { layout: L('AC|DEF|HK'), rows: [1, 5], typeFor: () => 'scootplus' };
  return { layout: wide ? L('ABC|DEF|GHJ') : L('ABC|DEF'), rows: [11, 42], exitRows: [24], typeFor: () => 'standard' };
}

export function generateSeatMap(args: { entity: WebEntity; cabin: CabinClass; aircraft: string | null; seed: string }): SeatMap {
  const cl = cabinLayout(args.entity, args.cabin, args.aircraft ?? '');
  const rand = seeded(args.seed);
  const rows: SeatMap['rows'] = [];
  const legend = new Set<SeatType>();
  for (let n = cl.rows[0]; n <= cl.rows[1]; n++) {
    const seats = cl.layout
      .filter((c) => c !== '|')
      .map((letter) => {
        const type = cl.typeFor(n, letter);
        legend.add(type);
        return { id: `${n}${letter}`, row: n, letter, type, occupied: rand() < 0.38 };
      });
    rows.push({ number: n, exit: cl.exitRows?.includes(n) ?? false, seats });
  }
  return { layout: cl.layout, rows, legend: [...legend] };
}

export const SEAT_TYPE_LABEL: Record<SeatType, string> = {
  standard: 'Standard',
  forward_zone: 'Forward Zone',
  extra_legroom: 'Extra Legroom',
  solo: 'Solo',
  scootplus: 'ScootPlus',
};
