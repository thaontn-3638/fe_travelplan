import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '../../../i18n';
import type { BudgetNode, ItineraryItem, Place, Trip } from '../../../types';
import { BudgetStep } from '../components/BudgetStep';

function node(overrides: Partial<BudgetNode> & Pick<BudgetNode, 'id'>): BudgetNode {
  return {
    parentId: null,
    category: 'lodging',
    title: overrides.id,
    pricingMode: 'lumpSum',
    lumpSum: 0,
    quantity: 1,
    order: 0,
    ...overrides,
  };
}

function item(id: string, placeId?: string): ItineraryItem {
  return placeId
    ? { id, kind: 'place', placeId, startTime: null, endTime: null, order: 0 }
    : { id, kind: 'activity', title: `Hoạt động ${id}`, startTime: null, endTime: null, order: 0 };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: 'Kyoto',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: '2026-09-20',
    endDate: '2026-09-21',
    status: 'planning',
    travelers: [{ id: 'tv1', initials: 'N', colorClass: 'bg-ocean' }],
    party: { adults: 2, children: 2 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days: [
      { id: 'd1', date: '2026-09-20', items: [item('a', 'p1')] },
      { id: 'd2', date: '2026-09-21', items: [] },
    ],
    unscheduledItems: [],
    updatedAt: '2026-09-15T00:00:00.000Z',
    ...overrides,
  };
}

const places = new Map<string, Place>([
  [
    'p1',
    {
      id: 'p1',
      title: 'Hotel Granvia',
      coverUrl: '',
      address: '',
      region: 'Kyoto',
      category: 'hotel',
      price: 6500,
      priceCurrency: 'JPY',
      source: 'catalog',
      savedCount: 0,
    },
  ],
]);

