import type { Expense, ExpenseHistoryAction, ExpenseHistoryEntry, ExpenseSnapshot } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { API_BASE_URL, requestJson, requestList } from '../../places/api/httpClient';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSnapshot(value: unknown): value is ExpenseSnapshot {
  return (
    isRecord(value) &&
    typeof value.amount === 'number' &&
    typeof value.title === 'string' &&
    isNonEmptyString(value.payerId) &&
    Array.isArray(value.shares)
  );
}

export function isExpenseHistoryEntry(value: unknown): value is ExpenseHistoryEntry {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.tripId) &&
    isNonEmptyString(value.expenseId) &&
    (value.action === 'create' || value.action === 'update' || value.action === 'delete') &&
    isNonEmptyString(value.at) &&
    isNonEmptyString(value.userId) &&
    typeof value.userName === 'string' &&
    (value.before === undefined || isSnapshot(value.before)) &&
    (value.after === undefined || isSnapshot(value.after))
  );
}

export function snapshotOf(expense: Expense): ExpenseSnapshot {
  return {
    kind: expense.kind,
    date: expense.date,
    category: expense.category,
    title: expense.title,
    ...(expense.note ? { note: expense.note } : {}),
    ...(expense.budgetNodeId ? { budgetNodeId: expense.budgetNodeId } : {}),
    amount: expense.amount,
    payerId: expense.payerId,
    splitMode: expense.splitMode,
    shares: expense.shares,
  };
}

// Mới nhất trước.
export async function getExpenseHistory(tripId: string): Promise<ExpenseHistoryEntry[]> {
  return requestList(
    `${API_BASE_URL}/expenseHistory?tripId=${encodeURIComponent(tripId)}&_sort=-at`,
    isExpenseHistoryEntry,
  );
}

export interface HistoryActor {
  id: string;
  name: string;
}

export async function appendExpenseHistory(
  action: ExpenseHistoryAction,
  actor: HistoryActor,
  expense: Expense,
  before?: Expense,
): Promise<ExpenseHistoryEntry> {
  const entry: Omit<ExpenseHistoryEntry, 'id'> = {
    tripId: expense.tripId,
    expenseId: expense.id,
    action,
    at: new Date().toISOString(),
    userId: actor.id,
    userName: actor.name,
    ...(action === 'create' ? { after: snapshotOf(expense) } : {}),
    ...(action === 'update' ? { before: snapshotOf(before ?? expense), after: snapshotOf(expense) } : {}),
    ...(action === 'delete' ? { before: snapshotOf(expense) } : {}),
  };

  return requestJson(`${API_BASE_URL}/expenseHistory`, isExpenseHistoryEntry, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
}
