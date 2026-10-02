import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import type { ItineraryItem, Place, Region, Trip } from '../../../types';
import type { CategoryKey } from '../../places/utils';
import { DayCard } from './DayCard';
import { UnscheduledTray } from './UnscheduledTray';
import { PlacePickerPanel } from './PlacePickerPanel';
import type { ActivityInput } from './AddActivityForm';
import { MobileColumnTabs } from './MobileColumnTabs';
import { countPlaceUsage } from '../utils/wishlist';
import { itemCategory } from '../utils/categoryColors';
import { isTimed } from '../utils/itineraryRules';
import { formatDate } from '../../../utils/dateFormat';
import { placeIdsInTrip } from '../utils/tripDefaults';
import { dayEstimatedCosts } from '../utils/tripCosts';
import type { SavedPlace } from '../../../types';

interface ItineraryBoardProps {
  trip: Trip;
  placesById: Map<string, Place>;
  regions: Region[];
  savedPlaces: SavedPlace[];
  currentUserId: string;
  category: CategoryKey | null;
  mobileTab: 'left' | 'right';
  onMobileTabChange: (tab: 'left' | 'right') => void;
  onAddPlace: (placeId: string, dayId: string | null) => void;
  onAddActivity: (dayId: string, input: ActivityInput) => void;
  onRemoveItem: (itemId: string) => void;
  onMoveItem: (itemId: string, fromDayId: string | null, toDayId: string | null) => void;
  onRemoveDay: (dayId: string) => void;
  onSwapDays: (dayIdA: string, dayIdB: string) => void;
  onAddDay: () => void;
  onPlaceCreated: (place: Place) => void;
}

