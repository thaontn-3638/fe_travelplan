import { useTranslation } from 'react-i18next';
import type { ItineraryItem, Place } from '../../../types';
import { CATEGORY_EVENT_COLORS, itemCategory } from '../utils/categoryColors';

interface DragPreviewCardProps {
  item: ItineraryItem | null;
  place: Place | undefined;
  placesById: Map<string, Place>;
}

// Bản xem trước bám theo con trỏ khi kéo (DragOverlay). Không có nó thì người
// dùng chỉ thấy hàng gốc mờ đi, rất khó biết mình đang kéo gì và tới đâu.
export function DragPreviewCard({ item, place, placesById }: DragPreviewCardProps) {
  const { t } = useTranslation();

  if (!item && !place) {
    return null;
  }

  const colors = item
    ? CATEGORY_EVENT_COLORS[itemCategory(item, placesById)]
    : CATEGORY_EVENT_COLORS.other;

  const title = item
    ? item.kind === 'activity'
      ? (item.title ?? t('itinerary.item.untitledActivity'))
      : (placesById.get(item.placeId ?? '')?.title ?? t('itinerary.item.missingPlace'))
    : (place?.title ?? '');

  const cover = item ? placesById.get(item.placeId ?? '')?.coverUrl : place?.coverUrl;

  return (
    <div
      className="flex w-[280px] rotate-2 items-center gap-2.5 rounded-xl border-l-[5px] bg-white p-2.5 shadow-[0_18px_36px_-12px_rgba(12,59,82,0.45)]"
      style={{ borderLeftColor: colors.border }}
    >
      {cover ? (
        <img src={cover} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <span
          className="h-10 w-10 flex-shrink-0 rounded-lg"
          style={{ backgroundColor: colors.fill }}
        />
      )}
      <span className="truncate text-[13.5px] font-semibold text-ink">{title}</span>
    </div>
  );
}
