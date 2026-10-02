import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Paper, Popover, Popper, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import type { Place, Trip } from '../../../types';
import type { CategoryKey } from '../../places/utils';
import { DayScheduleCalendar } from './DayScheduleCalendar';
import { formatDate, formatDateWithWeekday } from '../../../utils/dateFormat';
import { CATEGORY_COLOR_CLASSES, itemCategory } from '../utils/categoryColors';
import { isTimed } from '../utils/itineraryRules';

interface TripTimelineViewProps {
  trip: Trip;
  placesById: Map<string, Place>;
  category: CategoryKey | null;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
  // "Xem chi tiết" trong popup — màn chi tiết chuyển sang tab danh sách.
  onOpenDetail?: (itemId: string) => void;
}

// Bản chỉ-đọc của Bước 3, dùng cho tab "Timeline" ở màn chi tiết — cùng một
// component lịch, chỉ tắt kéo/resize.
export function TripTimelineView({
  trip,
  placesById,
  category,
  selectedItemId,
  onSelectItem,
  onOpenDetail,
}: TripTimelineViewProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  // Hai kiểu popup cho cùng một nội dung:
  // - hover (máy có chuột): rê vào là hiện, rời ra là ẩn — không chặn trang.
  // - pinned (bấm / chạm / bàn phím): Popover modal như cũ, có nút đóng.
  const [popover, setPopover] = useState<{ itemId: string; anchor: HTMLElement } | null>(null);
  const [hovered, setHovered] = useState<{ itemId: string; anchor: HTMLElement } | null>(null);
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);

  const clearTimers = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // Trễ nhẹ khi mở để lướt chuột ngang qua lịch không làm popup nhấp nháy;
  // trễ khi đóng để kịp đưa chuột vào popup bấm "Xem chi tiết".
  const scheduleClose = useCallback(() => {
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(null), 160);
  }, []);

  const handleHover = useCallback(
    (itemId: string, anchor: HTMLElement | null) => {
      if (!canHover) return;
      if (!anchor) {
        scheduleClose();
        return;
      }
      clearTimers();
      openTimer.current = window.setTimeout(() => setHovered({ itemId, anchor }), 120);
    },
    [canHover, clearTimers, scheduleClose],
  );

  const handleClick = useCallback(
    (itemId: string, anchor: HTMLElement) => {
      clearTimers();
      setHovered(null);
      setPopover({ itemId, anchor });
    },
    [clearTimers],
  );

  // itemId -> { item, ngày thứ mấy } để popup không phải quét lại cả trip.
  const itemIndex = useMemo(() => {
    const map = new Map<string, { item: Trip['days'][number]['items'][number]; dayIndex: number; date: string }>();
    trip.days.forEach((day, dayIndex) => {
      for (const item of day.items) {
        map.set(item.id, { item, dayIndex, date: day.date });
      }
    });
    return map;
  }, [trip.days]);

  const opened = popover ? itemIndex.get(popover.itemId) : undefined;
  const hoverEntry = hovered && !popover && hovered.anchor.isConnected ? itemIndex.get(hovered.itemId) : undefined;
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [windowStart, setWindowStart] = useState(0);

  const windowSize = isDesktop ? Math.min(trip.days.length, 4) : 1;
  const windowEnd = Math.min(windowStart + windowSize, trip.days.length);

  const rangeLabel = useMemo(
    () =>
      trip.days
        .slice(windowStart, windowEnd)
        .map((day) => formatDate(day.date))
        .filter((_, index, all) => index === 0 || index === all.length - 1)
        .join(' – '),
    [trip.days, windowStart, windowEnd],
  );

  return (
    <div>
      {trip.days.length > windowSize && (
        <div className="mb-3 flex items-center gap-2">
          <PagerButton
            direction="prev"
            disabled={windowStart === 0}
            onClick={() => setWindowStart((current) => Math.max(0, current - windowSize))}
          />
          <span className="font-mono text-[12.5px] text-ink-soft">{rangeLabel}</span>
          <PagerButton
            direction="next"
            disabled={windowEnd >= trip.days.length}
            onClick={() =>
              setWindowStart((current) => Math.min(trip.days.length - windowSize, current + windowSize))
            }
          />
        </div>
      )}

      <DayScheduleCalendar
        trip={trip}
        placesById={placesById}
        windowStartIndex={windowStart}
        windowSize={windowSize}
        selectedItemId={selectedItemId}
        category={category}
        readOnly
        onSelectItem={onSelectItem}
        onItemClick={handleClick}
        onItemHover={handleHover}
      />

      <Popper
        open={Boolean(hoverEntry)}
        anchorEl={hovered?.anchor ?? null}
        placement="bottom-start"
        modifiers={[{ name: 'offset', options: { offset: [0, 6] } }, { name: 'flip', enabled: true }]}
        sx={{ zIndex: theme.zIndex.tooltip }}
      >
        {hoverEntry && (
          <Paper
            elevation={8}
            onMouseEnter={clearTimers}
            onMouseLeave={scheduleClose}
            sx={{ borderRadius: '14px', maxWidth: 320, width: 'calc(100vw - 32px)' }}
          >
            <ItemPopoverContent
              entry={hoverEntry}
              placesById={placesById}
              onOpenDetail={
                onOpenDetail
                  ? () => {
                      clearTimers();
                      setHovered(null);
                      onOpenDetail(hoverEntry.item.id);
                    }
                  : undefined
              }
              t={t}
            />
          </Paper>
        )}
      </Popper>

      <Popover
        open={Boolean(popover && opened)}
        anchorEl={popover?.anchor ?? null}
        onClose={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { borderRadius: '14px', maxWidth: 320, width: 'calc(100vw - 32px)' } } }}
      >
        {opened && (
          <ItemPopoverContent
            entry={opened}
            placesById={placesById}
            onClose={() => setPopover(null)}
            onOpenDetail={
              onOpenDetail
                ? () => {
                    setPopover(null);
                    onOpenDetail(opened.item.id);
                  }
                : undefined
            }
            t={t}
          />
        )}
      </Popover>
    </div>
  );
}

