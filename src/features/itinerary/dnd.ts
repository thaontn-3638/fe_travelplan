import type { DragEndEvent } from '@dnd-kit/core';
import type { ItineraryItem, Trip } from '../../types';
import { addItemToDay, moveItemToDay } from './utils/itineraryRules';

// `dayId: null` ở mọi chỗ nghĩa là khu "Chưa xếp ngày".
export type DragData =
  | { type: 'place'; placeId: string }
  | { type: 'item'; dayId: string | null; itemId: string }
  | { type: 'day'; dayId: string }
  | { type: 'unscheduled' };

export function createPlaceItem(placeId: string, id: string = crypto.randomUUID()): ItineraryItem {
  return { id, kind: 'place', placeId, startTime: null, endTime: null, order: 0 };
}

export function createActivityItem(
  title: string,
  extra: Pick<ItineraryItem, 'note' | 'category'> = {},
  id: string = crypto.randomUUID(),
): ItineraryItem {
  return {
    id,
    kind: 'activity',
    title,
    category: 'other',
    startTime: null,
    endTime: null,
    order: 0,
    ...extra,
  };
}

function dropTarget(overData: DragData): { dayId: string | null; insertAfterItemId: string | null } | null {
  switch (overData.type) {
    case 'day':
      return { dayId: overData.dayId, insertAfterItemId: null };
    case 'item':
      return { dayId: overData.dayId, insertAfterItemId: overData.itemId };
    case 'unscheduled':
      return { dayId: null, insertAfterItemId: null };
    default:
      return null;
  }
}

// Hàm thuần: từ trip hiện tại + DragEndEvent trả về trip kế tiếp, hoặc null khi
// đích thả không hợp lệ. Bước 2 không gán giờ — item mới luôn có startTime null
// (xem trip-board.md R4/R5).
export function applyItineraryDrag(trip: Trip, event: DragEndEvent): Trip | null {
  const { active, over } = event;
  if (!over) {
    return null;
  }

  const activeData = active.data.current as DragData | undefined;
  const overData = over.data.current as DragData | undefined;
  if (!activeData || !overData) {
    return null;
  }

  const target = dropTarget(overData);
  if (!target) {
    return null;
  }

  if (activeData.type === 'place') {
    return addItemToDay(
      trip,
      target.dayId,
      createPlaceItem(activeData.placeId),
      target.insertAfterItemId,
    );
  }

  if (activeData.type === 'item') {
    return moveItemToDay(
      trip,
      activeData.itemId,
      activeData.dayId,
      target.dayId,
      target.insertAfterItemId,
    );
  }

  return null;
}
