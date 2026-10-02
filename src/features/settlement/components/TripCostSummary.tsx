import { useTranslation } from 'react-i18next';
import type { Expense, Trip } from '../../../types';
import { formatMoney, formatSignedPrecise } from '../../budget/utils/money';
import { planTotal } from '../../budget/utils/budgetRules';
import { balances, totalSpent } from '../utils/settlementRules';

interface TripCostSummaryProps {
  trip: Trip;
  expenses: Expense[];
  currentUserId: string;
}

// MỘT component dùng chung cho tab "Chi phí" của màn xem chuyến đi và cho hub
// /settlement. Trip detail không dựng lại gì — nó chỉ render đúng khối này rồi
// một nút điều hướng (trip-budget.md §7.1).
export function TripCostSummary({ trip, expenses, currentUserId }: TripCostSummaryProps) {
  const { t } = useTranslation();

  const planned = planTotal(trip.budgetPlan, trip.party);
  const spent = totalSpent(expenses);
  const me = trip.travelers.find((traveler) => traveler.userId === currentUserId);
  const myBalance = me ? (balances(expenses, trip.travelers, trip.currency)[me.id] ?? 0) : 0;

  const diff = spent - planned;

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      <Figure label={t('settlement.summary.spent')} value={formatMoney(spent, trip.currency)} strong />
      <Figure
        label={t('settlement.summary.vsPlanned')}
        value={
          planned === 0
            ? '—'
            : diff === 0
              ? '±0'
              : `${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff), trip.currency)}`
        }
        tone={planned === 0 ? 'muted' : diff > 0 ? 'bad' : 'good'}
      />
      <Figure
        label={t('settlement.summary.yourBalance')}
        value={formatSignedPrecise(myBalance, trip.currency)}
        tone={myBalance === 0 ? 'muted' : myBalance > 0 ? 'good' : 'bad'}
        hint={
          myBalance === 0
            ? undefined
            : myBalance > 0
              ? t('settlement.summary.youAreOwed')
              : t('settlement.summary.youOwe')
        }
      />
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  strong = false,
  tone = 'plain',
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  tone?: 'plain' | 'good' | 'bad' | 'muted';
}) {
  const color =
    tone === 'good' ? 'text-mint-dark' : tone === 'bad' ? 'text-coral-dark' : tone === 'muted' ? 'text-ink-soft' : 'text-ink';

  return (
    <div>
      <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={`m-0 font-display font-bold ${strong ? 'text-[24px]' : 'text-[19px]'} ${color}`}>{value}</p>
      {hint && <p className="m-0 text-[11.5px] text-ink-soft">{hint}</p>}
    </div>
  );
}
