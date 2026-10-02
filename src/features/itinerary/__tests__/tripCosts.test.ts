import { describe, expect, it } from 'vitest';
import type { BudgetNode, ItineraryItem, Trip } from '../../../types';
import {
  costPerPerson,
  dayEstimatedCosts,
  tripEstimatedCost,
  unassignedEstimatedCost,
} from '../utils/tripCosts';

function item(id: string): ItineraryItem {
  return { id, kind: 'place', placeId: 'p1', startTime: null, endTime: null, order: 0 };
}

function node(id: string, lumpSum: number, linkedItemId?: string): BudgetNode {
  return {
    id,
    parentId: null,
    category: 'other',
    title: id,
    ...(linkedItemId ? { linkedItemId } : {}),
    pricingMode: 'lumpSum',
    lumpSum,
    quantity: 1,
    order: 0,
  };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Test',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: '2026-09-20',
    endDate: '2026-09-21',
    status: 'planning',
    travelers: [],
    party: { adults: 2, children: 1 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [
      node('n-a', 1000, 'a'),
      node('n-b', 500, 'b'),
      node('n-d', 2000, 'd'),
      node('n-free', 8000), // vé máy bay: không gắn ngày nào
    ],
    days: [
      { id: 'd1', date: '2026-09-20', items: [item('a'), item('b'), item('c')] },
      { id: 'd2', date: '2026-09-21', items: [item('d')] },
    ],
    unscheduledItems: [],
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

describe('chi phí dự trù (nguồn: budgetPlan)', () => {
  it('quy được về từng ngày qua linkedItemId', () => {
    const costs = dayEstimatedCosts(trip());
    expect(costs.d1).toBe(1500);
    expect(costs.d2).toBe(2000);
  });

  it('khoản không gắn mục lịch trình vẫn vào tổng, nhưng không vào ngày nào', () => {
    expect(tripEstimatedCost(trip())).toBe(11500);
    expect(unassignedEstimatedCost(trip())).toBe(8000);
  });

  it('mục lịch trình chưa có khoản dự trù thì ngày đó chỉ tính phần đã có', () => {
    // item 'c' không có node nào trỏ tới
    expect(dayEstimatedCosts(trip()).d1).toBe(1500);
  });

  it('chia bình quân theo số người thực tế, không theo số thành viên', () => {
    // party 2 người lớn + 1 trẻ em = 3 người, travelers rỗng
    expect(costPerPerson(trip())).toBeCloseTo(11500 / 3, 6);
  });

  it('không có ai thì không chia', () => {
    expect(costPerPerson(trip({ party: { adults: 0, children: 0 } }))).toBeNull();
  });
});
