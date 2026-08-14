import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useAppSelector } from '../store/hooks';
import { MOCK_TRIPS, SAVED_PLACES_COUNT } from '../features/dashboard/data/mockTrips';
import {
  getFeaturedTrip,
  getGreetingHighlights,
  getNextTripCountdownDays,
  getTotalBudget,
  getTripsThisMonthCount,
  searchTripsByName,
} from '../features/dashboard/selectors';
import type { TripSummary } from '../features/dashboard/types';
import { StatFlapBoard, type FlapStat } from '../features/dashboard/components/StatFlapBoard';
import { BoardingPassHero } from '../features/dashboard/components/BoardingPassHero';
import { TripGrid } from '../features/dashboard/components/TripGrid';
import { TripDetailsDialog } from '../features/dashboard/components/TripDetailsDialog';
import { EmptyTripsState } from '../features/dashboard/components/EmptyTripsState';
import { ComingSoonButton } from '../components/ComingSoonButton';
import { formatCurrencyJPY } from '../utils/formatters';

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const searchQuery = useAppSelector((state) => state.ui.searchQuery);
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);

  const now = new Date();
  const trips = MOCK_TRIPS;
  const hasTrips = trips.length > 0;

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = searchTripsByName(trips, searchQuery);

  const tripsThisMonth = getTripsThisMonthCount(trips, now);
  const totalBudget = getTotalBudget(trips);
  const featuredTrip = getFeaturedTrip(trips, now);
  const countdownDays = getNextTripCountdownDays(trips, now);
  const highlights = getGreetingHighlights(trips, now);

  const subtitleParts: string[] = [];
  if (highlights.endingToday) {
    subtitleParts.push(
      t('dashboard.greeting.endingToday', {
        title: t(`dashboard.trips.${highlights.endingToday.translationKey}.title`),
      }),
    );
  }
  if (highlights.pendingSettlement) {
    subtitleParts.push(
      t('dashboard.greeting.pendingSettlement', {
        title: t(`dashboard.trips.${highlights.pendingSettlement.translationKey}.title`),
      }),
    );
  }
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(' ') : t('dashboard.overview');

  const stats: FlapStat[] = [
    { id: 'tripCount', label: t('dashboard.stats.tripCount'), value: String(trips.length).padStart(2, '0'), accent: 'ocean' },
    { id: 'thisMonth', label: t('dashboard.stats.thisMonth'), value: String(tripsThisMonth).padStart(2, '0'), accent: 'coral' },
    { id: 'totalBudget', label: t('dashboard.stats.totalBudget'), value: formatCurrencyJPY(totalBudget), accent: 'amber' },
    { id: 'savedPlaces', label: t('dashboard.stats.savedPlaces'), value: String(SAVED_PLACES_COUNT).padStart(2, '0'), accent: 'violet' },
  ];

  if (isSearching) {
    return (
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="m-0 flex items-center gap-2.5 text-[17px] font-bold text-ink">
            {t('dashboard.search.results')}
            <span className="rounded-full border border-line bg-white px-2.5 py-0.5 font-mono text-[13px] text-ink-soft">
              {searchResults.length}
            </span>
          </h2>
        </div>

        {searchResults.length > 0 ? (
          <TripGrid trips={searchResults} onTripClick={setSelectedTrip} showAddCard={false} />
        ) : (
          <div className="flex min-h-[212px] items-center justify-center rounded-2xl border border-dashed border-line bg-white text-center text-sm text-ink-soft">
            {t('dashboard.search.noResults', { query: searchQuery.trim() })}
          </div>
        )}

        {selectedTrip && <TripDetailsDialog trip={selectedTrip} onClose={() => setSelectedTrip(null)} />}
      </div>
    );
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
          {countdownDays !== null ? (
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
              <span className="rounded-full border border-line bg-white px-2.5 py-0.5 font-mono text-[13px] text-ink-soft">
                {featuredTrip ? 1 : 0}
              </span>
            </h2>
            <ComingSoonButton className="text-[13px] font-semibold text-ocean-dark">
              {t('dashboard.sections.openItinerary')}
            </ComingSoonButton>
          </div>

          {featuredTrip && <BoardingPassHero trip={featuredTrip} />}

          <div className="mb-4 flex items-center justify-between">
            <h2 className="m-0 flex items-center gap-2.5 text-[17px] font-bold text-ink">
              {t('dashboard.sections.allTrips')}
              <span className="rounded-full border border-line bg-white px-2.5 py-0.5 font-mono text-[13px] text-ink-soft">
                {trips.length}
              </span>
            </h2>
            <ComingSoonButton className="text-[13px] font-semibold text-ocean-dark">
              {t('dashboard.sections.viewAll')}
            </ComingSoonButton>
          </div>

          <TripGrid trips={trips} onTripClick={setSelectedTrip} />

          {selectedTrip && <TripDetailsDialog trip={selectedTrip} onClose={() => setSelectedTrip(null)} />}
        </>
      ) : (
        <EmptyTripsState />
      )}
    </div>
  );
}
