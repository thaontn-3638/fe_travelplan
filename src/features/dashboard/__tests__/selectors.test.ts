import { describe, it, expect } from 'vitest';
import { searchTripsByName } from '../selectors';
import type { TripSummary } from '../types';

function makeTrip(overrides: Partial<TripSummary>): TripSummary {
  return {
    id: 't1',
    name: 'Kyoto 3-Day Trip',
    translationKey: 't1',
    status: 'confirmed',
    startDate: '2026-08-14',
    endDate: '2026-08-16',
    travelers: [],
    extraTravelers: 0,
    budget: 100000,
    spent: 0,
    icon: 'landmark',
    ...overrides,
  };
}

describe('searchTripsByName', () => {
  const trips = [
    makeTrip({ id: 't1', name: 'Kyoto 3-Day Trip' }),
    makeTrip({ id: 't2', name: 'Okinawa & Ishigaki' }),
  ];

  it('matches a case-insensitive substring of the canonical name', () => {
    expect(searchTripsByName(trips, 'kyoto').map((t) => t.id)).toEqual(['t1']);
    expect(searchTripsByName(trips, 'KYOTO').map((t) => t.id)).toEqual(['t1']);
  });

  it('returns an empty array for an empty or whitespace-only query', () => {
    expect(searchTripsByName(trips, '')).toEqual([]);
    expect(searchTripsByName(trips, '   ')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchTripsByName(trips, 'nonexistent')).toEqual([]);
  });

  it('is independent of the active UI locale — it never reads a translated string', () => {
    // The canonical `name` field has no per-locale variants, so results
    // cannot change based on i18n.language the way a translated title would.
    const result = searchTripsByName(trips, 'Okinawa');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Okinawa & Ishigaki');
  });
});
