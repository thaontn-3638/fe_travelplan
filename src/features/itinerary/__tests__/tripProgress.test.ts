import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Trip } from '../../../types';
import { isDraftTrip, tripProgress } from '../utils/tripProgress';

function item(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return { id: 'i1', kind: 'place', placeId: 'p1', startTime: null, endTime: null, order: 0, ...overrides };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Test',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: '2026-09-20',
    endDate: null,
    status: 'idea',
    travelers: [],
    party: { adults: 1, children: 0 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days: [{ id: 'd1', date: '2026-09-20', items: [] }],
    unscheduledItems: [],
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('R11 — tiến độ lên lịch trình', () => {
  it('trip rỗng là nháp, tiến độ 1/4', () => {
    const source = trip();
    expect(tripProgress(source)).toBe(1);
    expect(isDraftTrip(source)).toBe(true);
  });

  it('có item nhưng chưa gán giờ: 2/4', () => {
    const source = trip({ days: [{ id: 'd1', date: '2026-09-20', items: [item()] }] });
    expect(tripProgress(source)).toBe(2);
    expect(isDraftTrip(source)).toBe(false);
  });

  it('đã gán giờ: 3/4', () => {
    const timed = item({ startTime: '09:00', endTime: '10:00' });
    expect(tripProgress(trip({ days: [{ id: 'd1', date: '2026-09-20', items: [timed] }] }))).toBe(3);
  });

  it('có hạn mức hoặc có khoản dự trù: 4/4 (B9)', () => {
    const timed = item({ startTime: '09:00', endTime: '10:00' });
    const withPlan = trip({
      days: [{ id: 'd1', date: '2026-09-20', items: [timed] }],
      budgetPlan: [
        {
          id: 'bn1',
          parentId: null,
          category: 'food',
          title: 'Ăn trưa',
          pricingMode: 'lumpSum',
          lumpSum: 1200,
          quantity: 1,
          order: 0,
        },
      ],
    });
    expect(tripProgress(withPlan)).toBe(4);
    // Hạn mức không kéo theo Bước 2/3: trip rỗng + hạn mức vẫn chỉ là 2/4.
    expect(tripProgress(trip({ budget: 100000 }))).toBe(2);
  });

  it('item ở "chưa xếp ngày" không tính cho Step 2', () => {
    expect(tripProgress(trip({ unscheduledItems: [item()] }))).toBe(1);
  });
});
