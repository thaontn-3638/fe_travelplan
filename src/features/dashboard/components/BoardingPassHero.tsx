import { useTranslation } from 'react-i18next';
import { formatCurrencyJPY, formatTripDateRange } from '../../../utils/formatters';
import type { TripSummary } from '../types';
import { TripCoverIcon } from './TripCoverIcon';
import { ICON_GRADIENT_STYLE } from './iconGradients';
import { TripStatusChip } from './TripStatusChip';
import { TravelerAvatars } from './TravelerAvatars';

interface BoardingPassHeroProps {
  trip: TripSummary;
}

export function BoardingPassHero({ trip }: BoardingPassHeroProps) {
  const { t } = useTranslation();
  const progress = trip.budget !== null ? Math.min(100, Math.round((trip.spent / trip.budget) * 100)) : 0;

  return (
    <div className="mb-10 flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_26px_-18px_rgba(29,150,194,0.28)] md:flex-row">
      <div className="relative flex-1 p-7">
        <TripStatusChip status={trip.status} className="absolute right-7 top-6" />

        <div className="mb-[18px] flex items-center gap-3.5">
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl"
            style={ICON_GRADIENT_STYLE[trip.icon]}
          >
            <TripCoverIcon icon={trip.icon} className="h-[26px] w-[26px]" />
          </div>
          <div>
            <h3 className="m-0 font-display text-[22px] font-bold text-ink">{t(`dashboard.trips.${trip.translationKey}.title`)}</h3>
            <p className="m-0 mt-0.5 text-[13px] text-ink-soft">
              {t(`dashboard.trips.${trip.translationKey}.subtitle`)}
            </p>
          </div>
        </div>

        <div className="mb-5 mt-4 flex flex-wrap gap-8">
          <div>
            <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('dashboard.boardingPass.destination')}
            </div>
            <div className="font-display text-[15px] font-semibold text-ink">
              {t(`dashboard.trips.${trip.translationKey}.destination`)}
            </div>
          </div>
          <div>
            <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('dashboard.boardingPass.dates')}
            </div>
            <div className="font-mono text-[15px] font-semibold text-ink">
              {formatTripDateRange(trip.startDate, trip.endDate)}
            </div>
          </div>
          <div>
            <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('dashboard.boardingPass.travelers')}
            </div>
            <TravelerAvatars travelers={trip.travelers} extraCount={trip.extraTravelers} />
          </div>
        </div>

        {trip.budget !== null ? (
          <div className="mt-1">
            <div className="mb-1.5 flex justify-between text-xs text-ink-soft">
              <span>{t('dashboard.boardingPass.budgetUsed')}</span>
              <span className="font-mono">
                {formatCurrencyJPY(trip.spent)} / {formatCurrencyJPY(trip.budget)}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-mint" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <div className="mt-1 text-xs font-semibold text-ink-soft">{t('dashboard.trip.budgetNotSet')}</div>
        )}
      </div>
    </div>
  );
}
