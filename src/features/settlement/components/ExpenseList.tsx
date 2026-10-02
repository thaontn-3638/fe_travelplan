import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import type { CostCategory, Expense, Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { COST_CATEGORY_CLASSES } from '../../budget/utils/budgetCategories';
import { formatMoney } from '../../budget/utils/money';
import { formatDateWithWeekday } from '../../../utils/dateFormat';

interface ExpenseListProps {
  trip: Trip;
  expenses: Expense[];
  loading?: boolean;
  // Không truyền = chỉ đọc (trang chia sẻ công khai): ẩn nút sửa / xoá.
  onEdit?: (expense: Expense) => void;
  onRemove?: (id: string) => Promise<void>;
}

export function ExpenseList({ trip, expenses, loading = false, onEdit, onRemove }: ExpenseListProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CostCategory | null>(null);
  const [payerId, setPayerId] = useState<string>('');
  const [pendingRemove, setPendingRemove] = useState<Expense | null>(null);

  const nameOf = (id: string): string => {
    const traveler = trip.travelers.find((candidate) => candidate.id === id);
    return traveler?.fullName ?? traveler?.initials ?? '?';
  };

  const real = expenses.filter((expense) => expense.kind === 'expense');
  const settlements = expenses.filter((expense) => expense.kind === 'settlement');

  const visible = real.filter(
    (expense) =>
      (category === null || expense.category === category) &&
      (payerId === '' || expense.payerId === payerId),
  );

  const byDate = new Map<string, Expense[]>();
  for (const expense of [...visible].sort((a, b) => b.date.localeCompare(a.date))) {
    byDate.set(expense.date, [...(byDate.get(expense.date) ?? []), expense]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
            category === null ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft'
          }`}
        >
          {t('itinerary.step4.categoryAll')}
        </button>
        {COST_CATEGORIES.map((key) => {
          const colors = COST_CATEGORY_CLASSES[key];
          const active = category === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(active ? null : key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold ${
                active ? `${colors.border} ${colors.tint} ${colors.text}` : 'border-line bg-white text-ink-soft'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {t(`itinerary.step4.category.${key}`)}
            </button>
          );
        })}

        <select
          value={payerId}
          aria-label={t('settlement.list.filterPayer')}
          onChange={(event) => setPayerId(event.target.value)}
          className="ml-auto rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] text-ink-soft outline-none focus:border-ocean"
        >
          <option value="">{t('settlement.list.allPayers')}</option>
          {trip.travelers
            .filter((traveler) => !traveler.isChild)
            .map((traveler) => (
              <option key={traveler.id} value={traveler.id}>
                {traveler.fullName ?? traveler.initials}
              </option>
            ))}
        </select>
      </div>

      {loading ? (
        <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
          {t('settlement.list.loading')}
        </p>
      ) : visible.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
          {real.length === 0 ? t('settlement.list.empty') : t('settlement.list.emptyFiltered')}
        </p>
      ) : (
        [...byDate.entries()].map(([date, items]) => (
          <section key={date} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2">
              <span className="text-[12.5px] font-semibold text-ink">{formatDateWithWeekday(date)}</span>
              <span className="font-mono text-[12.5px] text-ink-soft">
                {formatMoney(
                  items.reduce((total, expense) => total + expense.amount, 0),
                  trip.currency,
                )}
              </span>
            </div>

            {items.map((expense) => {
              const colors = COST_CATEGORY_CLASSES[expense.category];
              return (
                <div key={expense.id} className="flex items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-[13px] font-semibold text-ink">{expense.title}</p>
                    <p className="m-0 truncate text-[11.5px] text-ink-soft">
                      {t('settlement.list.paidBy', { name: nameOf(expense.payerId) })} ·{' '}
                      {t('settlement.list.splitCount', { count: expense.shares.length })}
                      {expense.splitMode === 'exact' && ` · ${t('settlement.form.split.exact')}`}
                      {expense.budgetNodeId &&
                        ` · ${
                          trip.budgetPlan.find((node) => node.id === expense.budgetNodeId)?.title ?? ''
                        }`}
                    </p>
                    {expense.note && (
                      <p className="m-0 truncate text-[11.5px] italic text-ink-soft">{expense.note}</p>
                    )}
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-ink">
                    {formatMoney(expense.amount, trip.currency)}
                  </span>
                  {onEdit && (
                    <IconButton size="small" aria-label={t('settlement.list.edit')} onClick={() => onEdit(expense)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  )}
                  {onRemove && (
                    <IconButton
                      size="small"
                      aria-label={t('settlement.list.remove')}
                      onClick={() => setPendingRemove(expense)}
                    >
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}

      {settlements.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-dashed border-line bg-white">
          <div className="border-b border-line bg-surface px-4 py-2 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('settlement.list.settlementsTitle', { count: settlements.length })}
          </div>
          {settlements.map((expense) => (
            <div key={expense.id} className="flex items-center gap-2.5 border-b border-line px-4 py-2 last:border-b-0">
              <SwapHorizRoundedIcon sx={{ fontSize: 16 }} className="text-ink-soft" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-soft">
                {nameOf(expense.payerId)} → {nameOf(expense.shares[0]?.travelerId ?? '')}
              </span>
              <span className="font-mono text-[12.5px] text-ink-soft">
                {formatMoney(expense.amount, trip.currency)}
              </span>
              {onRemove && (
                <IconButton
                  size="small"
                  aria-label={t('settlement.list.remove')}
                  onClick={() => setPendingRemove(expense)}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </div>
          ))}
          <p className="m-0 px-4 py-2 text-[11.5px] text-ink-soft">{t('settlement.list.settlementsHint')}</p>
        </section>
      )}

      <Dialog open={pendingRemove !== null} onClose={() => setPendingRemove(null)}>
        <DialogTitle>{t('settlement.list.removeTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingRemove &&
              t('settlement.list.removeBody', {
                // Giao dịch quyết toán: "A → B" thay cho mã nội bộ 'settlement'.
                title:
                  pendingRemove.kind === 'settlement'
                    ? `${nameOf(pendingRemove.payerId)} → ${nameOf(pendingRemove.shares[0]?.travelerId ?? '')}`
                    : pendingRemove.title,
                amount: formatMoney(pendingRemove.amount, trip.currency),
              })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemove(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingRemove) void onRemove?.(pendingRemove.id);
              setPendingRemove(null);
            }}
          >
            {t('settlement.list.remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
