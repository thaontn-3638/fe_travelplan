import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrips } from '../features/itinerary/hooks/useTrips';
import { usePlaceCatalog } from '../features/itinerary/hooks/usePlaceCatalog';
import { TripCardGrid } from '../features/itinerary/components/TripCardGrid';
import { TripKanbanBoard } from '../features/itinerary/components/TripKanbanBoard';
import type { Trip } from '../types';
import { PageLoading } from '../components/PageLoading';
import { LoadErrorState } from '../components/LoadErrorState';

type ListView = 'grid' | 'kanban';

export default function ItineraryListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trips, loading, error: tripsError, setStatus, refresh } = useTrips();
  const { placesById } = usePlaceCatalog(user?.id ?? '');
  const [view, setView] = useState<ListView>('grid');
  const [statusError, setStatusError] = useState<string | null>(null);

  const goToTrip = (trip: Trip) => navigate(`/itinerary/${trip.id}`);
  const goToCreate = () => navigate('/itinerary/new');

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
          <h1 className="m-0 mb-1.5 font-display text-[26px] font-bold text-ink">{t('itinerary.list.title')}</h1>
          <p className="m-0 text-[14.5px] text-ink-soft">
            {t('itinerary.list.subtitle', { count: trips.length })}
          </p>
        </div>

        <button
          type="button"
          onClick={goToCreate}
          className="flex items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark"
        >
          ＋ {t('nav.newTrip')}
        </button>
      </div>

      {trips.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            {(['grid', 'kanban'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  view === value ? 'bg-ocean-tint text-ocean-dark' : 'text-ink-soft'
                }`}
              >
                {t(value === 'grid' ? 'itinerary.list.viewGrid' : 'itinerary.list.viewKanban')}
              </button>
            ))}
          </div>

          {view === 'kanban' && (
            <span className="text-[12px] text-ink-soft">{t('itinerary.kanban.dragHint')}</span>
          )}
          {statusError && (
            <span className="text-[12.5px] font-semibold text-coral-dark">{statusError}</span>
          )}
        </div>
      )}

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
          <h3 className="m-0 font-display text-lg font-bold text-ink">{t('itinerary.list.emptyTitle')}</h3>
          <p className="m-0 max-w-sm text-sm text-ink-soft">{t('itinerary.list.emptyDescription')}</p>
          <button
            type="button"
            onClick={goToCreate}
            className="mt-2 flex items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark"
          >
            ＋ {t('nav.newTrip')}
          </button>
        </div>
      ) : view === 'kanban' ? (
        <TripKanbanBoard
          trips={trips}
          placesById={placesById}
          onTripClick={goToTrip}
          onStatusChange={(tripId, status) => {
            setStatusError(null);
            void setStatus(tripId, status).catch(() => setStatusError(t('itinerary.kanban.statusError')));
          }}
        />
      ) : (
        <TripCardGrid trips={trips} placesById={placesById} onTripClick={goToTrip} />
      )}
    </div>
  );
}
