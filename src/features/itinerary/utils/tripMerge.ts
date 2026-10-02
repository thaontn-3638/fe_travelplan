import type { Trip } from '../../../types';

// Lưu trip khi người khác cũng đang sửa (trip-board.md §R13).
//
// Trip được chia thành các PHẦN độc lập. Lúc lưu, so 3 bản:
//   original — bản trên server lúc mình bắt đầu sửa
//   draft    — bản mình đang sửa
//   latest   — bản trên server ngay lúc bấm Lưu
// Phần mình đổi mà người kia không đổi → ghi phần của mình (PATCH chỉ những
// field đó, json-server trộn vào, phần người kia sửa vẫn còn nguyên).
// Cả hai cùng đổi một phần → xung đột, hỏi người dùng giữ bản nào.

export type TripSection = 'basics' | 'travelers' | 'itinerary' | 'budget';

export const TRIP_SECTIONS: TripSection[] = ['basics', 'travelers', 'itinerary', 'budget'];

// Ngày đi/về nằm chung phần "lịch trình": đổi khoảng ngày là dựng lại `days`.
// Tiền tệ nằm chung phần "dự trù": đổi tiền tệ là quy đổi lại cả cây dự trù.
export const SECTION_FIELDS: Record<TripSection, (keyof Trip)[]> = {
  basics: ['name', 'regions', 'status', 'party'],
  travelers: ['travelers'],
  itinerary: ['startDate', 'endDate', 'days', 'unscheduledItems'],
  budget: ['currency', 'budget', 'budgetPerPerson', 'budgetPlan'],
};

// So sánh không phụ thuộc thứ tự key — bản nháp dựng lại object có thể đổi
// thứ tự key mà giá trị y hệt, không được tính là "đã sửa".
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      return Object.fromEntries(
        Object.entries(inner as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return inner;
  });
}

export function changedSections(from: Trip, to: Trip): TripSection[] {
  return TRIP_SECTIONS.filter((section) =>
    SECTION_FIELDS[section].some((field) => stable(from[field] ?? null) !== stable(to[field] ?? null)),
  );
}

export function pickSections(trip: Trip, sections: TripSection[]): Partial<Trip> {
  const result: Partial<Record<keyof Trip, unknown>> = {};
  for (const section of sections) {
    for (const field of SECTION_FIELDS[section]) {
      // null chứ không undefined: JSON bỏ undefined, PATCH sẽ không xoá được.
      result[field] = trip[field] ?? null;
    }
  }
  return result as Partial<Trip>;
}

export interface SaveAnalysis {
  mine: TripSection[];
  theirs: TripSection[];
  conflicts: TripSection[];
}

export function analyzeSave(original: Trip, draft: Trip, latest: Trip): SaveAnalysis {
  const mine = changedSections(original, draft);
  const theirs = changedSections(original, latest);
  return { mine, theirs, conflicts: mine.filter((section) => theirs.includes(section)) };
}

// "Lấy bản mới nhất" cho các phần bị xung đột, giữ nguyên những phần khác mình
// đang sửa dở để người dùng xem lại rồi lưu tiếp.
export function takeLatest(draft: Trip, latest: Trip, sections: TripSection[]): Trip {
  return { ...draft, ...pickSections(latest, sections), updatedAt: latest.updatedAt } as Trip;
}
