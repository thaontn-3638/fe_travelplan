import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import type { EventDropArg, EventInput, LocaleInput } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';
import jaLocale from '@fullcalendar/core/locales/ja';
import { format } from 'date-fns';
import type { ItineraryItem, Place, Trip } from '../../../types';
import { CATEGORY_EVENT_COLORS, itemCategory } from '../utils/categoryColors';
import { formatDateWithWeekday } from '../../../utils/dateFormat';
import type { CategoryKey } from '../../places/utils';
import {
  DAY_END_MINUTES,
  DAY_START_MINUTES,
  findConflicts,
  isTimed,
  SNAP_MINUTES,
  toMinutes,
  toTimeString,
} from '../utils/itineraryRules';

const FC_LOCALES: LocaleInput[] = [viLocale, jaLocale];

// Số ngày hiển thị vừa khít trong khung tiêu chuẩn. Chuyến dài hơn thì lịch
// cuộn ngang bên trong thay vì bắt user bấm phân trang — cuộn giữ được ngữ cảnh
// "ngày kế bên", phân trang thì không.
export const STANDARD_VISIBLE_DAYS = 7;
const MIN_DAY_COLUMN_PX = 150;

interface DayScheduleCalendarProps {
  trip: Trip;
  placesById: Map<string, Place>;
  windowStartIndex: number;
  windowSize: number;
  // Cuộn lịch tới ngày này (nút "Xem" của banner trùng giờ). Đổi giá trị là
  // cuộn lại, nên caller dùng một object mới mỗi lần bấm.
  scrollToDay?: { index: number } | null;
  selectedItemId: string | null;
  // Bộ lọc ở Bước 3 chỉ LÀM MỜ, không ẩn: ẩn block sẽ giấu mất chỗ trùng giờ
  // trong khi banner vẫn đếm nó (trip-board.md R9).
  category: CategoryKey | null;
  // Chế độ xem ở màn chi tiết: vẫn chọn được mục để xem, nhưng không kéo/resize.
  readOnly?: boolean;
  onSelectItem: (itemId: string) => void;
  // Bấm vào một mục — kèm phần tử DOM để caller neo popup (màn xem).
  onItemClick?: (itemId: string, anchor: HTMLElement) => void;
  // Rê chuột vào / ra một mục (chỉ màn xem dùng) — anchor null nghĩa là rời đi.
  onItemHover?: (itemId: string, anchor: HTMLElement | null) => void;
  onMoveItem?: (itemId: string, dayId: string, startTime: string, endTime: string) => void;
}

function itemLabel(item: ItineraryItem, placesById: Map<string, Place>, fallback: string): string {
  if (item.kind === 'activity') {
    return item.title ?? fallback;
  }
  return placesById.get(item.placeId ?? '')?.title ?? fallback;
}

