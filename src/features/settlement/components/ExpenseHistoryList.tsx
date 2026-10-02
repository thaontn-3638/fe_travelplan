import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { ExpenseHistoryEntry, ExpenseSnapshot, Trip } from '../../../types';
import { getExpenseHistory } from '../api/expenseHistoryApi';
import { changedExpenseFields, type ExpenseField } from '../utils/expenseHistory';
import { formatMoney } from '../../budget/utils/money';
import { formatDate, formatDateWithWeekday } from '../../../utils/dateFormat';
import { userErrorMessage } from '../../../utils/errorMessages';

interface ExpenseHistoryListProps {
  trip: Trip;
  // Đổi giá trị → tải lại (sau mỗi lần thêm/sửa/xoá ở tab khác).
  revision: number;
}

const ACTION_STYLE = {
  create: { icon: <AddCircleOutlineRoundedIcon sx={{ fontSize: 16 }} />, tile: 'bg-mint-tint text-mint-dark' },
  update: { icon: <EditRoundedIcon sx={{ fontSize: 16 }} />, tile: 'bg-amber-tint text-amber-dark' },
  delete: { icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />, tile: 'bg-coral-tint text-coral-dark' },
} as const;

// S10 — ai đã thêm / sửa / xoá khoản chi nào, lúc nào, đổi từ gì sang gì.
export function ExpenseHistoryList({ trip, revision }: ExpenseHistoryListProps) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ExpenseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getExpenseHistory(trip.id)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
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
  }, [trip.id, revision, nonce]);

  const travelerName = (id: string): string => {
    const traveler = trip.travelers.find((candidate) => candidate.id === id);
    return traveler ? (traveler.fullName ?? traveler.initials) : t('settlement.history.removedMember');
  };

  const budgetTitle = (id: string | undefined): string => {
    if (!id) return t('settlement.form.budgetNodeNone');
    return trip.budgetPlan.find((node) => node.id === id)?.title || t('itinerary.step4.untitled');
  };

  // Giao dịch quyết toán lưu `title: 'settlement'` (mã nội bộ, không phải chữ
  // người dùng gõ) — luôn hiển thị theo ngôn ngữ đang chọn: "A → B".
  function subjectTitle(snapshot: ExpenseSnapshot): string {
    if (snapshot.kind === 'settlement') {
      return t('settlement.history.settlementTitle', {
        from: travelerName(snapshot.payerId),
        to: travelerName(snapshot.shares[0]?.travelerId ?? ''),
      });
    }
    return snapshot.title || '—';
  }

  function describe(snapshot: ExpenseSnapshot, field: ExpenseField): string {
    switch (field) {
      case 'amount':
        return formatMoney(snapshot.amount, trip.currency);
      case 'title':
        return subjectTitle(snapshot);
      case 'category':
        return t(`itinerary.step4.category.${snapshot.category}`);
      case 'date':
        return formatDate(snapshot.date);
      case 'payer':
        return travelerName(snapshot.payerId);
      case 'split': {
        const names = snapshot.shares.map((share) =>
          snapshot.splitMode === 'exact' && share.amount !== undefined
            ? `${travelerName(share.travelerId)} ${formatMoney(share.amount, trip.currency)}`
            : travelerName(share.travelerId),
        );
        return `${t(`settlement.form.split.${snapshot.splitMode}`)}: ${names.join(', ')}`;
      }
      case 'note':
        return snapshot.note || '—';
      case 'budgetNode':
        return budgetTitle(snapshot.budgetNodeId);
    }
  }

  if (loading) {
    return (
      <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
        {t('settlement.list.loading')}
      </p>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-2xl border border-dashed border-coral/60 bg-white px-6 py-8 text-center">
        <p className="m-0 text-[13px] font-semibold text-ink">{t('settlement.history.loadError')}</p>
        <p className="m-0 mt-1 text-[12px] text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={() => setNonce((value) => value + 1)}
          className="mt-4 rounded-xl border border-ocean bg-white px-4 py-2 text-[13px] font-semibold text-ocean-dark"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
        {t('settlement.history.empty')}
      </p>
    );
  }

  // Nhóm theo ngày (giờ địa phương của người xem).
  const byDay = new Map<string, ExpenseHistoryEntry[]>();
  for (const entry of entries) {
    const day = format(parseISO(entry.at), 'yyyy-MM-dd');
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[12px] text-ink-soft">{t('settlement.history.hint')}</p>
      {[...byDay.entries()].map(([day, items]) => (
        <section key={day} className="overflow-hidden rounded-2xl border border-line bg-white">
          <div className="border-b border-line bg-surface px-4 py-2 text-[12.5px] font-semibold text-ink">
            {formatDateWithWeekday(day)}
          </div>
          <ol className="m-0 list-none p-0">
            {items.map((entry) => {
              const style = ACTION_STYLE[entry.action];
              const subject = entry.after ?? entry.before!;
              const isSettlement = subject.kind === 'settlement';
              const changes =
                entry.action === 'update' && entry.before && entry.after
                  ? changedExpenseFields(entry.before, entry.after)
                  : [];

              return (
                <li key={entry.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-b-0">
                  <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${style.tile}`}>
                    {style.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-[13px] text-ink">
                      <span className="font-semibold">{entry.userName || t('settlement.history.someone')}</span>{' '}
                      {t(`settlement.history.action.${isSettlement ? `${entry.action}Settlement` : entry.action}`)}
                      {' · '}
                      <span className="font-semibold">{subjectTitle(subject)}</span>{' '}
                      <span className="font-mono">{formatMoney(subject.amount, trip.currency)}</span>
                    </p>
                    {changes.length > 0 && (
                      <ul className="m-0 mt-1.5 flex list-none flex-col gap-0.5 p-0">
                        {changes.map((field) => (
                          <li key={field} className="text-[12px] text-ink-soft">
                            <span className="font-semibold text-ink">{t(`settlement.history.field.${field}`)}</span>{' '}
                            <span className="line-through decoration-ink-soft/60">{describe(entry.before!, field)}</span>
                            {' → '}
                            <span className="text-ink">{describe(entry.after!, field)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <time dateTime={entry.at} className="flex-shrink-0 font-mono text-[11.5px] text-ink-soft">
                    {format(parseISO(entry.at), 'HH:mm')}
                  </time>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
