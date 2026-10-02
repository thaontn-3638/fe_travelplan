import { addDays, differenceInCalendarDays, eachDayOfInterval, format, isValid, parseISO } from 'date-fns';
import type { ItineraryDay, ItineraryItem, Trip } from '../../../types';

// Toàn bộ quy tắc nghiệp vụ R1–R6 của docs/features/trip-board.md, viết dưới
// dạng hàm thuần: không mutate tham số, không gọi API, không đọc state React.

export const DAY_START_MINUTES = 8 * 60; // 08:00 — mốc bắt đầu auto-assign
export const DAY_LIMIT_MINUTES = 23 * 60; // 23:00 — không auto-assign quá mốc này
export const DAY_END_MINUTES = 23 * 60 + 59; // 23:59 — không có item qua nửa đêm
export const MAX_TRIP_DAYS = 30;
export const SNAP_MINUTES = 15;
export const DEFAULT_ACTIVITY_MINUTES = 60;
export const MAX_NOTE_LENGTH = 100;

const ISO_DATE = 'yyyy-MM-dd';

function defaultId(): string {
  return crypto.randomUUID();
}

/* ------------------------------------------------------------------ thời gian */

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
}

export function toTimeString(totalMinutes: number): string {
  const clamped = Math.min(Math.max(Math.round(totalMinutes), 0), DAY_END_MINUTES);
  const hours = String(Math.floor(clamped / 60)).padStart(2, '0');
  const minutes = String(clamped % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// R6 — end phải sau start, và không được vượt quá 23:59 (không có item qua đêm).
export function isValidRange(startTime: string, endTime: string): boolean {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return false;
  }
  return end > start && start >= 0 && end <= DAY_END_MINUTES;
}

export function isTimed(item: ItineraryItem): boolean {
  return item.startTime !== null && item.endTime !== null;
}

export function itemDurationMinutes(item: ItineraryItem): number | null {
  if (!isTimed(item)) {
    return null;
  }
  return toMinutes(item.endTime!) - toMinutes(item.startTime!);
}

export function clearTimes(item: ItineraryItem): ItineraryItem {
  return { ...item, startTime: null, endTime: null };
}

/* ---------------------------------------------------------------------- chung */

export function reindex(items: ItineraryItem[]): ItineraryItem[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

function sortedByOrder(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/* ------------------------------------------------------------- R1: ngày & range */

export function countTripDays(startDate: string, endDate: string | null): number {
  if (!endDate) {
    return 1;
  }
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

// Khoảng ngày dùng được để dựng lại danh sách ngày: ngày đi parse được và
// ngày về (nếu có) không trước ngày đi. Trong lúc người dùng đang gõ dở (xoá
// trắng ô, gõ "20"→"18") khoảng ngày có thể tạm thời sai — KHÔNG được dựng lại
// ngày từ giá trị đó, nếu không mọi mục bị dồn về "Chưa xếp ngày".
export function isUsableDateRange(startDate: string, endDate: string | null): boolean {
  if (!startDate || !isValid(parseISO(startDate))) return false;
  if (!endDate) return true;
  if (!isValid(parseISO(endDate))) return false;
  return countTripDays(startDate, endDate) >= 1;
}

export function buildDays(
  startDate: string,
  endDate: string | null,
  newId: () => string = defaultId,
): ItineraryDay[] {
  const start = parseISO(startDate);
  const end = endDate ? parseISO(endDate) : start;

  return eachDayOfInterval({ start, end })
    .slice(0, MAX_TRIP_DAYS)
    .map((date) => ({ id: newId(), date: format(date, ISO_DATE), items: [] }));
}

// endDate === startDate và endDate === null cùng nghĩa là trip 1 ngày — chuẩn
// hoá về null ngay từ lúc lưu để mọi chỗ hiển thị chỉ thấy một dạng dữ liệu.
export function normalizeEndDate(startDate: string, endDate: string | null): string | null {
  return !endDate || endDate === startDate ? null : endDate;
}

// Ngày của days[] luôn liên tục tính từ startDate, và endDate luôn phản ánh
// đúng số ngày thực tế (null khi trip chỉ có 1 ngày).
export function normalizeTripDates(trip: Trip): Trip {
  if (trip.days.length === 0) {
    return trip;
  }

  const startDate = trip.days[0]!.date;
  const days = trip.days.map((day, index) => ({
    ...day,
    date: format(addDays(parseISO(startDate), index), ISO_DATE),
  }));

  return {
    ...trip,
    startDate,
    endDate: days.length <= 1 ? null : days[days.length - 1]!.date,
    days,
  };
}

/* -------------------------------------------------------- R2: thêm / xoá ngày */

export function addDay(trip: Trip, newId: () => string = defaultId): Trip {
  if (trip.days.length >= MAX_TRIP_DAYS) {
    return trip;
  }

  const lastDate = trip.days.length > 0 ? trip.days[trip.days.length - 1]!.date : trip.startDate;
  const nextDate = format(addDays(parseISO(lastDate), 1), ISO_DATE);

  return normalizeTripDates({
    ...trip,
    days: [...trip.days, { id: newId(), date: nextDate, items: [] }],
  });
}

// Item của ngày bị xoá không biến mất — rơi vào "Chưa xếp ngày" và mất giờ.
// Các ngày phía sau dồn lên, endDate lùi 1 ngày (chuẩn hoá bởi normalizeTripDates).
export function removeDay(trip: Trip, dayId: string): Trip {
  if (trip.days.length <= 1) {
    return trip;
  }

  const target = trip.days.find((day) => day.id === dayId);
  if (!target) {
    return trip;
  }

  return normalizeTripDates({
    ...trip,
    days: trip.days.filter((day) => day.id !== dayId),
    unscheduledItems: reindex([
      ...trip.unscheduledItems,
      ...sortedByOrder(target.items).map(clearTimes),
    ]),
  });
}

// Đổi plan của hai ngày cho nhau: ngày giữ nguyên date, toàn bộ item hoán vị.
// Giờ của item nằm trong phạm vi một ngày nên hoán đổi không sinh ra trùng giờ.
export function swapDays(trip: Trip, dayIdA: string, dayIdB: string): Trip {
  if (dayIdA === dayIdB) {
    return trip;
  }

  const dayA = trip.days.find((day) => day.id === dayIdA);
  const dayB = trip.days.find((day) => day.id === dayIdB);
  if (!dayA || !dayB) {
    return trip;
  }

  return {
    ...trip,
    days: trip.days.map((day) => {
      if (day.id === dayIdA) return { ...day, items: dayB.items };
      if (day.id === dayIdB) return { ...day, items: dayA.items };
      return day;
    }),
  };
}

/* ------------------------------------------------- R3: đổi khoảng ngày (Step 1) */

export function itemsLostByDateRange(
  trip: Trip,
  startDate: string,
  endDate: string | null,
): { removedDays: number; movedItems: number } {
  const nextCount = countTripDays(startDate, endDate);
  const dropped = trip.days.slice(nextCount);

  return {
    removedDays: dropped.length,
    movedItems: dropped.reduce((total, day) => total + day.items.length, 0),
  };
}

export function applyDateRange(
  trip: Trip,
  startDate: string,
  endDate: string | null,
  newId: () => string = defaultId,
): Trip {
  const nextCount = Math.min(countTripDays(startDate, endDate), MAX_TRIP_DAYS);
  const kept = trip.days.slice(0, nextCount);
  const dropped = trip.days.slice(nextCount);

  const days: ItineraryDay[] = [...kept];
  while (days.length < nextCount) {
    days.push({ id: newId(), date: '', items: [] });
  }

  return normalizeTripDates({
    ...trip,
    startDate,
    days: days.map((day, index) => ({
      ...day,
      date: format(addDays(parseISO(startDate), index), ISO_DATE),
    })),
    unscheduledItems: reindex([
      ...trip.unscheduledItems,
      ...dropped.flatMap((day) => sortedByOrder(day.items).map(clearTimes)),
    ]),
  });
}

/* ------------------------------------------------ R4: đồng bộ order theo thời gian */

// Thời gian thắng order. Item chưa gán giờ giữ nguyên thứ tự tương đối và
// luôn xếp sau cùng.
export function reorderByTime(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day) => {
    const ordered = sortedByOrder(day.items);
    const timed = ordered
      .filter(isTimed)
      .sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));
    const untimed = ordered.filter((item) => !isTimed(item));

    return { ...day, items: reindex([...timed, ...untimed]) };
  });
}

