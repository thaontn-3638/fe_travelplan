import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Dialog } from '@mui/material';
import type { Currency, Expense, Trip } from '../types';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrips } from '../features/itinerary/hooks/useTrips';
import { useAppSelector } from '../store/hooks';
import { useExpenses } from '../features/settlement/hooks/useExpenses';
import { ExpenseForm } from '../features/settlement/components/ExpenseForm';
import { actualByCategory, balances, totalSpent } from '../features/settlement/utils/settlementRules';
import { userSpendingStats } from '../features/settlement/utils/spendingStats';
import { CategoryDonut, CategoryLegend } from '../features/settlement/components/CategoryDonut';
import { SpendingStatsPanel } from '../features/settlement/components/SpendingStatsPanel';
import { budgetTotal, planTotal } from '../features/budget/utils/budgetRules';
import { formatMoney, formatSignedPrecise } from '../features/budget/utils/money';
import { formatTripDateRange } from '../utils/formatters';
import { TripStatusChip } from '../components/TripStatusChip';
import { travelerOfUser } from '../features/itinerary/utils/tripAccess';
import { PageLoading } from '../components/PageLoading';
import { LoadErrorState } from '../components/LoadErrorState';

// Ba trạng thái theo vòng đời tiền của một chuyến đi:
//   noPlan    — chưa xong Bước 4, tức chưa có gì để đối chiếu
//   settling  — đang chờ quyết toán (status 'settling', hoặc còn số dư khác 0)
//   done      — đã xong
type Filter = 'all' | 'noPlan' | 'settling' | 'done';

// Thứ tự đọc: chuyến đang đi trước, vì đó là chuyến đang phát sinh chi tiêu.
const STATUS_RANK: Record<Trip['status'], number> = {
  ongoing: 0,
  settling: 1,
  confirmed: 2,
  planning: 3,
  idea: 4,
  done: 5,
};