export function DayScheduleCalendar({
  trip,
  placesById,
  windowStartIndex,
  windowSize,
  scrollToDay = null,
  selectedItemId,
  category,
  readOnly = false,
  onSelectItem,
  onItemClick,
  onItemHover,
  onMoveItem,
}: DayScheduleCalendarProps) {
  const { t, i18n } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conflictIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conflict of findConflicts(trip.days)) {
      ids.add(conflict.aId);
      ids.add(conflict.bId);
    }
    return ids;
  }, [trip.days]);

  const events = useMemo<EventInput[]>(
    () =>
      trip.days.flatMap((day) =>
        day.items.filter(isTimed).map((item) => {
          const colors = CATEGORY_EVENT_COLORS[itemCategory(item, placesById)];
          const dimmed = category !== null && itemCategory(item, placesById) !== category;

          return {
            id: item.id,
            title: itemLabel(item, placesById, t('itinerary.item.untitledActivity')),
            start: `${day.date}T${item.startTime}:00`,
            end: `${day.date}T${item.endTime}:00`,
            backgroundColor: colors.fill,
            borderColor: colors.border,
            textColor: colors.text,
            classNames: [
              conflictIds.has(item.id) ? 'itinerary-event-conflict' : '',
              selectedItemId === item.id ? 'itinerary-event-selected' : '',
              dimmed ? 'itinerary-event-dimmed' : '',
            ].filter(Boolean),
            extendedProps: { dayId: day.id, accent: colors.border, note: item.note },
          };
        }),
      ),
    [trip.days, placesById, conflictIds, selectedItemId, category, t],
  );

  const windowDays = trip.days.slice(windowStartIndex, windowStartIndex + windowSize);
  const anchorDate = windowDays[0]?.date ?? trip.startDate;

  // Mở màn ở đúng khung giờ của mục sớm nhất đang hiển thị, thay vì một mốc
  // cố định — trục giờ đủ 24 tiếng nên mốc cố định dễ rơi vào vùng trống.
  const earliestTime = useMemo(() => {
    const starts = windowDays
      .flatMap((day) => day.items)
      .filter(isTimed)
      .map((item) => toMinutes(item.startTime!));

    if (starts.length === 0) {
      return toTimeString(DAY_START_MINUTES);
    }
    // Lùi về đầu giờ để block sớm nhất không dính sát mép trên.
    return toTimeString(Math.max(0, Math.floor(Math.min(...starts) / 60) * 60 - 30));
  }, [windowDays]);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    api.gotoDate(anchorDate);
    api.scrollToTime(`${earliestTime}:00`);
  }, [anchorDate, windowSize, earliestTime]);

  // Khi lịch rộng hơn khung, "đi tới ngày N" là cuộn ngang chứ không phải đổi
  // trang — nếu không, nút "Xem" của banner trùng giờ sẽ không làm gì cả.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || scrollToDay === null || windowSize <= STANDARD_VISIBLE_DAYS) {
      return;
    }

    const columnWidth = container.scrollWidth / Math.max(1, windowSize);
    container.scrollTo({
      left: Math.max(0, (scrollToDay.index - 1) * columnWidth),
      behavior: 'smooth',
    });
  }, [scrollToDay, windowSize]);

  useEffect(() => {
    const container = trayRef.current;
    if (!container || readOnly) {
      return;
    }

    const draggable = new Draggable(container, {
      itemSelector: '.itinerary-untimed-item',
      eventData: (el) => ({
        id: el.getAttribute('data-item-id') ?? undefined,
        title: el.getAttribute('data-title') ?? '',
        duration: el.getAttribute('data-duration') ?? '01:00',
      }),
    });

    return () => draggable.destroy();
  }, [readOnly]);

  function applyDrop(info: EventDropArg | EventResizeDoneArg): void {
    const start = info.event.start;
    const end = info.event.end;
    if (!start || !end) {
      info.revert();
      return;
    }

    const dateKey = format(start, 'yyyy-MM-dd');
    const day = trip.days.find((candidate) => candidate.date === dateKey);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    // Không có item qua nửa đêm (R6) — mục kết thúc sang ngày khác bị trả về.
    const crossesMidnight = format(end, 'yyyy-MM-dd') !== dateKey && endMinutes !== 0;
    if (!day || crossesMidnight || endMinutes <= startMinutes || endMinutes > DAY_END_MINUTES) {
      info.revert();
      return;
    }

    onMoveItem?.(info.event.id, day.id, toTimeString(startMinutes), toTimeString(endMinutes));
  }

  const untimedByDay = trip.days
    .map((day, index) => ({ day, index, items: day.items.filter((item) => !isTimed(item)) }))
    .filter((entry) => entry.items.length > 0);

  return (
    <div>
      {untimedByDay.length > 0 && (
        <div ref={trayRef} className="mb-3 rounded-2xl border border-dashed border-amber bg-amber-tint/40 p-3">
          <p className="m-0 mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-amber-dark">
            {t('itinerary.step3.untimedTitle')}
          </p>
          <div className="flex flex-col gap-2">
            {untimedByDay.map(({ day, index, items }) => (
              <div key={day.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11.5px] text-ink-soft">
                  {t('itinerary.day.label', { index: index + 1 })} · {formatDateWithWeekday(day.date)}
                </span>
                {items.map((item) => {
                  const colors = CATEGORY_EVENT_COLORS[itemCategory(item, placesById)];
                  const label = itemLabel(item, placesById, t('itinerary.item.untitledActivity'));

                  // Ở màn xem không kéo được — đừng hiện con trỏ kéo, cho bấm để
                  // xem chi tiết giống block trên lịch.
                  if (readOnly) {
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(event) => {
                          onSelectItem(item.id);
                          onItemClick?.(item.id, event.currentTarget);
                        }}
                        onMouseEnter={(event) => onItemHover?.(item.id, event.currentTarget)}
                        onMouseLeave={() => onItemHover?.(item.id, null)}
                        className={`rounded-lg border-[1.5px] px-2 py-1 text-[12px] font-semibold ${
                          item.note ? 'itinerary-untimed-has-note' : ''
                        }`}
                        style={{ backgroundColor: colors.fill, borderColor: colors.border, color: colors.text }}
                      >
                        {label}
                      </button>
                    );
                  }

                  return (
                    <span
                      key={item.id}
                      className="itinerary-untimed-item cursor-grab rounded-lg border-[1.5px] px-2 py-1 text-[12px] font-semibold active:cursor-grabbing"
                      style={{ backgroundColor: colors.fill, borderColor: colors.border, color: colors.text }}
                      data-item-id={item.id}
                      data-title={label}
                      data-duration="01:00"
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FullCalendar bản miễn phí không có `dayMinWidth` (thuộc gói trả phí),
          nên cách cuộn ngang là cho chính lưới rộng ra rồi để khung ngoài cuộn. */}
      <div ref={scrollRef} className="overflow-x-auto">
        <div
          className="itinerary-calendar rounded-2xl border border-line bg-white p-2"
          style={
            windowSize > STANDARD_VISIBLE_DAYS
              ? { minWidth: `${windowSize * MIN_DAY_COLUMN_PX}px` }
              : undefined
          }
        >
        <FullCalendar
          ref={calendarRef}
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView="timeGrid"
          initialDate={anchorDate}
          views={{ timeGrid: { duration: { days: windowSize } } }}
          headerToolbar={false}
          allDaySlot={false}
          height={780}
          expandRows
          locales={FC_LOCALES}
          locale={i18n.language.split('-')[0]}
          firstDay={1}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime={`${earliestTime}:00`}
          // Đường kẻ mỗi 1 tiếng; vẫn snap 15 phút khi kéo/resize.
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          snapDuration={`00:${SNAP_MINUTES}:00`}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          // Tiêu đề cột ngày cũng theo đúng quy ước ghi ngày chung.
          dayHeaderContent={(arg) => formatDateWithWeekday(format(arg.date, 'yyyy-MM-dd'))}
          editable={!readOnly}
          droppable={!readOnly}
          eventResizableFromStart={!readOnly}
          eventOverlap
          eventDurationEditable={!readOnly}
          events={events}
          // FullCalendar không truyền màu xuống CSS được, mà `currentColor` trên
          // .fc-event lại kế thừa màu chữ của trang (xám). Gắn hẳn một biến CSS
          // theo từng event để hover và quầng focus dùng đúng màu của card đó.
          eventDidMount={(info) => {
            const accent = info.event.extendedProps.accent as string | undefined;
            if (accent) {
              info.el.style.setProperty('--item-accent', accent);
            }

            // Trên lưới giờ không đủ chỗ in memo. Màn sửa: tooltip khi hover.
            // Màn xem: rê chuột hiện popup, bấm để ghim (caller lo) — điện thoại
            // không có hover nên vẫn cần đường bấm.
            const note = info.event.extendedProps.note as string | undefined;
            if (note) {
              if (!readOnly) {
                info.el.setAttribute('title', note);
              }
              info.el.classList.add('itinerary-event-has-note');
            }
          }}
          eventClick={(info) => {
            onSelectItem(info.event.id);
            onItemClick?.(info.event.id, info.el);
          }}
          eventMouseEnter={(info) => onItemHover?.(info.event.id, info.el)}
          eventMouseLeave={(info) => onItemHover?.(info.event.id, null)}
          eventDrop={applyDrop}
          eventResize={applyDrop}
          eventReceive={(info) => {
            applyDrop(info as unknown as EventDropArg);
            info.revert();
          }}
        />
        </div>
      </div>
    </div>
  );
}
