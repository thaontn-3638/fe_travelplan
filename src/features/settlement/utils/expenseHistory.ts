import type { ExpenseSnapshot } from '../../../types';

// Các trường được so khi một khoản chi bị sửa — thứ tự = thứ tự hiển thị.
export type ExpenseField = 'amount' | 'title' | 'category' | 'date' | 'payer' | 'split' | 'note' | 'budgetNode';

export const EXPENSE_FIELDS: ExpenseField[] = ['amount', 'title', 'category', 'date', 'payer', 'split', 'note', 'budgetNode'];

function splitKey(snapshot: ExpenseSnapshot): string {
  const shares = [...snapshot.shares]
    .map((share) => `${share.travelerId}:${share.amount ?? ''}`)
    .sort()
    .join('|');
  return `${snapshot.splitMode}#${shares}`;
}

function valueOf(snapshot: ExpenseSnapshot, field: ExpenseField): string {
  switch (field) {
    case 'amount':
      return String(snapshot.amount);
    case 'title':
      return snapshot.title;
    case 'category':
      return snapshot.category;
    case 'date':
      return snapshot.date;
    case 'payer':
      return snapshot.payerId;
    case 'split':
      return splitKey(snapshot);
    case 'note':
      return snapshot.note ?? '';
    case 'budgetNode':
      return snapshot.budgetNodeId ?? '';
  }
}

// Trường nào khác nhau giữa trước và sau.
export function changedExpenseFields(before: ExpenseSnapshot, after: ExpenseSnapshot): ExpenseField[] {
  return EXPENSE_FIELDS.filter((field) => valueOf(before, field) !== valueOf(after, field));
}
