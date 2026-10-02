import { describe, expect, it } from 'vitest';
import type { ExpenseSnapshot } from '../../../types';
import { changedExpenseFields } from '../utils/expenseHistory';

const before: ExpenseSnapshot = {
  kind: 'expense',
  date: '2026-10-01',
  category: 'food',
  title: 'Ramen',
  amount: 3000,
  payerId: 'a',
  splitMode: 'equal',
  shares: [{ travelerId: 'a' }, { travelerId: 'b' }],
};

describe('S10 — lịch sử khoản chi', () => {
  it('liệt kê đúng các trường đã đổi', () => {
    const after = { ...before, amount: 3600, payerId: 'b', note: 'gồm bia' };
    expect(changedExpenseFields(before, after)).toEqual(['amount', 'payer', 'note']);
  });

  it('đổi thứ tự người chia không tính là sửa', () => {
    const after = { ...before, shares: [{ travelerId: 'b' }, { travelerId: 'a' }] };
    expect(changedExpenseFields(before, after)).toEqual([]);
  });

  it('bỏ một người khỏi phần chia, hay đổi số nhập riêng, là sửa "chia cho"', () => {
    expect(changedExpenseFields(before, { ...before, shares: [{ travelerId: 'a' }] })).toEqual(['split']);
    expect(
      changedExpenseFields(
        { ...before, splitMode: 'exact', shares: [{ travelerId: 'a', amount: 1000 }, { travelerId: 'b', amount: 2000 }] },
        { ...before, splitMode: 'exact', shares: [{ travelerId: 'a', amount: 1500 }, { travelerId: 'b', amount: 1500 }] },
      ),
    ).toEqual(['split']);
  });
});
