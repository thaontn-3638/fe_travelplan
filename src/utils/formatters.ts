import { formatDateRange } from './dateFormat';
import type { PartySize, Place, TripRegion } from '../types';
import { formatMoney } from '../features/budget/utils/money';

// Giá tham khảo của một địa điểm, theo đúng đơn vị của chính nó. Catalog hiện
// toàn JPY nên mặc định 'JPY' khi bản ghi cũ chưa có `priceCurrency`.
export function formatPlacePrice(place: Pick<Place, 'price' | 'priceCurrency'>): string {
  return formatMoney(place.price ?? 0, place.priceCurrency ?? 'JPY');
}

// Giữ lại tên cũ cho các màn đang import; quy ước ghi ngày nằm ở dateFormat.ts.
export const formatTripDateRange = formatDateRange;

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
}

export function formatTripRegions(regions: TripRegion[]): string {
  return regions.map((region) => region.name).join(' · ');
}

export function countParty(party: PartySize): number {
  return party.adults + party.children;
}
