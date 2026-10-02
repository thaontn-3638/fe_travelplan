import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import type { Expense, ItineraryDay, ItineraryItem, Place, ShareScope, Trip } from '../types';
import { getSharedTrip, shareScopeOf, SharedTripNotFoundError } from '../features/itinerary/api/tripApi';
import { getExpenses } from '../features/settlement/api/expenseApi';
import { actualByCategory, totalSpent } from '../features/settlement/utils/settlementRules';
import { CategoryDonut, CategoryLegend } from '../features/settlement/components/CategoryDonut';
import { VarianceTable } from '../features/settlement/components/VarianceTable';
import { ExpenseList } from '../features/settlement/components/ExpenseList';
import { SettlementTab } from '../features/settlement/components/SettlementTab';
import { getPlacesByIds } from '../features/places/api/placeApi';
import { placeIdsInTrip } from '../features/itinerary/utils/tripDefaults';
import { countTripDays } from '../features/itinerary/utils/itineraryRules';
import { dayEstimatedCosts, costPerPerson, tripEstimatedCost } from '../features/itinerary/utils/tripCosts';
import { planPerHead, planTotal } from '../features/budget/utils/budgetRules';
import { formatMoney, formatPerHead } from '../features/budget/utils/money';
import { CategoryFilterChips } from '../features/itinerary/components/CategoryFilterChips';
import { DayCard } from '../features/itinerary/components/DayCard';
import { TripTimelineView } from '../features/itinerary/components/TripTimelineView';
import { BudgetPlanView } from '../features/budget/components/BudgetPlanView';
import { BudgetBreakdown } from '../features/budget/components/BudgetBreakdown';
import { itemCategory } from '../features/itinerary/utils/categoryColors';
import type { CategoryKey } from '../features/places/utils';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { PageLoading } from '../components/PageLoading';
import { LoadErrorState } from '../components/LoadErrorState';
import { countParty, formatTripDateRange, formatTripRegions } from '../utils/formatters';
import { useAppSelector } from '../store/hooks';

type SharedTab = 'list' | 'timeline' | 'cost' | 'spending' | 'settle';

// Tab theo mức chia sẻ: mức 1 (plan) → lịch trình / timeline / dự trù;
// mức 2 (actual) → chi tiêu / quyết toán.
function tabsFor(scope: ShareScope, hasPlan: boolean): SharedTab[] {
  return [
    ...(scope.plan ? (['list', 'timeline'] as SharedTab[]) : []),
    ...(scope.plan && hasPlan ? (['cost'] as SharedTab[]) : []),
    ...(scope.actual ? (['spending', 'settle'] as SharedTab[]) : []),
  ];
}

