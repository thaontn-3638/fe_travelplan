import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import type { ItineraryItem, Place } from '../../../types';
import { ItineraryItemRow, type MoveTarget } from './ItineraryItemRow';

interface UnscheduledTrayProps {
  items: ItineraryItem[];
  hiddenByFilterCount?: number;
  placesById: Map<string, Place>;
  editable: boolean;
  onItemRemove?: (itemId: string) => void;
  moveTargets?: MoveTarget[];
  onItemMove?: (itemId: string, toDayId: string | null) => void;
}

// Khu "Chưa xếp ngày" — nơi item rơi vào khi xoá ngày hoặc rút ngắn chuyến,
// thay vì bị xoá mất (trip-board.md R2/R3). Luôn hiển thị ở chế độ sửa để có
// chỗ kéo item ra.
export function UnscheduledTray({
  items,
  hiddenByFilterCount = 0,
  placesById,
  editable,
  onItemRemove,
  moveTargets = [],
  onItemMove,
}: UnscheduledTrayProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({
    id: 'unscheduled',
    data: { type: 'unscheduled' },
    disabled: !editable,
  });

  if (!editable && items.length === 0 && hiddenByFilterCount === 0) {
    return null;
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-2xl border border-dashed border-line bg-white">
      <div className="flex items-center gap-2 p-4 pb-2">
        <InboxRoundedIcon fontSize="small" className="text-ink-soft" />
        <span className="font-display text-[14.5px] font-bold text-ink">
          {t('itinerary.detail.unscheduledTitle')}
        </span>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
          {sorted.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-3 pt-1 ${editable && isOver ? 'bg-ocean-tint' : ''}`}
      >
        {hiddenByFilterCount > 0 && sorted.length > 0 && (
          <p className="m-0 px-1 text-[11.5px] text-ink-soft">
            {t('itinerary.day.hiddenByFilter', { count: hiddenByFilterCount })}
          </p>
        )}

        {sorted.length === 0 && hiddenByFilterCount > 0 ? (
          <div className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed border-line text-center text-[12.5px] text-ink-soft">
            {t('itinerary.day.allHiddenByFilter', { count: hiddenByFilterCount })}
          </div>
        ) : sorted.length === 0 ? (
          <div
            className={`flex min-h-[56px] items-center justify-center rounded-xl border-2 border-dashed text-center text-[12.5px] text-ink-soft ${
              isOver ? 'border-ocean text-ocean-dark' : 'border-line'
            }`}
          >
            {t('itinerary.step2.unscheduledEmpty')}
          </div>
        ) : (
          sorted.map((item) => (
            <ItineraryItemRow
              key={item.id}
              item={item}
              place={item.placeId ? placesById.get(item.placeId) : undefined}
              placesById={placesById}
              dayId={null}
              editable={editable}
              variant="list"
              hideTime
              showNote={!editable}
              onRemove={onItemRemove ? () => onItemRemove(item.id) : undefined}
              moveTargets={moveTargets.filter((target) => target.id !== null)}
              onMove={onItemMove ? (toDayId) => onItemMove(item.id, toDayId) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
