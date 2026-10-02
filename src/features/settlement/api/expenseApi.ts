import type { CostCategory, Expense, ExpenseShare } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { API_BASE_URL, HttpError, requestJson, requestList } from '../../places/api/httpClient';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExpenseShare(value: unknown): value is ExpenseShare {
  return (
    isRecord(value) &&
    isNonEmptyString(value.travelerId) &&
    (value.amount === undefined || typeof value.amount === 'number')
  );
}

// Validate tới từng phần tử `shares[]`: một phần tử thiếu `travelerId` là một
// khoản tiền không ai gánh, và nó sẽ âm thầm làm Σ số dư khác 0.
export function isExpense(value: unknown): value is Expense {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.tripId) &&
    (value.kind === 'expense' || value.kind === 'settlement') &&
    isNonEmptyString(value.date) &&
    COST_CATEGORIES.includes(value.category as CostCategory) &&
    typeof value.title === 'string' &&
    typeof value.amount === 'number' &&
    value.amount > 0 &&
    isNonEmptyString(value.payerId) &&
    (value.splitMode === 'equal' || value.splitMode === 'exact') &&
    Array.isArray(value.shares) &&
    value.shares.length > 0 &&
    value.shares.every(isExpenseShare) &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.createdBy) &&
    (value.budgetNodeId === undefined || isNonEmptyString(value.budgetNodeId)) &&
    (value.note === undefined || typeof value.note === 'string')
  );
}

export type NewExpense = Omit<Expense, 'id' | 'createdAt'>;

export async function getExpenses(tripId?: string): Promise<Expense[]> {
  const query = tripId ? `?tripId=${encodeURIComponent(tripId)}&_sort=-date` : '?_sort=-date';
  return requestList(`${API_BASE_URL}/expenses${query}`, isExpense);
}

export async function createExpense(input: NewExpense): Promise<Expense> {
  return requestJson(`${API_BASE_URL}/expenses`, isExpense, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, createdAt: new Date().toISOString() }),
  });
}

// Sửa = GHI ĐÈ cả bản ghi (PUT), không PATCH: form bỏ trống ghi chú / bỏ gắn
// khoản dự trù thì trường đó phải biến mất, mà PATCH của json-server chỉ trộn
// thêm nên giá trị cũ sẽ còn nguyên.
export async function replaceExpense(id: string, input: NewExpense, createdAt: string): Promise<Expense> {
  return requestJson(`${API_BASE_URL}/expenses/${id}`, isExpense, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, id, createdAt }),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/expenses/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new HttpError(response.status);
  }
}