// Trang công khai /share/:token — không cần đăng nhập (trip-share.md).
// Hiển thị đúng các mức chủ trip đã bật: mức 1 không có tên thành viên; mức 2
// (chi tiêu thực tế + quyết toán) thì có, vì không có tên thì không đọc được
// "ai trả ai".
export default function SharedTripPage() {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const isAuthenticated = useAppSelector((state) => state.auth.user !== null);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [placesById, setPlacesById] = useState<Map<string, Place>>(new Map());
  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tab, setTab] = useState<SharedTab | null>(null);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    getSharedTrip(token)
      .then(async (found) => {
        const scope = shareScopeOf(found);
        // Chỉ tải phần đã được chia sẻ.
        const [places, spent] = await Promise.all([
          scope.plan ? getPlacesByIds(placeIdsInTrip(found)) : Promise.resolve([]),
          scope.actual ? getExpenses(found.id) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setTrip(found);
        setPlacesById(new Map(places.map((place) => [place.id, place])));
        setExpenses(spent);
        setState('ready');
      })
      .catch((err: unknown) => {
        if (!cancelled) setState(err instanceof SharedTripNotFoundError ? 'notFound' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  const days = useMemo(() => [...(trip?.days ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [trip]);

  function visibleItems(day: ItineraryDay): ItineraryItem[] {
    if (!category) return day.items;
    return day.items.filter((item) => itemCategory(item, placesById) === category);
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-[16px] font-bold text-ink no-underline">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-coral text-white">
              <FlightTakeoffRoundedIcon sx={{ fontSize: 18 }} />
            </span>
            WanderPlan
          </Link>
          <span className="hidden items-center gap-1 rounded-full bg-ocean-tint px-2.5 py-1 text-[11.5px] font-bold text-ocean-dark sm:flex">
            <VisibilityRoundedIcon sx={{ fontSize: 14 }} />
            {t('share.viewOnly')}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              to={isAuthenticated ? '/dashboard' : '/register'}
              className="rounded-xl bg-ocean px-3.5 py-2 text-[12.5px] font-semibold text-white no-underline transition hover:bg-ocean-dark"
            >
              {isAuthenticated ? t('share.openApp') : t('share.cta')}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6">
        {state === 'loading' ? (
          <PageLoading />
        ) : state === 'notFound' ? (
          <div className="mx-auto max-w-[520px] rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
            <h1 className="m-0 mb-2 font-display text-lg font-bold text-ink">{t('share.notFoundTitle')}</h1>
            <p className="m-0 text-sm text-ink-soft">{t('share.notFoundBody')}</p>
          </div>
        ) : state === 'error' || !trip ? (
          <LoadErrorState onRetry={() => setNonce((value) => value + 1)} />
        ) : (
          <SharedTripBody
            trip={trip}
            days={days}
            placesById={placesById}
            expenses={expenses}
            tab={tab}
            onTabChange={setTab}
            category={category}
            onCategoryChange={setCategory}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            visibleItems={visibleItems}
          />
        )}
      </main>
    </div>
  );
}

interface SharedTripBodyProps {
  trip: Trip;
  expenses: Expense[];
  days: ItineraryDay[];
  placesById: Map<string, Place>;
  tab: SharedTab | null;
  onTabChange: (tab: SharedTab) => void;
  category: CategoryKey | null;
  onCategoryChange: (category: CategoryKey | null) => void;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  visibleItems: (day: ItineraryDay) => ItineraryItem[];
}

function SharedTripBody({
  trip,
  expenses,
  days,
  placesById,
  tab: requestedTab,
  onTabChange,
  category,
  onCategoryChange,
  selectedItemId,
  onSelectItem,
  visibleItems,
}: SharedTripBodyProps) {
  const { t } = useTranslation();
  const dayCount = countTripDays(trip.startDate, trip.endDate);
  const estimatedCost = tripEstimatedCost(trip);
  const costByDayId = dayEstimatedCosts(trip);
  const perHead = planPerHead(trip.budgetPlan, trip.party);
  const perPerson = costPerPerson(trip);
  const hasPlan = trip.budgetPlan.length > 0;

  const scope = shareScopeOf(trip);
  const tabs = tabsFor(scope, hasPlan);
  const tab: SharedTab = requestedTab && tabs.includes(requestedTab) ? requestedTab : tabs[0]!;
  const tabLabel = (value: SharedTab): string =>
    value === 'spending'
      ? t('share.tab.spending')
      : value === 'settle'
        ? t('settlement.tabs.settle')
        : t(`itinerary.detail.tab${value[0]!.toUpperCase()}${value.slice(1)}`);

  return (
    <>
      <h1 className="m-0 mb-1 font-display text-[24px] font-bold text-ink">{trip.name}</h1>
      <p className="m-0 mb-5 font-mono text-[13px] text-ink-soft">
        {formatTripRegions(trip.regions)} · {formatTripDateRange(trip.startDate, trip.endDate)} ·{' '}
        {dayCount > 1
          ? t('itinerary.detail.dayNightMeta', { days: dayCount, nights: dayCount - 1 })
          : t('itinerary.detail.oneDayMeta')}
        {' · '}
        {/* Chỉ số người — không tên, không avatar. */}
        {t('dashboard.trip.travelers', { count: countParty(trip.party) })}
      </p>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {tab === 'list' || tab === 'timeline' ? (
          <CategoryFilterChips value={category} onChange={onCategoryChange} />
        ) : (
          <span />
        )}
        <div className="inline-flex rounded-xl border border-line bg-white p-1" role="tablist">
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => onTabChange(value)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                tab === value ? 'bg-ocean-tint text-ocean-dark' : 'text-ink-soft'
              }`}
            >
              {tabLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'spending' ? (
        <SharedSpending trip={trip} expenses={expenses} withPlan={scope.plan} />
      ) : tab === 'settle' ? (
        <SettlementTab trip={trip} expenses={expenses} currentUserId="" />
      ) : tab === 'timeline' ? (
        <TripTimelineView
          trip={trip}
          placesById={placesById}
          category={category}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
        />
      ) : tab === 'cost' ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-last min-w-0 lg:order-none">
            <BudgetPlanView trip={trip} />
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[14px] font-bold text-ink">{t('itinerary.detail.totalEstimated')}</span>
                <span className="font-mono text-[18px] font-bold text-ink">
                  {formatMoney(estimatedCost, trip.currency)}
                </span>
              </div>
              <p className="m-0 flex flex-wrap justify-end gap-x-4 text-[12.5px] text-ink-soft">
                <span>
                  {t('itinerary.step4.perAdult')}: {formatPerHead(perHead.adult, trip.currency)}
                </span>
                {trip.party.children > 0 && (
                  <span>
                    {t('itinerary.step4.perChild')}: {formatPerHead(perHead.child, trip.currency)}
                  </span>
                )}
                {perPerson !== null && (
                  <span>{t('itinerary.detail.perPerson', { amount: formatPerHead(perPerson, trip.currency) })}</span>
                )}
              </p>
            </div>
            <BudgetBreakdown trip={trip} hidePlanningHints />
          </div>
        </div>
      ) : (
        <div className="mx-auto flex max-w-[820px] flex-col gap-3">
          {days.map((day, index) => (
            <DayCard
              key={day.id}
              day={day}
              dayIndex={index + 1}
              dayCost={costByDayId[day.id] ?? 0}
              currency={trip.currency}
              visibleItems={visibleItems(day)}
              hiddenByFilterCount={day.items.length - visibleItems(day).length}
              placesById={placesById}
              editable={false}
              showNotes
              timeVariant="axis"
            />
          ))}
        </div>
      )}
    </>
  );
}

// Mức 2 — chi tiêu thực tế. Bật cùng mức 1 thì có thêm so sánh với dự trù.
function SharedSpending({ trip, expenses, withPlan }: { trip: Trip; expenses: Expense[]; withPlan: boolean }) {
  const { t } = useTranslation();
  const spent = totalSpent(expenses);
  const planned = planTotal(trip.budgetPlan, trip.party);
  const diff = spent - planned;
  const totals = actualByCategory(expenses);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-2xl border border-line bg-white p-5">
        <div>
          <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
            {t('settlement.summary.spent')}
          </p>
          <p className="m-0 font-display text-[24px] font-bold text-ink">{formatMoney(spent, trip.currency)}</p>
        </div>
        {withPlan && planned > 0 && (
          <div>
            <p className="m-0 text-[11.5px] font-semibold uppercase tracking-wide text-ink-soft">
              {t('settlement.summary.vsPlanned')}
            </p>
            <p className={`m-0 font-display text-[19px] font-bold ${diff > 0 ? 'text-coral-dark' : 'text-mint-dark'}`}>
              {diff === 0 ? '±0' : `${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff), trip.currency)}`}
            </p>
            <p className="m-0 text-[11.5px] text-ink-soft">
              {t('itinerary.detail.totalEstimated')}: {formatMoney(planned, trip.currency)}
            </p>
          </div>
        )}
        {spent > 0 && (
          <div className="flex min-w-[240px] flex-1 items-center gap-4">
            <CategoryDonut totals={totals} currency={trip.currency} size={84} />
            <div className="min-w-0 flex-1">
              <CategoryLegend totals={totals} currency={trip.currency} />
            </div>
          </div>
        )}
      </div>

      {withPlan && <VarianceTable trip={trip} expenses={expenses} />}

      <ExpenseList trip={trip} expenses={expenses} />
    </div>
  );
}
