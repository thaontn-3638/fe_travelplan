import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery, useTheme } from '@mui/material';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import type { CategoryKey } from '../../places/utils';
import type { ItineraryItem, Place, Trip } from '../../../types';
import { DayScheduleCalendar, STANDARD_VISIBLE_DAYS } from './DayScheduleCalendar';
import { formatDate } from '../../../utils/dateFormat';
import { ScheduleConflictBanner } from './ScheduleConflictBanner';
import { ScheduleItemForm } from './ScheduleItemForm';
import { MobileColumnTabs } from './MobileColumnTabs';
import { CategoryFilterChips } from './CategoryFilterChips';
import { suggestedDurationMinutes } from '../utils/categoryColors';
import {
  autoAssignAllDays,
  canResolveConflictsByPushingDown,
  DEFAULT_ACTIVITY_MINUTES,
  findConflicts,
  resolveConflictsByPushingDown,
  updateItem,
} from '../utils/itineraryRules';

interface ScheduleStepProps {
  trip: Trip;
  placesById: Map<string, Place>;
  onChange: (next: Trip) => void;
  // Gán giờ tự động không phải thao tác của người dùng — báo riêng để trang
  // cha dời mốc dirty, tránh việc chỉ mở Bước 3 đã bị coi là có thay đổi.
  onAutoAssign: (next: Trip) => void;
}

