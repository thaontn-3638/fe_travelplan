import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import { ScheduleStep } from '../components/ScheduleStep';
import type { ItineraryItem, Place, Trip } from '../../../types';

// FullCalendar cần layout thật; ở jsdom ta chỉ quan tâm phần logic bao quanh nó.
vi.mock('../components/DayScheduleCalendar', () => ({
  DayScheduleCalendar: () => <div data-testid="calendar" />,
}));

function item(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return { id: 'i1', kind: 'place', placeId: 'p1', startTime: null, endTime: null, order: 0, ...overrides };
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

const places = new Map<string, Place>([
  [
    'p1',
    {
      id: 'p1',
      title: 'Kinkaku-ji',
      coverUrl: '',
      address: '',
      region: 'Kyoto',
      source: 'catalog',
      savedCount: 0,
      category: 'attraction',
    },
  ],
]);

describe('Bước 3 — xếp giờ', () => {
  it('vào bước là các mục chưa có giờ được xếp sẵn từ 08:00 theo thời lượng của category', () => {
    const onAutoAssign = vi.fn();
    render(
      <ScheduleStep
        trip={trip([item({ id: 'a', order: 0 }), item({ id: 'b', order: 1 })])}
        placesById={places}
        onChange={vi.fn()}
        onAutoAssign={onAutoAssign}
      />,
    );

    expect(onAutoAssign).toHaveBeenCalled();
    const next = onAutoAssign.mock.calls[0]![0] as Trip;
    // attraction = 120 phút
    expect(next.days[0]!.items.map((entry) => [entry.startTime, entry.endTime])).toEqual([
      ['08:00', '10:00'],
      ['10:00', '12:00'],
    ]);
  });

  it('không xếp lại mục đã có giờ', () => {
    const onAutoAssign = vi.fn();
    render(
      <ScheduleStep
        trip={trip([item({ id: 'a', startTime: '13:00', endTime: '14:00', order: 0 })])}
        placesById={places}
        onChange={vi.fn()}
        onAutoAssign={onAutoAssign}
      />,
    );

    expect(onAutoAssign).not.toHaveBeenCalled();
  });

  it('hiện banner cảnh báo khi có mục trùng giờ', () => {
    render(
      <ScheduleStep
        trip={trip([
          item({ id: 'a', startTime: '09:00', endTime: '11:00', order: 0 }),
          item({ id: 'b', startTime: '10:00', endTime: '12:00', order: 1 }),
        ])}
        placesById={places}
        onChange={vi.fn()}
        onAutoAssign={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 items overlap/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Push down/i })).toBeTruthy();
  });
});