/* ------------------------------------------------------ R5: gán giờ tự động */

export type DurationResolver = (item: ItineraryItem) => number;

// Idempotent: chỉ đụng vào item chưa có giờ, nên chạy lại bao nhiêu lần cũng
// cho cùng kết quả. Các item được xếp nối tiếp nhau nên không bao giờ tự sinh
// ra trùng giờ.
export function autoAssignTimes(day: ItineraryDay, durationOf: DurationResolver): ItineraryDay {
  const ordered = sortedByOrder(day.items);
  const timedEnds = ordered.filter(isTimed).map((item) => toMinutes(item.endTime!));

  let cursor = Math.max(DAY_START_MINUTES, ...timedEnds, DAY_START_MINUTES);
  let stopped = false;

  const items = ordered.map((item) => {
    if (isTimed(item) || stopped) {
      return item;
    }

    const duration = Math.max(SNAP_MINUTES, durationOf(item));
    if (cursor + duration > DAY_LIMIT_MINUTES) {
      stopped = true; // hết chỗ trong ngày — để lại ở dải "Chưa gán giờ"
      return item;
    }

    const assigned = { ...item, startTime: toTimeString(cursor), endTime: toTimeString(cursor + duration) };
    cursor += duration;
    return assigned;
  });

  return { ...day, items };
}

