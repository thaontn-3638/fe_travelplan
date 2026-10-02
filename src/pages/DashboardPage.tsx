import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Snackbar } from '@mui/material';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrips } from '../features/itinerary/hooks/useTrips';
import { useTripCovers } from '../features/itinerary/hooks/useTripCovers';
import { useExpenses } from '../features/settlement/hooks/useExpenses';
import { balances } from '../features/settlement/utils/settlementRules';
import {
  getDashboardTasks,
  getFeaturedTrip,
  getGreetingHighlights,
  getNextTripCountdownDays,
  getTotalBudgetByCurrency,
  getTripsThisMonthCount,
  type DashboardTask,
  type TripMoneyState,
} from '../features/dashboard/selectors';
import type { Currency, Expense, TripStatus } from '../types';
import { StatFlapBoard, type FlapStat } from '../features/dashboard/components/StatFlapBoard';
import { BoardingPassHero } from '../features/dashboard/components/BoardingPassHero';
import { DashboardTaskList } from '../features/dashboard/components/DashboardTaskList';
import { EmptyTripsState } from '../features/dashboard/components/EmptyTripsState';
import { CURRENCIES, formatMoney } from '../features/budget/utils/money';
import { todayISO } from '../utils/dateFormat';
import { PageLoading } from '../components/PageLoading';
import { LoadErrorState } from '../components/LoadErrorState';

// "Để sau" chỉ là tiện ích của từng trình duyệt — mất đi thì việc hiện lại,
// không hỏng gì. Khoá theo user để hai tài khoản trên cùng máy không lẫn nhau.
function dismissedStorageKey(userId: string): string {
  return `wanderplan_dismissed_tasks_${userId}`;
}

