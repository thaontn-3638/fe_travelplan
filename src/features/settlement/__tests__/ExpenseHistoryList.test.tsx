import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../i18n';
import type { ExpenseHistoryEntry, Trip } from '../../../types';

const entry: ExpenseHistoryEntry = {
  id: 'h1',
  tripId: 't1',
  expenseId: 'e1',
  action: 'create',
  at: '2026-10-01T03:00:00.000Z',
  userId: 'u-thao',
  userName: 'Thao',
  after: {
    kind: 'settlement',
    date: '2026-10-01',
    category: 'other',
    title: 'settlement',
    amount: 21078,
    payerId: 'a',
    splitMode: 'exact',
    shares: [{ travelerId: 'b', amount: 21078 }],
  },
};

vi.mock('../api/expenseHistoryApi', () => ({
  getExpenseHistory: vi.fn().mockResolvedValue([entry]),
}));

const { ExpenseHistoryList } = await import('../components/ExpenseHistoryList');

const trip = {
  id: 't1',
  currency: 'JPY',
  travelers: [
    { id: 'a', fullName: 'Thao', initials: 'T', colorClass: 'bg-ocean' },
    { id: 'b', fullName: 'Dung', initials: 'D', colorClass: 'bg-coral' },
  ],
  budgetPlan: [],
} as unknown as Trip;

describe('Lịch sử — giao dịch quyết toán', () => {
  it('hiện "người trả → người nhận" theo ngôn ngữ đang chọn, không in mã nội bộ "settlement"', async () => {
    render(<ExpenseHistoryList trip={trip} revision={0} />);

    expect(await screen.findByText('Thao → Dung')).toBeTruthy();
    expect(screen.queryByText(/^settlement$/)).toBeNull();
    expect(screen.getByText('recorded a settlement payment', { exact: false })).toBeTruthy();
  });
});