export function autoAssignAllDays(days: ItineraryDay[], durationOf: DurationResolver): ItineraryDay[] {
  return days.map((day) => autoAssignTimes(day, durationOf));
}

/* ----------------------------------------------------------- R6: trùng giờ */

export interface TimeConflict {
  dayId: string;
  aId: string;
  bId: string;
}

// Chạm biên không tính là trùng: 10:00–11:00 và 11:00–12:00 hợp lệ.
function overlaps(a: ItineraryItem, b: ItineraryItem): boolean {
  return (
    toMinutes(a.startTime!) < toMinutes(b.endTime!) && toMinutes(b.startTime!) < toMinutes(a.endTime!)
  );
}

export function findConflicts(days: ItineraryDay[]): TimeConflict[] {
  const conflicts: TimeConflict[] = [];

  for (const day of days) {
    const timed = day.items
      .filter(isTimed)
      .sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));

    for (let i = 0; i < timed.length; i += 1) {
      for (let j = i + 1; j < timed.length; j += 1) {
        if (!overlaps(timed[i]!, timed[j]!)) {
          break; // đã sort theo start — các item sau càng không thể chồng
        }
        conflicts.push({ dayId: day.id, aId: timed[i]!.id, bId: timed[j]!.id });
      }
    }
  }

  return conflicts;
}

export function hasConflicts(days: ItineraryDay[]): boolean {
  return findConflicts(days).length > 0;
}

// "Dồn xuống": đẩy tuần tự các item bị trùng xuống dưới, giữ nguyên thời lượng
// của từng item. Trả về null khi phải vượt quá 23:59 — caller báo lỗi và không
// đổi gì cả.
export function resolveConflictsByPushingDown(day: ItineraryDay): ItineraryDay | null {
  const timed = day.items
    .filter(isTimed)
    .sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));

  const moved = new Map<string, { startTime: string; endTime: string }>();
  let cursor = timed.length > 0 ? toMinutes(timed[0]!.startTime!) : DAY_START_MINUTES;

  for (const item of timed) {
    const duration = itemDurationMinutes(item)!;
    const start = Math.max(toMinutes(item.startTime!), cursor);
    const end = start + duration;

    if (end > DAY_END_MINUTES) {
      return null;
    }

    moved.set(item.id, { startTime: toTimeString(start), endTime: toTimeString(end) });
    cursor = end;
  }

  return {
    ...day,
    items: day.items.map((item) => (moved.has(item.id) ? { ...item, ...moved.get(item.id)! } : item)),
  };
}