export function ScheduleStep({ trip, placesById, onChange, onAutoAssign }: ScheduleStepProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const [windowStart, setWindowStart] = useState(0);
  // Object mới mỗi lần bấm, để lịch biết là phải cuộn lại kể cả khi cùng ngày.
  const [scrollTarget, setScrollTarget] = useState<{ index: number } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
  const [category, setCategory] = useState<CategoryKey | null>(null);

  // Desktop dựng đủ mọi ngày rồi để lịch tự cuộn ngang (chuẩn 7 ngày vừa khung);
  // mobile vẫn 1 ngày một lần vì một cột đã chiếm hết bề ngang.
  const windowSize = isDesktop ? trip.days.length : 1;
  const scrolls = isDesktop && trip.days.length > STANDARD_VISIBLE_DAYS;

  // R5 — thời lượng mặc định lấy theo category của place, hoạt động tự do 60'.
  const durationOf = useMemo(
    () => (item: ItineraryItem) => {
      if (item.kind === 'activity') {
        return DEFAULT_ACTIVITY_MINUTES;
      }
      const category = placesById.get(item.placeId ?? '')?.category;
      return suggestedDurationMinutes(category) ?? DEFAULT_ACTIVITY_MINUTES;
    },
    [placesById],
  );

  // Vào Bước 3 là các mục chưa có giờ được xếp sẵn theo thứ tự của Bước 2.
  // Hàm này idempotent: mục đã có giờ không bao giờ bị xếp lại, nên chạy lại
  // bao nhiêu lần cũng ra cùng kết quả — không cần cờ phụ (R5).
  useEffect(() => {
    const assigned = autoAssignAllDays(trip.days, durationOf);
    if (JSON.stringify(assigned) !== JSON.stringify(trip.days)) {
      onAutoAssign({ ...trip, days: assigned });
    }
  }, [trip, durationOf, onAutoAssign]);

  const conflicts = useMemo(() => findConflicts(trip.days), [trip.days]);
  const canPushDown = useMemo(() => canResolveConflictsByPushingDown(trip.days), [trip.days]);

  const selectedItem = useMemo(
    () =>
      trip.days.flatMap((day) => day.items).find((item) => item.id === selectedItemId) ?? null,
    [trip.days, selectedItemId],
  );

  function handleMoveItem(itemId: string, dayId: string, startTime: string, endTime: string): void {
    const currentDay = trip.days.find((day) => day.items.some((item) => item.id === itemId));
    const moving = currentDay?.items.find((item) => item.id === itemId);
    if (!moving) return;

    const withTimes = { ...moving, startTime, endTime };
    onChange({
      ...trip,
      days: trip.days.map((day) => {
        if (day.id === currentDay!.id && day.id === dayId) {
          return { ...day, items: day.items.map((item) => (item.id === itemId ? withTimes : item)) };
        }
        if (day.id === currentDay!.id) {
          return { ...day, items: day.items.filter((item) => item.id !== itemId) };
        }
        if (day.id === dayId) {
          return { ...day, items: [...day.items, { ...withTimes, order: day.items.length }] };
        }
        return day;
      }),
    });
    setSelectedItemId(itemId);
  }

  function handlePushDown(): void {
    const next = trip.days.map((day) =>
      findConflicts([day]).length > 0 ? resolveConflictsByPushingDown(day) : day,
    );

    if (next.some((day) => day === null)) {
      return; // nút đã bị disable ở trường hợp này
    }
    onChange({ ...trip, days: next as Trip['days'] });
  }

  function focusFirstConflict(): void {
    const first = conflicts[0];
    if (!first) return;

    const dayIndex = trip.days.findIndex((day) => day.id === first.dayId);
    if (dayIndex >= 0) {
      // Desktop: lịch rộng hơn khung nên "đi tới ngày N" là cuộn ngang.
      // Mobile: vẫn là đổi ngày đang xem.
      setScrollTarget({ index: dayIndex });
      setWindowStart(Math.min(dayIndex, Math.max(0, trip.days.length - windowSize)));
    }
    setSelectedItemId(first.bId);
    setMobileTab('left');
  }

  const windowEnd = Math.min(windowStart + windowSize, trip.days.length);
  const rangeLabel = trip.days
    .slice(windowStart, windowEnd)
    .map((day) => formatDate(day.date))
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .join(' – ');

  return (
    <div>
      <ScheduleConflictBanner
        conflicts={conflicts}
        canPushDown={canPushDown}
        onFocusFirst={focusFirstConflict}
        onPushDown={handlePushDown}
      />

      {trip.unscheduledItems.length > 0 && (
        <div className="mb-3 rounded-2xl border border-amber bg-amber-tint/50 px-4 py-2.5 text-[12.5px] font-semibold text-amber-dark">
          {t('itinerary.step3.unscheduledReminder', { count: trip.unscheduledItems.length })}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <CategoryFilterChips value={category} onChange={setCategory} />
        {category !== null && (
          <span className="text-[11.5px] text-ink-soft">{t('itinerary.step3.filterDimHint')}</span>
        )}
      </div>

      {scrolls && (
        <p className="m-0 mb-3 text-[12px] text-ink-soft">
          {t('itinerary.step3.scrollHint', { count: trip.days.length })}
        </p>
      )}

      {trip.days.length > windowSize && (
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            disabled={windowStart === 0}
            aria-label={t('common.previous')}
            onClick={() => setWindowStart((current) => Math.max(0, current - windowSize))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft disabled:opacity-40"
          >
            <ChevronLeftRoundedIcon fontSize="small" />
          </button>
          <span className="font-mono text-[12.5px] text-ink-soft">{rangeLabel}</span>
          <button
            type="button"
            disabled={windowEnd >= trip.days.length}
            aria-label={t('common.next')}
            onClick={() =>
              setWindowStart((current) => Math.min(trip.days.length - windowSize, current + windowSize))
            }
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white text-ink-soft disabled:opacity-40"
          >
            <ChevronRightRoundedIcon fontSize="small" />
          </button>
        </div>
      )}

      <MobileColumnTabs
        activeTab={mobileTab}
        onChange={setMobileTab}
        leftLabel={t('itinerary.step3.tabCalendar')}
        rightLabel={t('itinerary.step3.tabItem')}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className={mobileTab === 'left' ? 'block' : 'hidden lg:block'}>
          <DayScheduleCalendar
            trip={trip}
            placesById={placesById}
            windowStartIndex={windowStart}
            windowSize={windowSize}
            scrollToDay={scrollTarget}
            selectedItemId={selectedItemId}
            category={category}
            onSelectItem={(itemId) => {
              setSelectedItemId(itemId);
              setMobileTab('right');
            }}
            onMoveItem={handleMoveItem}
          />
        </div>

        <div className={mobileTab === 'right' ? 'block' : 'hidden lg:block'}>
          <ScheduleItemForm
            item={selectedItem}
            place={selectedItem?.placeId ? placesById.get(selectedItem.placeId) : undefined}
            onChange={(patch) => selectedItem && onChange(updateItem(trip, selectedItem.id, patch))}
          />
        </div>
      </div>
    </div>
  );
}
