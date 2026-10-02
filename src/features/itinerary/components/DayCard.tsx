import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { IconButton, Menu, MenuItem } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import type { Currency, ItineraryDay, ItineraryItem, Place } from '../../../types';
import { ItineraryItemRow, type MoveTarget } from './ItineraryItemRow';
import { formatDateWithWeekday } from '../../../utils/dateFormat';
import { AddActivityForm, type ActivityInput } from './AddActivityForm';
import { isTimed } from '../utils/itineraryRules';
import { formatMoney } from '../../budget/utils/money';

interface DayCardProps {
  day: ItineraryDay;
  dayIndex: number;
  visibleItems: ItineraryItem[];
  placesById: Map<string, Place>;
  editable: boolean;
  timeVariant: 'list' | 'axis';
  hideTime?: boolean;
  // Chế độ xem: in memo của từng mục ra bên phải.
  showNotes?: boolean;
  // Số mục của ngày bị bộ lọc category ẩn đi — để empty state không nói dối
  // rằng ngày đang trống.
  hiddenByFilterCount?: number;
  // Chi phí dự trù của ngày. Tính một lần ở cấp trip rồi truyền xuống — dữ
  // liệu nằm ở `trip.budgetPlan`, không còn trên từng item (trip-budget.md D2).
  dayCost?: number;
  currency?: Currency;
  activeItemId?: string | null;
  canRemove?: boolean;
  onItemClick?: (item: ItineraryItem) => void;
  onItemTimeChange?: (itemId: string, field: 'startTime' | 'endTime', value: string) => void;
  onItemRemove?: (itemId: string) => void;
  // Tất cả các ngăn (các ngày + "Chưa xếp ngày"); ngăn hiện tại tự bị loại.
  moveTargets?: MoveTarget[];
  onItemMove?: (itemId: string, toDayId: string | null) => void;
  onRemoveDay?: () => void;
  // Danh sách các ngày có thể hoán đổi plan với ngày này.
  swapTargets?: { id: string; label: string }[];
  onSwapDay?: (targetDayId: string) => void;
  onAddActivity?: (input: ActivityInput) => void;
  registerItemRef?: (itemId: string, node: HTMLElement | null) => void;
}

