import { useCallback, useEffect, useRef, useState } from 'react';
import type { Expense } from '../../../types';
import { userErrorMessage } from '../../../utils/errorMessages';
import { createExpense, deleteExpense, getExpenses, replaceExpense, type NewExpense } from '../api/expenseApi';
import { totalSpent } from '../utils/settlementRules';
import { updateTrip } from '../../itinerary/api/tripApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { appendExpenseHistory, snapshotOf } from '../api/expenseHistoryApi';
import type { ExpenseHistoryAction } from '../../../types';
import { upsertTrip } from '../../../store/slices/tripsSlice';

interface UseExpensesResult {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  add: (input: NewExpense) => Promise<void>;
  edit: (id: string, input: NewExpense) => Promise<void>;
  remove: (id: string) => Promise<void>;
  // Tăng sau mỗi lần ghi lịch sử — màn lịch sử dùng làm key để tải lại.
  historyRevision: number;
}

// `tripId` undefined = nạp toàn bộ chi tiêu (màn hub cộng dồn nhiều chuyến).
//
// Không đưa vào Redux: chi tiêu chỉ hai màn dùng, và mỗi bản ghi là một POST
// độc lập nên không có xung đột ghi đè như `days` (trip-budget.md §2.4).
export function useExpenses(tripId?: string): UseExpensesResult {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  // Bản mới nhất của danh sách cho các thao tác ghi: hai thao tác chồng nhau
  // (xoá liền hai dòng) không được tính `next` từ cùng một mảng cũ.
  const latest = useRef<Expense[]>([]);

  const commit = useCallback((update: (current: Expense[]) => Expense[]): Expense[] => {
    latest.current = update(latest.current);
    setExpenses(latest.current);
    return latest.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getExpenses(tripId)
      .then((result) => {
        if (!cancelled) {
          latest.current = result;
          setExpenses(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(userErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, nonce]);

  // S8 — `trip.spent` là bản denormalize để Dashboard và TripCard đọc nhanh mà
  // không phải tải toàn bộ chi tiêu. Ghi lại sau MỌI thay đổi.
  //
  // Best-effort: khoản chi ĐÃ được lưu rồi. Nếu bước này lỗi mà lại ném ra,
  // form tưởng lưu thất bại và người dùng bấm lần nữa → khoản chi bị nhân đôi.
  // Lần ghi kế tiếp sẽ tính lại `spent` từ đầu nên tự khớp lại.
  const syncSpent = useCallback(
    async (next: Expense[], forTripId: string): Promise<void> => {
      try {
        const trip = await updateTrip(forTripId, {
          spent: totalSpent(next.filter((expense) => expense.tripId === forTripId)),
        });
        dispatch(upsertTrip(trip));
      } catch (err) {
        console.warn('[expenses] Could not sync trip.spent', err);
      }
    },
    [dispatch],
  );

  // S10 — lịch sử thay đổi. Best-effort giống syncSpent: khoản chi đã lưu thì
  // không được báo thất bại chỉ vì không ghi được dòng lịch sử.
  const recordHistory = useCallback(
    async (action: ExpenseHistoryAction, expense: Expense, before?: Expense): Promise<void> => {
      if (!user) return;
      if (action === 'update' && before && JSON.stringify(snapshotOf(before)) === JSON.stringify(snapshotOf(expense))) {
        return; // bấm Lưu mà không đổi gì
      }
      try {
        await appendExpenseHistory(action, { id: user.id, name: user.fullName }, expense, before);
        setHistoryRevision((value) => value + 1);
      } catch (err) {
        console.warn('[expenses] Could not write history', err);
      }
    },
    [user],
  );

  const add = useCallback(
    async (input: NewExpense): Promise<void> => {
      const created = await createExpense(input);
      const next = commit((current) => [created, ...current]);
      await Promise.all([syncSpent(next, input.tripId), recordHistory('create', created)]);
    },
    [commit, syncSpent, recordHistory],
  );

  const edit = useCallback(
    async (id: string, input: NewExpense): Promise<void> => {
      const existing = latest.current.find((expense) => expense.id === id);
      const updated = await replaceExpense(id, input, existing?.createdAt ?? new Date().toISOString());
      const next = commit((current) => current.map((expense) => (expense.id === id ? updated : expense)));
      await Promise.all([syncSpent(next, updated.tripId), recordHistory('update', updated, existing)]);
    },
    [commit, syncSpent, recordHistory],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const target = latest.current.find((expense) => expense.id === id);
      await deleteExpense(id);
      const next = commit((current) => current.filter((expense) => expense.id !== id));
      if (target) await Promise.all([syncSpent(next, target.tripId), recordHistory('delete', target)]);
    },
    [commit, syncSpent, recordHistory],
  );

  return {
    expenses,
    loading,
    error,
    reload: () => setNonce((value) => value + 1),
    add,
    edit,
    remove,
    historyRevision,
  };
}
