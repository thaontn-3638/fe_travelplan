import type { ItineraryItem, Place, Trip, TripRegion } from '../../../types';

const MAX_NAME_REGIONS = 3;

// Tên mặc định ghép từ các điểm đến: "Kyoto - Osaka - Nara", quá 3 điểm thì
// cắt bớt: "Kyoto - Osaka - Nara +2".
export function buildDefaultTripName(regions: TripRegion[]): string {
  if (regions.length === 0) {
    return '';
  }

  const shown = regions.slice(0, MAX_NAME_REGIONS).map((region) => region.name);
  const rest = regions.length - shown.length;

  return rest > 0 ? `${shown.join(' - ')} +${rest}` : shown.join(' - ');
}

// Ảnh minh hoạ mặc định nằm trong /public — không phụ thuộc dịch vụ ngoài, và
// đổi màu theo bảng màu của app. Có nhiều biến thể để một danh sách toàn trip
// chưa có địa điểm không trông như cùng một tấm ảnh lặp lại.
export const DEFAULT_TRIP_COVER_URLS = [
  '/covers/trip-cover-1.svg',
  '/covers/trip-cover-2.svg',
  '/covers/trip-cover-3.svg',
  '/covers/trip-cover-4.svg',
] as const;

export const DEFAULT_TRIP_COVER_URL = DEFAULT_TRIP_COVER_URLS[0];

// Cùng một trip luôn ra cùng một biến thể (băm theo id), nên ảnh không nhảy
// giữa các lần render hay giữa các màn.
export function defaultTripCoverUrl(tripId: string): string {
  let hash = 0;
  for (const char of tripId) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return DEFAULT_TRIP_COVER_URLS[hash % DEFAULT_TRIP_COVER_URLS.length]!;
}

// Cover = ảnh của place đầu tiên trong lịch trình (ngày sớm nhất, rồi order nhỏ
// nhất trong ngày đó); fallback về ảnh minh hoạ khi chưa có place nào.
export function resolveTripCoverUrl(trip: Trip, placesById: Map<string, Place>): string {
  const fallback = defaultTripCoverUrl(trip.id);
  const firstPlaceId = findFirstPlaceId(trip);
  if (!firstPlaceId) {
    return fallback;
  }

  return placesById.get(firstPlaceId)?.coverUrl ?? fallback;
}

function findFirstPlaceId(trip: Trip): string | null {
  const sortedDays = [...trip.days].sort((a, b) => a.date.localeCompare(b.date));

  for (const day of sortedDays) {
    const sorted = [...day.items].sort((a, b) => a.order - b.order);
    const place = sorted.find(isPlaceItem);
    if (place) {
      return place.placeId!;
    }
  }

  return null;
}

function isPlaceItem(item: ItineraryItem): boolean {
  return item.kind === 'place' && typeof item.placeId === 'string';
}

export function placeIdsInTrip(trip: Trip): string[] {
  return [...trip.days.flatMap((day) => day.items), ...trip.unscheduledItems]
    .filter(isPlaceItem)
    .map((item) => item.placeId!);
}
