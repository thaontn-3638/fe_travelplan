import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Trip } from '../../../types';
import {
  canResolveConflictsByPushingDown,
  normalizeEndDate,
  swapDays,
} from '../utils/itineraryRules';

function item(id: string, startTime: string | null = null, endTime: string | null = null): ItineraryItem {
  return { id, kind: 'place', placeId: 'p1', startTime, endTime, order: 0 };
}

function trip(days: Trip['days']): Trip {
  return {
    id: 't1',
    name: 'Test',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: days[0]!.date,
    endDate: days.length > 1 ? days[days.length - 1]!.date : null,
    status: 'planning',
    travelers: [],
    party: { adults: 1, children: 0 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days,
    unscheduledItems: [],
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
}

describe('chuẩn hoá khoảng ngày', () => {
  it('ngày về trùng ngày đi cũng là trip 1 ngày', () => {
    expect(normalizeEndDate('2026-09-20', '2026-09-20')).toBeNull();
    expect(normalizeEndDate('2026-09-20', null)).toBeNull();
    expect(normalizeEndDate('2026-09-20', '2026-09-22')).toBe('2026-09-22');
  });
});

describe('đổi plan hai ngày', () => {
  it('ngày giữ nguyên date, toàn bộ item hoán vị', () => {
    const source = trip([
      { id: 'd1', date: '2026-09-20', items: [item('a'), item('b')] },
      { id: 'd2', date: '2026-09-21', items: [] },
      { id: 'd3', date: '2026-09-22', items: [item('c')] },
    ]);

    const next = swapDays(source, 'd1', 'd3');

    expect(next.days.map((day) => day.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
    expect(next.days[0]!.items.map((entry) => entry.id)).toEqual(['c']);
    expect(next.days[2]!.items.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(next.days[1]!.items).toHaveLength(0);
  });

  it('đổi với chính nó hoặc ngày không tồn tại thì không đổi gì', () => {
    const source = trip([{ id: 'd1', date: '2026-09-20', items: [item('a')] }]);
    expect(swapDays(source, 'd1', 'd1')).toBe(source);
    expect(swapDays(source, 'd1', 'nope')).toBe(source);
  });
});

describe('biết trước có dồn lịch được hay không', () => {
  it('dồn được khi vẫn còn chỗ trước 23:59', () => {
    const days = [
      {
        id: 'd1',
        date: '2026-09-20',
        items: [item('a', '10:00', '12:00'), item('b', '10:30', '11:30')],
      },
    ];
    expect(canResolveConflictsByPushingDown(days)).toBe(true);
  });

  it('không dồn được khi sẽ vượt quá 23:59', () => {
    const days = [
      {
        id: 'd1',
        date: '2026-09-20',
        items: [item('a', '22:00', '23:30'), item('b', '22:30', '23:30')],
      },
    ];
    expect(canResolveConflictsByPushingDown(days)).toBe(false);
  });

  it('không có trùng giờ thì luôn coi là dồn được', () => {
    const days = [{ id: 'd1', date: '2026-09-20', items: [item('a', '09:00', '10:00')] }];
    expect(canResolveConflictsByPushingDown(days)).toBe(true);
  });
});