export default function SettlementHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const { trips, loading, error: tripsError, refresh } = useTrips();
  const { expenses, add, error: expensesError, reload: reloadExpenses } = useExpenses();

  const [filter, setFilter] = useState<Filter>('all');
  const [year, setYear] = useState<string>('');
  // Bấm tab tiền tệ ở thống kê → danh sách cũng chỉ còn trip dùng tiền đó.
  const [currency, setCurrency] = useState<Currency | null>(null);
  // Ô search nằm trên Header, dùng chung slice với màn Khám phá.
  const query = useAppSelector((state) => state.ui.searchQuery);
  const [formTripId, setFormTripId] = useState<string | null>(null);

  // Chỉ giữ chi tiêu của các trip tài khoản này được xem — `useExpenses()` tải
  // toàn bộ sổ của mock server.
  const byTrip = useMemo(() => {
    const visibleIds = new Set(trips.map((trip) => trip.id));
    const map = new Map<string, Expense[]>();
    for (const expense of expenses) {
      if (!visibleIds.has(expense.tripId)) continue;
      map.set(expense.tripId, [...(map.get(expense.tripId) ?? []), expense]);
    }
    return map;
  }, [expenses, trips]);

  // Tính một lần cho mỗi chuyến — `query` là state của màn này nên mỗi ký tự
  // gõ vào ô tìm kiếm không được kéo theo cả loạt tính lại.
  const statsByTrip = useMemo(() => {
    const map = new Map<string, { myBalance: number | null; open: boolean }>();
    for (const trip of trips) {
      const list = byTrip.get(trip.id) ?? [];
      const result = balances(list, trip.travelers, trip.currency);
      const me = travelerOfUser(trip, userId);
      map.set(trip.id, {
        myBalance: me ? (result[me.id] ?? 0) : null,
        open: list.length > 0 && Object.values(result).some((value) => value !== 0),
      });
    }
    return map;
  }, [trips, byTrip, userId]);

  const spending = useMemo(() => userSpendingStats(trips, byTrip, userId, year), [trips, byTrip, userId, year]);

  const years = [...new Set(trips.map((trip) => trip.startDate.slice(0, 4)))].sort().reverse();

  const visible = trips
    .filter((trip) => {
      const list = byTrip.get(trip.id) ?? [];
      const open = statsByTrip.get(trip.id)?.open ?? false;
      // "Chưa lên dự trù" = chưa xong Bước 4 (R11): chưa có khoản nào và cũng
      // chưa đặt hạn mức.
      const noPlan = trip.budgetPlan.length === 0 && budgetTotal(trip) === null;

      if (filter === 'noPlan' && !noPlan) return false;
      if (filter === 'settling' && !(trip.status === 'settling' || open)) return false;
      if (filter === 'done' && !(trip.status === 'done' || (list.length > 0 && !open))) return false;
      if (year !== '' && !trip.startDate.startsWith(year)) return false;
      if (currency !== null && trip.currency !== currency) return false;
      if (query.trim() !== '' && !trip.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.startDate.localeCompare(a.startDate));

  const formTrip = trips.find((trip) => trip.id === formTripId) ?? null;
  // Mặc định là chuyến đang đi — hai chạm từ nav item tới bàn phím số.
  const defaultTrip = visible.find((trip) => trip.status === 'ongoing') ?? visible[0] ?? null;

  if (loading) return <PageLoading />;

  if (tripsError || expensesError) {
    return (
      <LoadErrorState
        onRetry={() => {
          if (tripsError) refresh();
          if (expensesError) reloadExpenses();
        }}
      />
    );
  }

  return (
    <div className="pb-24">
      <h1 className="m-0 mb-1 font-display text-[22px] font-bold text-ink">{t('settlement.hub.title')}</h1>
      <p className="m-0 mb-5 text-[13px] text-ink-soft">{t('settlement.hub.subtitle')}</p>

      <SpendingStatsPanel
        stats={spending}
        years={years}
        year={year}
        onYearChange={setYear}
        currency={currency}
        onCurrencyChange={setCurrency}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['all', 'noPlan', 'settling', 'done'] as Filter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${
              filter === key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-soft'
            }`}
          >
            {t(`settlement.hub.filter.${key}`)}
          </button>
        ))}
        {year !== '' && (
          <span className="text-[12px] text-ink-soft">{t('settlement.hub.yearFiltered', { year })}</span>
        )}
        {currency !== null && (
          <button
            type="button"
            onClick={() => setCurrency(null)}
            aria-label={t('settlement.hub.clearCurrency', { currency })}
            className="flex items-center gap-1 rounded-full border border-ocean bg-ocean-tint px-3 py-1.5 text-[12.5px] font-semibold text-ocean-dark transition hover:bg-white"
          >
            {t('settlement.hub.currencyFiltered', { currency })}
            <CloseRoundedIcon sx={{ fontSize: 15 }} />
          </button>
        )}
      </div>

      <div className="space-y-3">
        {visible.length === 0 && (
          <p className="m-0 rounded-2xl border border-dashed border-line bg-white px-6 py-10 text-center text-[13px] text-ink-soft">
            {t('settlement.hub.empty')}
          </p>
        )}

        {visible.map((trip) => (
          <TripMoneyCard
            key={trip.id}
            trip={trip}
            expenses={byTrip.get(trip.id) ?? []}
            myBalance={statsByTrip.get(trip.id)?.myBalance ?? null}
            onOpen={(path) => navigate(path)}
          />
        ))}
      </div>

      {defaultTrip && (
        <button
          type="button"
          onClick={() => setFormTripId(defaultTrip.id)}
          className="fixed bottom-6 right-6 z-20 rounded-full bg-ocean px-5 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:bg-ocean-dark"
        >
          ＋ {t('settlement.addExpense')}
        </button>
      )}

      <Dialog open={formTrip !== null} onClose={() => setFormTripId(null)} fullWidth maxWidth="sm">
        {formTrip && (
          <div className="p-5">
            <h2 className="m-0 mb-1 font-display text-[17px] font-bold text-ink">{t('settlement.addExpense')}</h2>
            <label className="mb-4 block text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
              {t('settlement.hub.forTrip')}
              <select
                value={formTrip.id}
                onChange={(event) => setFormTripId(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-line bg-white px-2 py-2 text-[13px] font-normal normal-case tracking-normal text-ink outline-none focus:border-ocean"
              >
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
            </label>
            <ExpenseForm
              key={formTrip.id}
              trip={formTrip}
              currentUserId={userId}
              onCancel={() => setFormTripId(null)}
              onSubmit={async (input, keepOpen) => {
                await add(input);
                if (!keepOpen) setFormTripId(null);
              }}
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}

// Card của một trip: bên trái là con số (đã chi / dự trù + thanh tiến độ, số dư
// của bạn), bên phải là biểu đồ tròn đủ lớn để đọc kèm chú thích đầy đủ — bản
// cũ 64px với nhãn cho 2 loại thì gần như không đọc được.
function TripMoneyCard({
  trip,
  expenses,
  myBalance,
  onOpen,
}: {
  trip: Trip;
  expenses: Expense[];
  myBalance: number | null;
  onOpen: (path: string) => void;
}) {
  const { t } = useTranslation();
  const spent = totalSpent(expenses);
  const planned = planTotal(trip.budgetPlan, trip.party);
  const ratio = planned > 0 ? spent / planned : null;
  const byCategory = actualByCategory(expenses);
  const hasExpenses = expenses.some((expense) => expense.kind === 'expense');
  const barColor = ratio === null ? 'bg-ocean' : ratio > 1 ? 'bg-coral' : ratio > 0.8 ? 'bg-amber' : 'bg-mint';

  const header = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="font-display text-[15px] font-bold text-ink">{trip.name}</span>
      <TripStatusChip status={trip.status} />
      <span className="font-mono text-[11.5px] text-ink-soft">{formatTripDateRange(trip.startDate, trip.endDate)}</span>
    </div>
  );

  if (!hasExpenses) {
    return (
      <button
        type="button"
        onClick={() =>
          onOpen(planned === 0 && expenses.length === 0 ? `/itinerary/${trip.id}/edit/4` : `/settlement/${trip.id}`)
        }
        className="block w-full rounded-2xl border border-dashed border-line bg-white p-4 text-left transition hover:border-ocean-light"
      >
        {header}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12.5px] text-ink-soft">
            {t('settlement.hub.noExpenses')}
            {planned > 0
              ? ` · ${t('settlement.hub.plannedOnly', { amount: formatMoney(planned, trip.currency) })}`
              : ` · ${t('settlement.hub.noPlanYet')}`}
          </span>
          <span className="rounded-lg border border-ocean px-2.5 py-1 text-[12px] font-semibold text-ocean-dark">
            {planned > 0 ? t('settlement.hub.startLogging') : t('settlement.planBudget')}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(`/settlement/${trip.id}`)}
      className="flex w-full flex-col gap-4 rounded-2xl border border-line bg-white p-4 text-left transition hover:border-ocean-light hover:shadow-[0_10px_24px_-18px_rgba(29,150,194,0.35)] sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1">
        {header}

        <p className="m-0 font-mono text-[18px] font-bold text-ink">
          {formatMoney(spent, trip.currency)}
          {planned > 0 && (
            <span className="text-[13px] font-semibold text-ink-soft"> / {formatMoney(planned, trip.currency)}</span>
          )}
        </p>
        {ratio !== null && (
          <div className="mt-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
            <p className={`m-0 mt-1 text-[11.5px] ${ratio > 1 ? 'font-semibold text-coral-dark' : 'text-ink-soft'}`}>
              {ratio > 1
                ? t('settlement.hub.overPlan', { amount: formatMoney(spent - planned, trip.currency) })
                : t('settlement.hub.ofPlan', { percent: Math.round(ratio * 100) })}
            </p>
          </div>
        )}

        <p className="m-0 mt-3 text-[12px] text-ink-soft">
          {myBalance === null ? (
            t('settlement.hub.notMember')
          ) : (
            <>
              {t('settlement.summary.yourBalance')}:{' '}
              <span
                className={`font-mono font-semibold ${
                  myBalance === 0 ? 'text-ink-soft' : myBalance > 0 ? 'text-mint-dark' : 'text-coral-dark'
                }`}
              >
                {myBalance === 0 ? t('settlement.hub.allSettled') : formatSignedPrecise(myBalance, trip.currency)}
              </span>
              {myBalance !== 0 && (
                <span className="ml-1">
                  ({myBalance > 0 ? t('settlement.summary.youAreOwed') : t('settlement.summary.youOwe')})
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 sm:w-[380px] sm:flex-shrink-0 sm:border-l sm:border-line sm:pl-5">
        <CategoryDonut
          totals={byCategory}
          currency={trip.currency}
          size={104}
        />
        <div className="min-w-0 flex-1">
          <CategoryLegend totals={byCategory} currency={trip.currency} limit={4} />
        </div>
      </div>
    </button>
  );
}