describe('Bước 4 — Dự trù chi phí', () => {
  it('tổng và suất đầu người khớp bất biến: NL × 2 + TE × 2 = tổng', () => {
    const plan = [
      node({ id: 'room', title: 'Phòng twin', lumpSum: 24000, quantity: 3 }),
      node({
        id: 'tax',
        title: 'Thuế lưu trú',
        pricingMode: 'perPerson',
        unitAdult: 200,
        unitChild: 0,
        quantity: 3,
        order: 1,
      }),
    ];
    render(<BudgetStep trip={trip({ budgetPlan: plan })} placesById={places} onChange={vi.fn()} />);

    // 72.000 (trọn gói × 3 đêm) + 1.200 (200/người lớn × 2 × 3 đêm)
    expect(screen.getAllByText('¥73,200').length).toBeGreaterThan(0);
    // người lớn 18.000 + 600 = 18.600; trẻ em 18.000 + 0 = 18.000
    // 18.600 × 2 + 18.000 × 2 = 73.200 — đúng bất biến §3.1
    expect(screen.getByText('¥18,600')).toBeTruthy();
    expect(screen.getByText('¥18,000')).toBeTruthy();
  });

  it('không có trẻ em thì cột trẻ em biến mất hoàn toàn', () => {
    const plan = [node({ id: 'n1', pricingMode: 'perPerson', unitAdult: 100, unitChild: 50 })];
    render(
      <BudgetStep
        trip={trip({ budgetPlan: plan, party: { adults: 2, children: 0 } })}
        placesById={places}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Child')).toBeNull();
    expect(screen.queryByText('/ child')).toBeNull();
  });

  it('node cha khoá ô nhập và hiện "= tổng của N mục con"', () => {
    const plan = [
      node({ id: 'parent', title: 'Hotel Granvia' }),
      node({ id: 'child', parentId: 'parent', title: 'Phòng', lumpSum: 50000 }),
    ];
    render(<BudgetStep trip={trip({ budgetPlan: plan })} placesById={places} onChange={vi.fn()} />);

    expect(screen.getByText('= sum of 1 sub-item')).toBeTruthy();
    // đúng một ô nhập số tiền trọn gói: của node con, không phải của cha
    expect(screen.getAllByLabelText('Amount')).toHaveLength(1);
  });

  it('mục lịch trình chưa dự trù hiện ở khu gợi ý kèm giá tham khảo', () => {
    const onChange = vi.fn();
    render(<BudgetStep trip={trip()} placesById={places} onChange={onChange} />);

    expect(screen.getByText('From the itinerary — not estimated yet (1)')).toBeTruthy();
    expect(screen.getByText('Hotel Granvia')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use ¥6,500' }));

    const next = onChange.mock.calls[0]![0] as Trip;
    expect(next.budgetPlan).toHaveLength(1);
    expect(next.budgetPlan[0]).toMatchObject({
      linkedItemId: 'a',
      linkedPlaceId: 'p1',
      category: 'lodging', // hotel -> lodging
      lumpSum: 6500,
    });
  });

  it('khoản gắn mục đã bị xoá khỏi lịch trình vẫn giữ tiền, có badge cảnh báo', () => {
    const plan = [node({ id: 'n1', title: 'Khách sạn cũ', linkedPlaceId: 'p1', lumpSum: 4000 })];
    render(<BudgetStep trip={trip({ budgetPlan: plan })} placesById={places} onChange={vi.fn()} />);

    // Badge chỉ còn icon (nhãn chữ đẩy mất ô nhập tên) — tra bằng aria-label.
    expect(screen.getByLabelText('Removed from itinerary')).toBeTruthy();
    expect(screen.getAllByText('¥4,000').length).toBeGreaterThan(0);
  });

  // B7 — lệch party/travelers giờ bị chặn ngay ở Bước 1, Bước 4 không cảnh báo nữa.
  it('không còn cảnh báo lệch số người ở Bước 4', () => {
    render(<BudgetStep trip={trip()} placesById={places} onChange={vi.fn()} />);

    expect(screen.queryByText(/are named/)).toBeNull();
  });

  it('vượt hạn mức thì nói rõ vượt bao nhiêu, nhưng không chặn gì', () => {
    const plan = [node({ id: 'n1', lumpSum: 120000 })];
    render(
      <BudgetStep trip={trip({ budgetPlan: plan, budget: 100000 })} placesById={places} onChange={vi.fn()} />,
    );

    expect(screen.getByText('¥20,000 over cap')).toBeTruthy();
  });

  it('ô "cách tính" gộp cả cách chia, hiển thị đúng chế độ của từng khoản', () => {
    const plan = [
      node({ id: 'per', title: 'Vé máy bay', pricingMode: 'perPerson', unitAdult: 42000, unitChild: 32000 }),
      node({ id: 'group', title: 'Thuê xe', lumpSum: 30000, order: 1 }),
      node({ id: 'adults', title: 'JR Pass', lumpSum: 50000, lumpSumSplit: 'adultsOnly', order: 2 }),
    ];
    render(<BudgetStep trip={trip({ budgetPlan: plan })} placesById={places} onChange={vi.fn()} />);

    const selects = screen.getAllByLabelText('Pricing') as HTMLSelectElement[];
    expect(selects.map((select) => select.value)).toEqual(['perPerson', 'lumpSum', 'lumpSumAdults']);

    // Khoản trọn gói không có giá riêng cho trẻ em — ai gánh nằm ở ô cách tính.
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('chip loại chi phí hiện tổng của từng nhóm', () => {
    const plan = [
      node({ id: 'n1', category: 'food', lumpSum: 30000 }),
      node({ id: 'n2', category: 'transport', lumpSum: 12000, order: 1 }),
    ];
    render(<BudgetStep trip={trip({ budgetPlan: plan })} placesById={places} onChange={vi.fn()} />);

    const food = screen.getByRole('button', { name: /Food/ });
    expect(within(food).getByText('¥30,000')).toBeTruthy();
    const transport = screen.getByRole('button', { name: /Transport/ });
    expect(within(transport).getByText('¥12,000')).toBeTruthy();
  });
});
