import { useTranslation } from 'react-i18next';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StickyNote2RoundedIcon from '@mui/icons-material/StickyNote2Rounded';
import { Chip } from '@mui/material';
import type { Place } from '../../../types';
import { formatPlacePrice } from '../../../utils/formatters';
import { suggestedDurationMinutes } from '../utils/categoryColors';

interface ItineraryPlaceDetailPaneProps {
  place: Place;
  onBack?: () => void;
  timeRangeLabel?: string;
  // Ghi chú của mục đang xem trong lịch trình (khác với mô tả của địa điểm).
  note?: string;
}

// Read-only place detail — used by the wishlist column (with a back button)
// and, in the trip detail screen, as the scroll-synced right pane.
export function ItineraryPlaceDetailPane({
  place,
  onBack,
  timeRangeLabel,
  note,
}: ItineraryPlaceDetailPaneProps) {
  const { t } = useTranslation();
  const durationMinutes = suggestedDurationMinutes(place.category);

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="relative h-[160px] bg-line">
        <img src={place.coverUrl} alt={place.title} className="h-full w-full object-cover" />
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-sm"
          >
            <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
            {t('itinerary.wishlist.backButton')}
          </button>
        )}
        {timeRangeLabel && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/95 px-3 py-1.5 font-mono text-[12.5px] font-semibold text-ink">
            {timeRangeLabel}
          </span>
        )}
      </div>

      <div className="p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {place.category && <Chip size="small" label={t(`discover.category.${place.category}`)} />}
          {typeof place.rating === 'number' && (
            <span className="flex items-center gap-0.5 text-[13px] font-semibold text-amber-dark">
              <StarRoundedIcon sx={{ fontSize: 16 }} />
              {place.rating.toFixed(1)}
            </span>
          )}
        </div>

        <h3 className="m-0 mb-1 font-display text-[17px] font-bold text-ink">{place.title}</h3>
        <p className="m-0 mb-3 flex items-start gap-1 text-[13px] text-ink-soft">
          <PlaceRoundedIcon sx={{ fontSize: 15, flexShrink: 0, marginTop: '2px' }} />
          <span>{place.address}</span>
        </p>

        {note && (
          <div className="mb-3 rounded-xl border border-amber bg-amber-tint/50 p-3">
            <h4 className="m-0 mb-1 flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-dark">
              <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />
              {t('itinerary.detail.itemNote')}
            </h4>
            <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{note}</p>
          </div>
        )}

        {place.description && (
          <div className="mb-3 border-t border-line pt-3">
            <h4 className="m-0 mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('discover.descriptionLabel')}
            </h4>
            <p className="m-0 text-[13px] leading-relaxed text-ink">{place.description}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
          <div>
            <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('itinerary.detail.priceLabel')}
            </div>
            <div className="font-mono text-[13.5px] font-semibold text-ink">
              {place.price ? formatPlacePrice(place) : t('discover.priceFree')}
            </div>
          </div>
          {durationMinutes !== null && (
            <div>
              <div className="mb-0.5 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
                {t('itinerary.detail.durationLabel')}
              </div>
              <div className="text-[13.5px] font-semibold text-ink">
                {durationMinutes < 60
                  ? t('itinerary.detail.durationMinutes', { minutes: durationMinutes })
                  : t('itinerary.detail.durationHours', {
                      hours: Number.isInteger(durationMinutes / 60)
                        ? durationMinutes / 60
                        : (durationMinutes / 60).toFixed(1),
                    })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
