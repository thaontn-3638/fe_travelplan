import { useTranslation } from 'react-i18next';
import { formatCurrencyJPY, formatTripDateRange } from '../../../utils/formatters';
import type { TripSummary } from '../types';
import { TripCoverIcon } from './TripCoverIcon';
import { ICON_GRADIENT_STYLE } from './iconGradients';
import { TripStatusChip } from './TripStatusChip';
import { TravelerAvatars } from './TravelerAvatars';

interface TripCardProps {
  trip: TripSummary;
  onClick?: () => void;
}

export function TripCard({ trip, onClick }: TripCardProps) {
  const { t } = useTranslation();
  const totalTravelers = trip.travelers.length + trip.extraTravelers;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-18px_rgba(29,150,194,0.35)]"
    >
      <div
        className="relative flex h-[104px] items-center justify-center"
        style={ICON_GRADIENT_STYLE[trip.icon]}
      >
        <TripStatusChip status={trip.status} onCover className="absolute left-2.5 top-2.5" />
        <TripCoverIcon icon={trip.icon} className="h-11 w-11 opacity-95" />
      </div>

      <div className="flex flex-1 flex-col p-4 pt-4">
        <h3 className="m-0 mb-1 font-display text-[15.5px] font-bold text-ink">
          {t(`dashboard.trips.${trip.translationKey}.title`)}
        </h3>
        <p className="m-0 mb-3 text-[12.5px] text-ink-soft">
          {formatTripDateRange(trip.startDate, trip.endDate)} ・{' '}
          {trip.status === 'idea'
            ? t('dashboard.trip.travelersUndecided')
            : t('dashboard.trip.travelers', { count: totalTravelers })}
        </p>
        <div className="mt-auto flex items-center justify-between">
          <span className="font-mono text-[12.5px] font-semibold text-ink">
            {trip.budget !== null
              ? `${formatCurrencyJPY(trip.spent)} / ${formatCurrencyJPY(trip.budget)}`
              : t('dashboard.trip.budgetNotSet')}
          </span>
          <TravelerAvatars travelers={trip.travelers} extraCount={trip.extraTravelers} size="sm" />
        </div>
      </div>
    </button>
  );
}
