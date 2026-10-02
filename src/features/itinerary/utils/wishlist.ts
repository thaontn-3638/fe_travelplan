import type { Place, SavedPlace } from '../../../types';
import type { CategoryKey } from '../../places/utils';

export interface WishlistEntry {
  row: SavedPlace;
  place: Place;
  // Số lần place này đã được thêm vào lịch trình. > 0 nghĩa là hàng bị làm mờ
  // và tụt xuống cuối, nhưng vẫn thêm lại được (khách sạn nhiều đêm, quán ăn
  // quay lại) — xem trip-board.md R8.
  usedCount: number;
}

export function countPlaceUsage(placeIds: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const placeId of placeIds) {
    counts.set(placeId, (counts.get(placeId) ?? 0) + 1);
  }
  return counts;
}

// Nguồn sự thật duy nhất cho thứ tự + bộ lọc của panel địa điểm, dùng chung
// giữa PlacePickerPanel và badge đếm ở tab mobile.
export function selectVisibleWishlist(
  savedPlaces: SavedPlace[],
  placesById: Map<string, Place>,
  usageByPlaceId: Map<string, number>,
  category: CategoryKey | null,
): WishlistEntry[] {
  return savedPlaces
    .map((row) => ({ row, place: placesById.get(row.placeId) }))
    .filter((entry): entry is { row: SavedPlace; place: Place } => Boolean(entry.place))
    .filter((entry) => !category || entry.place.category === category)
    .map((entry) => ({ ...entry, usedCount: usageByPlaceId.get(entry.row.placeId) ?? 0 }))
    .sort((a, b) => {
      // Chưa dùng lên trước, sau đó mới-lưu-trước.
      if ((a.usedCount === 0) !== (b.usedCount === 0)) {
        return a.usedCount === 0 ? -1 : 1;
      }
      return b.row.addedAt.localeCompare(a.row.addedAt);
    });
}