function readDismissed(userId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(dismissedStorageKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(userId: string, keys: Set<string>): void {
  try {
    window.localStorage.setItem(dismissedStorageKey(userId), JSON.stringify([...keys]));
  } catch {
    // Trình duyệt chặn storage: bỏ qua, việc sẽ hiện lại lần sau.
  }
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? '';

  const { trips, loading, error: tripsError, setStatus, refresh } = useTrips();
  const { expenses } = useExpenses();
  const placesById = useTripCovers(userId);

  const [dismissed, setDismissed] = useState<Set<string>>(() => readDismissed(userId));
  const [expanded, setExpanded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ tripId: string; tripName: string; previous: TripStatus; next: TripStatus } | null>(
    null,
  );
  const [statusError, setStatusError] = useState(false);
  const [dismissUndo, setDismissUndo] = useState<DashboardTask | null>(null);

  const now = new Date();
  const today = todayISO(now);
  const hasTrips = trips.length > 0;

  // Trạng thái tiền của từng trip — cần cho "đã kết thúc mà còn số dư".
  const moneyByTrip = useMemo(() => {
    const byTrip = new Map<string, Expense[]>();
    for (const expense of expenses) {
      byTrip.set(expense.tripId, [...(byTrip.get(expense.tripId) ?? []), expense]);
    }

    const map = new Map<string, TripMoneyState>();
    for (const trip of trips) {
      const list = byTrip.get(trip.id) ?? [];
      map.set(trip.id, {
        hasExpenses: list.some((expense) => expense.kind === 'expense'),
        openBalance:
          list.length > 0 && Object.values(balances(list, trip.travelers, trip.currency)).some((value) => value !== 0),
      });
    }
    return map;
  }, [trips, expenses]);

  const allTasks = getDashboardTasks(trips, moneyByTrip, today);
  const tasks = allTasks.filter((task) => !dismissed.has(task.key));
  const hiddenCount = allTasks.length - tasks.length;

  const tripsThisMonth = getTripsThisMonthCount(trips, now);
  const budgetByCurrency = getTotalBudgetByCurrency(trips);
  const featuredTrip = getFeaturedTrip(trips, now);
  const countdownDays = getNextTripCountdownDays(trips, now);
  const highlights = getGreetingHighlights(trips, now);

  const subtitleParts: string[] = [];
  if (highlights.endingToday) {
    subtitleParts.push(t('dashboard.greeting.endingToday', { title: highlights.endingToday.name }));
  }
  if (highlights.pendingSettlement) {
    subtitleParts.push(t('dashboard.greeting.pendingSettlement', { title: highlights.pendingSettlement.name }));
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' ') : t('dashboard.overview');

  // Không có tỉ giá nên mỗi đơn vị tiền một dòng riêng — chỉ những đơn vị
  // đang có trip dùng (dashboard.md "合計予算").
  const budgetCurrencies = CURRENCIES.filter((currency: Currency) => budgetByCurrency[currency] !== undefined);
  const budgetLines =
    budgetCurrencies.length === 0
      ? [{ key: 'none', value: formatMoney(0, trips[0]?.currency ?? 'JPY') }]
      : budgetCurrencies.map((currency) => ({ key: currency, label: currency, value: formatMoney(budgetByCurrency[currency]!, currency) }));

  // 保存した場所 đã có huy hiệu trên header — bỏ khỏi đây để khỏi lặp.
  const stats: FlapStat[] = [
    { id: 'tripCount', label: t('dashboard.stats.tripCount'), value: String(trips.length).padStart(2, '0'), accent: 'ocean' },
    { id: 'thisMonth', label: t('dashboard.stats.thisMonth'), value: String(tripsThisMonth).padStart(2, '0'), accent: 'coral' },
    { id: 'totalBudget', label: t('dashboard.stats.totalBudget'), value: '', lines: budgetLines, accent: 'amber' },
  ];

  function updateDismissed(update: (next: Set<string>) => void): void {
    setDismissed((current) => {
      const next = new Set(current);
      update(next);
      writeDismissed(userId, next);
      return next;
    });
  }

  function dismiss(task: DashboardTask): void {
    updateDismissed((next) => next.add(task.key));
    setDismissUndo(task);
  }

  function changeStatus(task: Extract<DashboardTask, { kind: 'status' }>): void {
    const previous = task.trip.status;
    setBusyKey(task.key);
    setStatusError(false);
    void setStatus(task.trip.id, task.suggested)
      .then(() => setUndo({ tripId: task.trip.id, tripName: task.trip.name, previous, next: task.suggested }))
      .catch(() => setStatusError(true))
      .finally(() => setBusyKey(null));
  }

  if (loading) {
    return <PageLoading />;
  }

  if (tripsError) {
    return <LoadErrorState onRetry={refresh} />;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 mb-1.5 font-display text-[26px] font-bold text-ink">
            {t('dashboard.welcome', { name: user?.fullName ?? '' })}
          </h1>
          <p className="m-0 text-[14.5px] text-ink-soft">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3.5 rounded-2xl bg-ocean px-5 py-3.5 text-white">
          {countdownDays === 0 ? (
            <div className="font-display text-[15px] font-bold text-gold">{t('dashboard.countdown.today')}</div>
          ) : countdownDays !== null ? (
            <>
              <div className="font-mono text-[26px] font-semibold text-gold">{countdownDays}</div>
              <div className="text-xs leading-[1.4] text-sky-tint">
                {t('dashboard.countdown.unit')}
                <br />
                {t('dashboard.countdown.caption')}
              </div>
            </>
          ) : (
            <div className="text-xs text-sky-tint">{t('dashboard.countdown.empty')}</div>
          )}
        </div>
      </div>

      <StatFlapBoard stats={stats} />

      {hasTrips ? (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 flex items-center gap-2.5 text-[17px] font-bold text-ink">
              {t('dashboard.sections.upcoming')}
            </h2>
            {featuredTrip && (
              <button
                type="button"
                onClick={() => navigate(`/itinerary/${featuredTrip.id}`)}
                className="text-[13px] font-semibold text-ocean-dark"
              >
                {t('dashboard.sections.openItinerary')}
              </button>
            )}
          </div>

          {featuredTrip ? (
            <BoardingPassHero trip={featuredTrip} placesById={placesById} />
          ) : (
            <p className="mb-10 rounded-2xl border border-dashed border-line bg-white px-5 py-6 text-center text-[13px] text-ink-soft">
              {t('dashboard.countdown.empty')}
            </p>
          )}

          <DashboardTaskList
            tasks={tasks}
            expanded={expanded}
            busyKey={busyKey}
            onToggleExpanded={() => setExpanded((value) => !value)}
            onChangeStatus={changeStatus}
            onDismiss={dismiss}
            hiddenCount={hiddenCount}
            onRestoreHidden={() =>
              // Chỉ khôi phục việc còn hiệu lực; key của việc đã hết hạn cũng dọn luôn.
              updateDismissed((next) => next.clear())
            }
          />
        </>
      ) : (
        <EmptyTripsState />
      )}

      <Snackbar
        open={undo !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => reason !== 'clickaway' && setUndo(null)}
        message={
          undo ? t('dashboard.tasks.statusChanged', { name: undo.tripName, status: t(`dashboard.status.${undo.next}`) }) : ''
        }
        action={
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              const target = undo;
              setUndo(null);
              if (target) void setStatus(target.tripId, target.previous).catch(() => setStatusError(true));
            }}
          >
            {t('dashboard.tasks.undo')}
          </Button>
        }
      />
      <Snackbar
        open={dismissUndo !== null}
        autoHideDuration={6000}
        onClose={(_, reason) => reason !== 'clickaway' && setDismissUndo(null)}
        message={dismissUndo ? t('dashboard.tasks.dismissed', { name: dismissUndo.trip.name }) : ''}
        action={
          <Button
            size="small"
            color="inherit"
            onClick={() => {
              const target = dismissUndo;
              setDismissUndo(null);
              if (target) updateDismissed((next) => next.delete(target.key));
            }}
          >
            {t('dashboard.tasks.undo')}
          </Button>
        }
      />
      <Snackbar
        open={statusError}
        autoHideDuration={5000}
        onClose={() => setStatusError(false)}
        message={t('dashboard.tasks.statusError')}
      />
    </div>
  );
}
