import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../../i18n';
import { SpendingStatsPanel } from '../components/SpendingStatsPanel';
import type { SpendingStats } from '../utils/spendingStats';
import type { Currency, Trip } from '../../../types';

const trip = {
  id: 't1',
  name: 'Kyoto',
  startDate: '2026-09-01',
  endDate: '2026-09-03',
} as Trip;

const stats: SpendingStats = {
  linkedTripCount: 1,
  byCurrency: [
    {
      currency: 'JPY',
      total: 12000,
      tripCount: 1,
      dayCount: 3,
      perTrip: 12000,
      perDay: 4000,
      trips: [{ trip, myCost: 12000, plannedPerAdult: 0, days: 3 }],
      byCategory: { lodging: 0, transport: 0, food: 12000, sightseeing: 0, other: 0 },
    },
  ],
};

function Harness({ onPick }: { onPick?: (currency: Currency) => void }) {
  const [currency, setCurrency] = useState<Currency | null>(null);
  return (
    <SpendingStatsPanel
      stats={stats}
      years={[]}
      year=""
      onYearChange={() => {}}
      currency={currency}
      onCurrencyChange={(next) => {
        setCurrency(next);
        onPick?.(next);
      }}
    />
  );
}

describe('Thống kê chi tiêu — tab tiền tệ', () => {
  it('luôn có đủ 3 tab JPY / USD / VND, kể cả khi chỉ có dữ liệu JPY', () => {
    const onPick = vi.fn();
    render(
      <MemoryRouter>
        <Harness onPick={onPick} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['JPY', 'USD', 'VND']);
    expect(screen.getByRole('tab', { name: 'JPY' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.click(screen.getByRole('tab', { name: 'VND' }));
    expect(screen.getByText('No spending of yours on VND trips yet')).toBeTruthy();
    // Tab cũng là bộ lọc của danh sách trip ở màn hub.
    expect(onPick).toHaveBeenCalledWith('VND');
  });
});
