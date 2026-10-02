import { describe, expect, it } from 'vitest';
import type { Expense, Traveler, Trip } from '../../../types';
import { userSpendingStats } from '../utils/spendingStats';

const ME: Traveler = { id: 'me', userId: 'u1', fullName: 'Thao', initials: 'T', colorClass: 'bg-ocean' };
const A: Traveler = { id: 'a', fullName: 'A', initials: 'A', colorClass: 'bg-coral' };
const KID: Traveler = { id: 'kid', fullName: 'Bi', initials: 'B', colorClass: 'bg-mint', isChild: true, guardianId: 'me' };

function trip(o: Partial<Trip>): Trip {
  return {
    id: 't1',
    ownerId: 'u1',
    name: 'Kyoto',
    regions: [],
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    status: 'done',
    travelers: [ME, A],
    party: { adults: 2, children: 0 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days: [],
    unscheduledItems: [],
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...o,
  };
}

function expense(o: Partial<Expense> & Pick<Expense, 'id' | 'amount' | 'tripId'>): Expense {
  return {
    kind: 'expense',
    date: '2026-09-01',
    category: 'food',
    title: o.id,
    payerId: 'a',
    splitMode: 'equal',
    shares: [{ travelerId: 'me' }, { travelerId: 'a' }],
    createdAt: '2026-09-01T00:00:00.000Z',
    createdBy: 'u1',
    ...o,
  };
}

describe('Thống kê chi tiêu của riêng bạn', () => {
  it('tính phần bạn phải gánh, không phải số bạn đã ứng ra', () => {
    const trips = [trip({ id: 't1' })];
    const expenses = new Map([
      ['t1', [expense({ id: 'e1', tripId: 't1', amount: 1000, payerId: 'me' })]],
    ]);
    const [jpy] = userSpendingStats(trips, expenses, 'u1', '').byCurrency;
    expect(jpy!.total).toBe(500);
    expect(jpy!.byCategory.food).toBe(500);
  });

  it('cộng cả suất của bé bạn phụ trách, chính xác tới 0,01', () => {
    const trips = [trip({ id: 't1', travelers: [ME, A, KID], party: { adults: 2, children: 1 } })];
    const expenses = new Map([
      [
        't1',
        [
          expense({
            id: 'e1',
            tripId: 't1',
            amount: 1000,
            shares: [{ travelerId: 'me' }, { travelerId: 'a' }, { travelerId: 'kid' }],
          }),
        ],
      ],
    ]);
    const total = userSpendingStats(trips, expenses, 'u1', '').byCurrency[0]!.total;
    // 1000 / 3 ≈ 333.33 của bạn + 333.33 của bé (± 0,01 phần dư)
    expect(total).toBeGreaterThanOrEqual(666.66);
    expect(total).toBeLessThanOrEqual(666.68);
  });

  it('bỏ qua trip bạn không phải thành viên, trip ngoài năm lọc, và giao dịch quyết toán', () => {
    const trips = [
      trip({ id: 't1' }),
      trip({ id: 't2', travelers: [A], startDate: '2026-10-01', endDate: '2026-10-01' }),
      trip({ id: 't3', startDate: '2025-05-01', endDate: '2025-05-02' }),
    ];
    const expenses = new Map([
      [
        't1',
        [
          expense({ id: 'e1', tripId: 't1', amount: 2000 }),
          expense({ id: 's1', tripId: 't1', amount: 1000, kind: 'settlement', splitMode: 'exact' }),
        ],
      ],
      ['t2', [expense({ id: 'e2', tripId: 't2', amount: 9000, shares: [{ travelerId: 'a' }] })]],
      ['t3', [expense({ id: 'e3', tripId: 't3', amount: 4000 })]],
    ]);
    const stats = userSpendingStats(trips, expenses, 'u1', '2026');
    expect(stats.linkedTripCount).toBe(1);
    expect(stats.byCurrency[0]).toMatchObject({ total: 1000, tripCount: 1, dayCount: 3 });
    expect(stats.byCurrency[0]!.perDay).toBeCloseTo(1000 / 3, 6);
  });

  it('không cộng lẫn hai đơn vị tiền', () => {
    const trips = [trip({ id: 't1' }), trip({ id: 't2', currency: 'USD' })];
    const expenses = new Map([
      ['t1', [expense({ id: 'e1', tripId: 't1', amount: 1000 })]],
      ['t2', [expense({ id: 'e2', tripId: 't2', amount: 1000 })]],
    ]);
    const stats = userSpendingStats(trips, expenses, 'u1', '');
    expect(stats.byCurrency.map((entry) => [entry.currency, entry.total]).sort()).toEqual([
      ['JPY', 500],
      ['USD', 500],
    ]);
  });
});
