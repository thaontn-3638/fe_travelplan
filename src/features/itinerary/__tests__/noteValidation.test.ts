import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Trip } from '../../../types';
import { findItemsWithLongNote, isNoteTooLong, MAX_NOTE_LENGTH } from '../utils/itineraryRules';

function item(id: string, note?: string): ItineraryItem {
  return { id, kind: 'place', placeId: 'p1', startTime: null, endTime: null, order: 0, note };
}

function trip(days: Trip['days'], unscheduledItems: ItineraryItem[] = []): Trip {
  return {
    id: 't1',
    name: 'Test',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: '2026-09-20',
    endDate: null,
    status: 'planning',
    travelers: [],
    party: { adults: 1, children: 0 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days,
    unscheduledItems,
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
}

describe('giới hạn độ dài ghi chú', () => {
  it('đúng 100 ký tự vẫn hợp lệ, 101 thì không', () => {
    expect(isNoteTooLong(undefined)).toBe(false);
    expect(isNoteTooLong('x'.repeat(MAX_NOTE_LENGTH))).toBe(false);
    expect(isNoteTooLong('x'.repeat(MAX_NOTE_LENGTH + 1))).toBe(true);
  });

  it('bắt được cả mục ở ngày khác và ở "Chưa xếp ngày"', () => {
    const long = 'x'.repeat(MAX_NOTE_LENGTH + 5);
    const source = trip(
      [
        { id: 'd1', date: '2026-09-20', items: [item('a', 'ngắn')] },
        { id: 'd2', date: '2026-09-21', items: [item('b', long)] },
      ],
      [item('c', long)],
    );

    expect(findItemsWithLongNote(source).map((entry) => entry.id)).toEqual(['b', 'c']);
  });

  it('không có ghi chú dài thì không chặn gì', () => {
    const source = trip([{ id: 'd1', date: '2026-09-20', items: [item('a', 'ok')] }]);
    expect(findItemsWithLongNote(source)).toEqual([]);
  });
});