// Bảng 2 cột của Bước 2: bên trái là các ngày + khu "Chưa xếp ngày", bên phải
// là panel chọn địa điểm. Không hiển thị giờ ở bước này (R4).
export function ItineraryBoard({
  trip,
  placesById,
  regions,
  savedPlaces,
  currentUserId,
  category,
  mobileTab,
  onMobileTabChange,
  onAddPlace,
  onAddActivity,
  onRemoveItem,
  onMoveItem,
  onRemoveDay,
  onSwapDays,
  onAddDay,
  onPlaceCreated,
}: ItineraryBoardProps) {
  const { t } = useTranslation();
  const [pendingRemoveDay, setPendingRemoveDay] = useState<string | null>(null);
  const usageByPlaceId = countPlaceUsage(placeIdsInTrip(trip));
  const costByDayId = dayEstimatedCosts(trip);
  const itemCount = trip.days.reduce((total, day) => total + day.items.length, 0);

  const removedDayIndex = trip.days.findIndex((day) => day.id === pendingRemoveDay);
  const removedDayLabel =
    removedDayIndex >= 0 ? t('itinerary.day.label', { index: removedDayIndex + 1 }) : '';
  const removedDayItemCount = removedDayIndex >= 0 ? trip.days[removedDayIndex]!.items.length : 0;

  // Bộ lọc category áp cho cả hai cột. Thao tác kéo thả không bị ảnh hưởng:
  // `insertAt` xác định vị trí chèn theo id của mục được thả lên, chứ không
  // theo chỉ số trong mảng đã lọc — xem trip-board.md R9.
  // Đường thay thế cho kéo thả (điện thoại, bàn phím): menu "Chuyển sang".
  const moveTargets = [
    ...trip.days.map((day, index) => ({
      id: day.id,
      label: `${t('itinerary.day.label', { index: index + 1 })} · ${formatDate(day.date)}`,
    })),
    { id: null, label: t('itinerary.detail.unscheduledTitle') },
  ];

  function visibleItems(items: ItineraryItem[]): ItineraryItem[] {
    if (!category) return items;
    return items.filter((item) => itemCategory(item, placesById) === category);
  }

  return (
    <>
      <MobileColumnTabs
        activeTab={mobileTab}
        onChange={onMobileTabChange}
        leftLabel={t('itinerary.plan.tabItinerary')}
        rightLabel={t('itinerary.picker.tabLabel', { count: itemCount })}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        <div
          className={`${mobileTab === 'left' ? 'flex' : 'hidden'} max-h-[calc(100vh-320px)] flex-col gap-3 overflow-y-auto pr-1 lg:flex`}
        >
          {trip.days.map((day, index) => (
            <DayCard
              key={day.id}
              day={day}
              dayIndex={index + 1}
              dayCost={costByDayId[day.id] ?? 0}
              currency={trip.currency}
              visibleItems={visibleItems(day.items)}
              hiddenByFilterCount={day.items.length - visibleItems(day.items).length}
              placesById={placesById}
              editable
              // Ngày chưa gán giờ thì ẩn hẳn cột giờ; ngày đã có giờ thì hiện
              // nhãn read-only, nếu không người dùng thấy grip bị khoá mà không
              // hiểu vì sao (R4).
              hideTime={!day.items.some(isTimed)}
              timeVariant="axis"
              canRemove={trip.days.length > 1}
              onItemRemove={onRemoveItem}
              moveTargets={moveTargets}
              onItemMove={(itemId, toDayId) => onMoveItem(itemId, day.id, toDayId)}
              onRemoveDay={() =>
                // R2 — ngày còn item thì phải hỏi, vì item sẽ rời khỏi ngày.
                day.items.length > 0 ? setPendingRemoveDay(day.id) : onRemoveDay(day.id)
              }
              swapTargets={trip.days
                .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
                .filter(({ candidate }) => candidate.id !== day.id)
                .map(({ candidate, candidateIndex }) => ({
                  id: candidate.id,
                  label: `${t('itinerary.day.label', { index: candidateIndex + 1 })} · ${formatDate(candidate.date)}`,
                }))}
              onSwapDay={(targetDayId) => onSwapDays(day.id, targetDayId)}
              onAddActivity={(input) => onAddActivity(day.id, input)}
            />
          ))}

          {/* Nút thêm ngày nằm ngay dưới ngày cuối cùng, trên khu "Chưa xếp ngày". */}
          <button
            type="button"
            onClick={onAddDay}
            className="rounded-2xl border-2 border-dashed border-line py-3 text-[13px] font-semibold text-ink-soft transition hover:border-ocean hover:text-ocean-dark"
          >
            ＋ {t('itinerary.plan.addDay')}
          </button>

          <UnscheduledTray
            items={visibleItems(trip.unscheduledItems)}
            hiddenByFilterCount={trip.unscheduledItems.length - visibleItems(trip.unscheduledItems).length}
            placesById={placesById}
            editable
            onItemRemove={onRemoveItem}
            moveTargets={moveTargets}
            onItemMove={(itemId, toDayId) => onMoveItem(itemId, null, toDayId)}
          />
        </div>

        <div
          className={`${mobileTab === 'right' ? 'block' : 'hidden'} max-h-[calc(100vh-320px)] overflow-y-auto lg:block`}
        >
          <PlacePickerPanel
            savedPlaces={savedPlaces}
            placesById={placesById}
            regions={regions}
            tripRegions={trip.regions}
            days={trip.days}
            usageByPlaceId={usageByPlaceId}
            category={category}
            currentUserId={currentUserId}
            onAddPlace={onAddPlace}
            onPlaceCreated={onPlaceCreated}
          />
        </div>
      </div>

      <Dialog open={pendingRemoveDay !== null} onClose={() => setPendingRemoveDay(null)}>
        <DialogTitle>{t('itinerary.step2.removeDayTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('itinerary.step2.removeDayBody', {
              day: removedDayLabel,
              count: removedDayItemCount,
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoveDay(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingRemoveDay) onRemoveDay(pendingRemoveDay);
              setPendingRemoveDay(null);
            }}
          >
            {t('itinerary.step2.removeDay')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