export function DayCard({
  day,
  dayIndex,
  visibleItems,
  placesById,
  editable,
  timeVariant,
  hideTime = false,
  showNotes = false,
  hiddenByFilterCount = 0,
  dayCost = 0,
  currency = 'JPY',
  activeItemId,
  canRemove = false,
  onItemClick,
  onItemTimeChange,
  onItemRemove,
  moveTargets = [],
  onItemMove,
  onRemoveDay,
  swapTargets = [],
  onSwapDay,
  onAddActivity,
  registerItemRef,
}: DayCardProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [swapAnchor, setSwapAnchor] = useState<HTMLElement | null>(null);

  const dateLabel = formatDateWithWeekday(day.date);

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${day.id}`,
    data: { type: 'day', dayId: day.id },
    disabled: !editable,
  });

  // R4 — khi ngày đã có giờ, thứ tự do Bước 3 quyết định: hiển thị theo giờ và
  // khoá kéo trong ngày để thao tác của người dùng không bị ghi đè lặng lẽ.
  const dayHasTimes = day.items.some(isTimed);
  const sortedItems = [...visibleItems].sort((a, b) => {
    if (dayHasTimes && isTimed(a) && isTimed(b)) {
      return a.startTime!.localeCompare(b.startTime!);
    }
    if (dayHasTimes && isTimed(a) !== isTimed(b)) {
      return isTimed(a) ? -1 : 1;
    }
    return a.order - b.order;
  });

  function openMenu(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
  }

  return (
    <div className="rounded-2xl border border-line bg-white">
      <div className="flex w-full items-center justify-between p-4">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="font-display text-[14.5px] font-bold text-ink">
            {t('itinerary.day.label', { index: dayIndex })}
          </span>
          <span className="font-mono text-[12.5px] text-ink-soft">{dateLabel}</span>
          <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
            {t('itinerary.day.itemCount', { count: sortedItems.length })}
          </span>
          {dayCost > 0 && (
            <span className="font-mono text-[11.5px] font-semibold text-ink-soft">
              {formatMoney(dayCost, currency)}
            </span>
          )}
          <ExpandMoreRoundedIcon
            fontSize="small"
            className={`text-ink-soft transition-transform ${collapsed ? '-rotate-90' : ''}`}
          />
        </button>

        {editable && (onRemoveDay || onSwapDay) && (
          <>
            <IconButton size="small" onClick={openMenu} aria-label={t('itinerary.step2.moreDayActions') ?? 'more'}>
              <MoreHorizRoundedIcon fontSize="small" />
            </IconButton>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {onSwapDay && swapTargets.length > 0 && (
                <MenuItem
                  onClick={(event) => {
                    setMenuAnchor(null);
                    setSwapAnchor(event.currentTarget);
                  }}
                  sx={{ fontSize: 13.5 }}
                >
                  <SwapVertRoundedIcon fontSize="small" className="mr-1.5" />
                  {t('itinerary.step2.moveDay')}
                </MenuItem>
              )}
              {canRemove && onRemoveDay && (
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onRemoveDay();
                  }}
                  sx={{ fontSize: 13.5, color: 'error.main' }}
                >
                  {t('itinerary.step2.removeDay')}
                </MenuItem>
              )}
            </Menu>

            <Menu anchorEl={swapAnchor} open={Boolean(swapAnchor)} onClose={() => setSwapAnchor(null)}>
              {swapTargets.map((target) => (
                <MenuItem
                  key={target.id}
                  onClick={() => {
                    setSwapAnchor(null);
                    onSwapDay?.(target.id);
                  }}
                  sx={{ fontSize: 13.5 }}
                >
                  {target.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}
      </div>

      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`flex flex-col gap-2 border-t border-line p-3 ${editable && isOver ? 'bg-ocean-tint' : ''}`}
        >
          {sortedItems.length === 0 ? (
            <div
              className={`flex min-h-[64px] items-center justify-center rounded-xl text-center text-[12.5px] text-ink-soft ${
                editable ? `border-2 border-dashed ${isOver ? 'border-ocean text-ocean-dark' : 'border-line'}` : ''
              }`}
            >
              {hiddenByFilterCount > 0
                ? t('itinerary.day.allHiddenByFilter', { count: hiddenByFilterCount })
                : editable
                  ? isOver
                    ? t('itinerary.day.dropHere')
                    : t('itinerary.day.emptyDrop')
                  : t('itinerary.day.emptyReadOnly')}
            </div>
          ) : (
            sortedItems.map((item) => (
              <div key={item.id} ref={(node) => registerItemRef?.(item.id, node)}>
                <ItineraryItemRow
                  item={item}
                  place={item.placeId ? placesById.get(item.placeId) : undefined}
                  placesById={placesById}
                  dayId={day.id}
                  editable={editable}
                  variant={timeVariant}
                  hideTime={hideTime}
                  showNote={showNotes}
                  dragLocked={editable && dayHasTimes && isTimed(item)}
                  active={activeItemId === item.id}
                  onClick={onItemClick ? () => onItemClick(item) : undefined}
                  onTimeChange={
                    onItemTimeChange ? (field, value) => onItemTimeChange(item.id, field, value) : undefined
                  }
                  onRemove={onItemRemove ? () => onItemRemove(item.id) : undefined}
                  moveTargets={moveTargets.filter((target) => target.id !== day.id)}
                  onMove={onItemMove ? (toDayId) => onItemMove(item.id, toDayId) : undefined}
                />
              </div>
            ))
          )}

          {hiddenByFilterCount > 0 && sortedItems.length > 0 && (
            <p className="m-0 px-1 text-[11.5px] text-ink-soft">
              {t('itinerary.day.hiddenByFilter', { count: hiddenByFilterCount })}
            </p>
          )}

          {editable && onAddActivity && <AddActivityForm onSubmit={onAddActivity} />}
        </div>
      )}
    </div>
  );
}
