import { useTranslation } from 'react-i18next';
import { formatTripDateRange, formatTripRegions } from '../../../utils/formatters';
import { formatMoney } from '../../budget/utils/money';
import { budgetTotal } from '../../budget/utils/budgetRules';
import type { Place, Trip } from '../../../types';
import { resolveTripCoverUrl } from '../../itinerary/utils/tripDefaults';
import { TripStatusChip } from '../../../components/TripStatusChip';
import { TravelerAvatars } from '../../../components/TravelerAvatars';

interface BoardingPassHeroProps {
  trip: Trip;
  placesById: Map<string, Place>;
}

export function BoardingPassHero({ trip, placesById }: BoardingPassHeroProps) {
  const { t } = useTranslation();
  const cap = budgetTotal(trip);
  const progress = cap !== null && cap > 0 ? Math.min(100, Math.round((trip.spent / cap) * 100)) : 0;
  // Cùng ngưỡng màu với màn 精算 (SettlementHubPage): >80% vàng, vượt thì đỏ.
  const ratio = cap !== null && cap > 0 ? trip.spent / cap : 0;
  const over = cap !== null && trip.spent > cap;
  const barColor = over ? 'bg-coral' : ratio > 0.8 ? 'bg-amber' : 'bg-mint';

  return (
    <div className="mb-10 flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_10px_26px_-18px_rgba(29,150,194,0.28)] md:flex-row">
      <div className="relative flex-1 p-7">
        <TripStatusChip status={trip.status} className="absolute right-7 top-6" />

        <div className="mb-[18px] flex items-center gap-3.5">
          <img
            src={resolveTripCoverUrl(trip, placesById)}
            alt=""
            className="h-[52px] w-[52px] flex-shrink-0 rounded-2xl object-cover"
          />
          <div>
            <h3 className="m-0 font-display text-[22px] font-bold text-ink">{trip.name}</h3>
          </div>
        </div>

        <div className="mb-5 mt-4 flex flex-wrap gap-8">
          <div>
            <div className="mb-[5px] text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('dashboard.boardingPass.destination')}
            </div>
            <div className="font-display text-[15px] font-semibold text-ink">{formatTripRegions(trip.regions)}</div>
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
            <TravelerAvatars travelers={trip.travelers} />
          </div>
        </div>

        {cap !== null ? (
          <div className="mt-1">
            <div className="mb-1.5 flex justify-between text-xs text-ink-soft">
              <span>{t('dashboard.boardingPass.budgetUsed')}</span>
              <span className="font-mono">
                {formatMoney(trip.spent, trip.currency)} / {formatMoney(cap, trip.currency)}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${progress}%` }} />
            </div>
            {over && (
              <p className="m-0 mt-1 text-[11.5px] font-semibold text-coral-dark">
                {t('settlement.hub.overPlan', { amount: formatMoney(trip.spent - cap, trip.currency) })}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-1 text-xs font-semibold text-ink-soft">{t('dashboard.trip.budgetNotSet')}</div>
        )}
      </div>
    </div>
  );
}
