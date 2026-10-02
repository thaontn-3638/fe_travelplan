import { useTranslation } from 'react-i18next';
import { countParty, formatTripDateRange } from '../../../utils/formatters';
import { formatMoney } from '../../budget/utils/money';
import { budgetTotal } from '../../budget/utils/budgetRules';
import type { Trip } from '../../../types';
import { TripStatusChip } from '../../../components/TripStatusChip';
import { TravelerAvatars } from '../../../components/TravelerAvatars';
import { TripProgressBar } from './TripProgressBar';
import { isDraftTrip, tripProgress } from '../utils/tripProgress';

interface TripCardProps {
  trip: Trip;
  coverUrl: string;
  onClick?: () => void;
}

// Shared by Dashboard and the Itinerary list — cover is a photo of the first
// place in the itinerary (resolveTripCoverUrl), not an icon/gradient.
export function TripCard({ trip, coverUrl, onClick }: TripCardProps) {
  const { t } = useTranslation();
  const totalTravelers = countParty(trip.party);
  const progress = tripProgress(trip);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgba(29,150,194,0.35)]"
    >
      <div className="relative h-[104px] overflow-hidden bg-line">
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        <TripStatusChip status={trip.status} onCover className="absolute left-2.5 top-2.5" />
        {isDraftTrip(trip) && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-amber-dark">
            {t('itinerary.list.draftBadge')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 pt-4">
        <h3 className="m-0 mb-1 font-display text-[15.5px] font-bold text-ink">{trip.name}</h3>
        <p className="m-0 mb-3 text-[12.5px] text-ink-soft">
          {formatTripDateRange(trip.startDate, trip.endDate)} ·{' '}
          {trip.status === 'idea'
            ? t('dashboard.trip.travelersUndecided')
            : t('dashboard.trip.travelers', { count: totalTravelers })}
        </p>
        <TripProgressBar progress={progress} className="mb-3" />

        <div className="mt-auto flex items-center justify-between">
          <span className="font-mono text-[12.5px] font-semibold text-ink">
            {budgetTotal(trip) !== null
              ? `${formatMoney(trip.spent, trip.currency)} / ${formatMoney(budgetTotal(trip)!, trip.currency)}`
              : t('dashboard.trip.budgetNotSet')}
          </span>
          <TravelerAvatars travelers={trip.travelers} size="sm" />
        </div>
      </div>
    </button>
  );
}