// Dồn được hay không phải biết TRƯỚC khi bấm, để disable nút kèm lý do thay vì
// báo lỗi sau một lần bấm hỏng.
export function canResolveConflictsByPushingDown(days: ItineraryDay[]): boolean {
  return days
    .filter((day) => findConflicts([day]).length > 0)
    .every((day) => resolveConflictsByPushingDown(day) !== null);
}

/* --------------------------------------------------------- di chuyển item */

function insertAt(
  items: ItineraryItem[],
  insertAfterItemId: string | null,
  newItem: ItineraryItem,
): ItineraryItem[] {
  const sorted = sortedByOrder(items);
  const index = insertAfterItemId
    ? Math.max(0, sorted.findIndex((item) => item.id === insertAfterItemId) + 1)
    : sorted.length;

  sorted.splice(index, 0, newItem);
  return reindex(sorted);
}

function bucketOf(trip: Trip, dayId: string | null): ItineraryItem[] {
  return dayId ? (trip.days.find((day) => day.id === dayId)?.items ?? []) : trip.unscheduledItems;
}

function withBucket(trip: Trip, dayId: string | null, items: ItineraryItem[]): Trip {
  return dayId
    ? { ...trip, days: trip.days.map((day) => (day.id === dayId ? { ...day, items } : day)) }
    : { ...trip, unscheduledItems: items };
}

// dayId === null nghĩa là khu "Chưa xếp ngày". Đổi ngày thì giờ bị xoá, vì giờ
// cũ có thể trùng với item sẵn có ở ngày mới.
export function moveItemToDay(
  trip: Trip,
  itemId: string,
  fromDayId: string | null,
  toDayId: string | null,
  insertAfterItemId: string | null,
): Trip {
  const source = bucketOf(trip, fromDayId);
  const moving = source.find((item) => item.id === itemId);
  if (!moving || insertAfterItemId === itemId) {
    return trip;
  }

  const remaining = reindex(sortedByOrder(source.filter((item) => item.id !== itemId)));

  if (fromDayId === toDayId) {
    return withBucket(trip, toDayId, insertAt(remaining, insertAfterItemId, moving));
  }

  const afterRemoval = withBucket(trip, fromDayId, remaining);
  const target = bucketOf(afterRemoval, toDayId);

  return withBucket(afterRemoval, toDayId, insertAt(target, insertAfterItemId, clearTimes(moving)));
}

export function addItemToDay(
  trip: Trip,
  dayId: string | null,
  item: ItineraryItem,
  insertAfterItemId: string | null = null,
): Trip {
  return withBucket(trip, dayId, insertAt(bucketOf(trip, dayId), insertAfterItemId, clearTimes(item)));
}

export function removeItem(trip: Trip, itemId: string): Trip {
  return {
    ...trip,
    days: trip.days.map((day) =>
      day.items.some((item) => item.id === itemId)
        ? { ...day, items: reindex(sortedByOrder(day.items.filter((item) => item.id !== itemId))) }
        : day,
    ),
    unscheduledItems: reindex(
      sortedByOrder(trip.unscheduledItems.filter((item) => item.id !== itemId)),
    ),
  };
}

export function updateItem(
  trip: Trip,
  itemId: string,
  patch: Partial<Omit<ItineraryItem, 'id'>>,
): Trip {
  const apply = (items: ItineraryItem[]): ItineraryItem[] =>
    items.map((item) => (item.id === itemId ? { ...item, ...patch } : item));

  return {
    ...trip,
    days: trip.days.map((day) => ({ ...day, items: apply(day.items) })),
    unscheduledItems: apply(trip.unscheduledItems),
  };
}

export function isNoteTooLong(note: string | undefined): boolean {
  return (note?.length ?? 0) > MAX_NOTE_LENGTH;
}

// Ghi chú quá dài chặn lưu ở mức trip, không chỉ ở ô đang gõ — người dùng có
// thể gõ quá ở mục này rồi chuyển sang mục khác mà quên.
export function findItemsWithLongNote(trip: Trip): ItineraryItem[] {
  return [...trip.days.flatMap((day) => day.items), ...trip.unscheduledItems].filter((item) =>
    isNoteTooLong(item.note),
  );
}

export function allItems(trip: Trip): ItineraryItem[] {
  return trip.days.flatMap((day) => day.items);
}