function ItemPopoverContent({
  entry,
  placesById,
  onClose,
  onOpenDetail,
  t,
}: {
  entry: { item: Trip['days'][number]['items'][number]; dayIndex: number; date: string };
  placesById: Map<string, Place>;
  // Không có = popup hover (tự ẩn khi rời chuột), khỏi cần nút đóng.
  onClose?: () => void;
  onOpenDetail?: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const { item, dayIndex, date } = entry;
  const place = item.placeId ? placesById.get(item.placeId) : undefined;
  const category = itemCategory(item, placesById);
  const colors = CATEGORY_COLOR_CLASSES[category];
  const title =
    item.kind === 'activity'
      ? (item.title ?? t('itinerary.item.untitledActivity'))
      : (place?.title ?? t('itinerary.item.missingPlace'));
  const note = item.note?.trim() ?? '';

  return (
    <div className="p-4">
      <div className="mb-2 flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />
        <h3 className="m-0 min-w-0 flex-1 font-display text-[15px] font-bold text-ink">{title}</h3>
        {onClose && (
          <IconButton size="small" onClick={onClose} aria-label={t('common.close')} sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseRoundedIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </div>

      <p className="m-0 font-mono text-[12px] text-ink-soft">
        {t('itinerary.day.label', { index: dayIndex + 1 })} · {formatDateWithWeekday(date)}
      </p>
      <p className="m-0 mb-3 text-[12px] text-ink-soft">
        {isTimed(item) ? (
          <span className="font-mono font-semibold text-ink">
            {item.startTime} – {item.endTime}
          </span>
        ) : (
          t('itinerary.item.noTime')
        )}
        {' · '}
        {place?.region ? `${place.region} · ` : ''}
        {t(`discover.category.${category}`)}
      </p>

      {note ? (
        <div className="flex gap-2 rounded-xl border border-amber/60 bg-amber-tint/60 p-2.5">
          <StickyNote2OutlinedIcon sx={{ fontSize: 15 }} className="mt-px flex-shrink-0 text-amber-dark" />
          <p className="m-0 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">{note}</p>
        </div>
      ) : (
        <p className="m-0 text-[12.5px] text-ink-soft">{t('itinerary.detail.noNote')}</p>
      )}

      {onOpenDetail && (
        <button
          type="button"
          onClick={onOpenDetail}
          className="mt-3 w-full rounded-lg border border-ocean bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ocean-dark transition hover:bg-ocean-tint"
        >
          {t('itinerary.detail.viewItemDetail')}
        </button>
      )}
    </div>
  );
}

function PagerButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={t(direction === 'prev' ? 'common.previous' : 'common.next') ?? direction}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft disabled:opacity-40"
    >
      {direction === 'prev' ? (
        <ChevronLeftRoundedIcon fontSize="small" />
      ) : (
        <ChevronRightRoundedIcon fontSize="small" />
      )}
    </button>
  );
}
