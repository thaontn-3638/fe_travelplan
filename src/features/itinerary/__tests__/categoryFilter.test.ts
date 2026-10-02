import { describe, expect, it } from 'vitest';
import type { ItineraryItem, Trip } from '../../../types';
import { addItemToDay, moveItemToDay } from '../utils/itineraryRules';
import { createPlaceItem } from '../dnd';

function item(id: string, placeId: string, order: number): ItineraryItem {
  return { id, kind: 'place', placeId, startTime: null, endTime: null, order };
}

function trip(items: ItineraryItem[]): Trip {
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
    days: [{ id: 'd1', date: '2026-09-20', items }],
    unscheduledItems: [],
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
}

// R9 — bộ lọc category chỉ ảnh hưởng tới hiển thị. Vị trí chèn được xác định
// theo id của mục được thả lên, nên kết quả không phụ thuộc việc đang lọc gì.
describe('kéo thả khi đang bật bộ lọc category', () => {
  it('thả lên một mục đang hiện thì chèn ngay sau mục đó, kể cả khi giữa có mục bị ẩn', () => {
    // a (hiện) · b (ẩn) · c (hiện) — người dùng thả lên `a`
    const source = trip([item('a', 'p1', 0), item('b', 'p2', 1), item('c', 'p3', 2)]);

    const next = addItemToDay(source, 'd1', createPlaceItem('p9', 'new'), 'a');

    expect(next.days[0]!.items.map((entry) => entry.id)).toEqual(['a', 'new', 'b', 'c']);
    expect(next.days[0]!.items.map((entry) => entry.order)).toEqual([0, 1, 2, 3]);
  });

  it('thả vào thân day card thì xuống cuối mảng đầy đủ', () => {
    const source = trip([item('a', 'p1', 0), item('b', 'p2', 1)]);

    const next = addItemToDay(source, 'd1', createPlaceItem('p9', 'new'), null);

    expect(next.days[0]!.items.map((entry) => entry.id)).toEqual(['a', 'b', 'new']);
  });

  it('đổi thứ tự giữ nguyên vị trí tương đối của các mục đang bị ẩn', () => {
    const source = trip([item('a', 'p1', 0), item('b', 'p2', 1), item('c', 'p3', 2)]);

    const next = moveItemToDay(source, 'c', 'd1', 'd1', 'a');

    expect(next.days[0]!.items.map((entry) => entry.id)).toEqual(['a', 'c', 'b']);
  });
});
