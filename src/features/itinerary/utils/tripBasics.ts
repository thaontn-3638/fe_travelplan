import type { PartySize, Traveler, TripRegion, TripStatus } from '../../../types';
import { countTripDays, MAX_TRIP_DAYS } from './itineraryRules';
import { todayISO } from '../../../utils/dateFormat';

export interface TripBasics {
  name: string;
  regions: TripRegion[];
  startDate: string;
  endDate: string | null;
  party: PartySize;
  // Danh sách người có tên. Tách hẳn khỏi `party` (số suất chia tiền) — hai
  // thứ phục vụ hai việc và được phép lệch, xem trip-budget.md B7.
  travelers: Traveler[];
  status: TripStatus;
}

export const TRIP_STATUSES: TripStatus[] = [
  'idea',
  'planning',
  'confirmed',
  'ongoing',
  'settling',
  'done',
];

// Số người lớn / trẻ em theo danh sách thành viên. Người đã rời nhóm VẪN tính:
// họ vẫn là một suất của chuyến đi.
export function partyFromTravelers(travelers: Traveler[]): PartySize {
  return {
    adults: travelers.filter((traveler) => !traveler.isChild).length,
    children: travelers.filter((traveler) => traveler.isChild).length,
  };
}

export function partyMatchesTravelers(party: PartySize, travelers: Traveler[]): boolean {
  const named = partyFromTravelers(travelers);
  return named.adults === party.adults && named.children === party.children;
}

export interface BasicsValidation {
  // Số người (party) lệch danh sách thành viên → không cho lưu.
  partyError: string | null;
  // Giá trị cho nút sửa nhanh; null khi không sửa được (chưa có người lớn nào).
  partySuggestion: PartySize | null;
  dateError: string | null;
  pastWarning: boolean;
  canSubmit: boolean;
  dayCount: number | null;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function validateBasics(value: TripBasics, t: Translate): BasicsValidation {
  const named = partyFromTravelers(value.travelers);
  let partyError: string | null = null;
  if (named.adults === 0) {
    partyError = t('itinerary.stepOne.partyNeedAdult');
  } else if (!partyMatchesTravelers(value.party, value.travelers)) {
    partyError = t('itinerary.stepOne.partyMismatch', {
      adults: value.party.adults,
      children: value.party.children,
      namedAdults: named.adults,
      namedChildren: named.children,
    });
  }

  const dayCount = value.startDate ? countTripDays(value.startDate, value.endDate) : null;

  let dateError: string | null = null;
  if (value.endDate && value.startDate && value.endDate < value.startDate) {
    dateError = t('itinerary.stepOne.endBeforeStart');
  } else if (dayCount !== null && dayCount > MAX_TRIP_DAYS) {
    dateError = t('itinerary.stepOne.tooLong');
  }

  return {
    partyError,
    partySuggestion: partyError && named.adults > 0 ? named : null,
    dateError,
    // Ngày quá khứ chỉ cảnh báo, không chặn — người dùng có thể nhập lại chuyến cũ.
    pastWarning: Boolean(value.startDate) && value.startDate < todayISO(),
    canSubmit:
      value.regions.length > 0 &&
      Boolean(value.startDate) &&
      Boolean(value.name.trim()) &&
      !dateError &&
      !partyError,
    dayCount,
  };
}
