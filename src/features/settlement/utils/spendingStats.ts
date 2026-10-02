import type { CostCategory, Currency, Expense, Trip } from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { planPerHead } from '../../budget/utils/budgetRules';
import { fromPreciseUnits, toPreciseUnits } from '../../budget/utils/money';
import { countTripDays } from '../../itinerary/utils/itineraryRules';
import { travelerOfUser } from '../../itinerary/utils/tripAccess';
import { allocateExpense, toPayableShares } from './settlementRules';

// Thống kê chi tiêu CỦA RIÊNG người đang đăng nhập (màn Tính toán).
//
// "Chi phí của bạn" = phần bạn phải gánh (payable): suất của chính bạn + suất
// của các bé bạn phụ trách. KHÔNG phải số tiền bạn đã ứng ra — người cầm thẻ
// trả hộ cả nhóm sẽ trông như tiêu gấp năm lần.
//
// Chỉ tính trip mà bạn là một thành viên đã gắn tài khoản; trip không có thành
// viên nào là bạn thì không có "phần của bạn" để thống kê.

export interface TripSpending {
  trip: Trip;
  myCost: number; // đơn vị nhỏ nhất, chính xác tới 0,01
  plannedPerAdult: number; // dự trù cho 1 người lớn — mốc so sánh
  days: number;
}

export interface CurrencySpending {
  currency: Currency;
  total: number;
  tripCount: number;
  dayCount: number;
  perTrip: number;
  perDay: number;
  trips: TripSpending[]; // theo ngày đi tăng dần
  byCategory: Record<CostCategory, number>;
}

export interface SpendingStats {
  linkedTripCount: number; // số trip có bạn là thành viên (trong năm đang lọc)
  byCurrency: CurrencySpending[];
}

export function userSpendingStats(
  trips: Trip[],
  expensesByTrip: Map<string, Expense[]>,
  userId: string,
  year: string,
): SpendingStats {
  const buckets = new Map<Currency, { trips: TripSpending[]; units: Record<CostCategory, number> }>();
  let linkedTripCount = 0;

  for (const trip of trips) {
    if (year !== '' && !trip.startDate.startsWith(year)) continue;
    const me = travelerOfUser(trip, userId);
    if (!me) continue;
    linkedTripCount += 1;

    const currency = trip.currency;
    const unitsByCategory = Object.fromEntries(COST_CATEGORIES.map((category) => [category, 0])) as Record<
      CostCategory,
      number
    >;
    let myUnits = 0;

    for (const expense of expensesByTrip.get(trip.id) ?? []) {
      if (expense.kind !== 'expense') continue;
      const payable = toPayableShares(allocateExpense(expense, currency), expense, trip.travelers, currency);
      const mine = toPreciseUnits(payable[me.id] ?? 0, currency);
      if (mine === 0) continue;
      myUnits += mine;
      unitsByCategory[expense.category] += mine;
    }

    if (myUnits === 0) continue;

    const bucket = buckets.get(currency) ?? {
      trips: [],
      units: Object.fromEntries(COST_CATEGORIES.map((category) => [category, 0])) as Record<CostCategory, number>,
    };
    bucket.trips.push({
      trip,
      myCost: fromPreciseUnits(myUnits, currency),
      plannedPerAdult: planPerHead(trip.budgetPlan, trip.party).adult,
      days: countTripDays(trip.startDate, trip.endDate),
    });
    for (const category of COST_CATEGORIES) {
      bucket.units[category] += unitsByCategory[category];
    }
    buckets.set(currency, bucket);
  }

  const byCurrency = [...buckets.entries()].map(([currency, bucket]) => {
    const totalUnits = COST_CATEGORIES.reduce((sum, category) => sum + bucket.units[category], 0);
    const tripCount = bucket.trips.length;
    const dayCount = bucket.trips.reduce((sum, entry) => sum + entry.days, 0);
    const total = fromPreciseUnits(totalUnits, currency);
    return {
      currency,
      total,
      tripCount,
      dayCount,
      perTrip: tripCount > 0 ? total / tripCount : 0,
      perDay: dayCount > 0 ? total / dayCount : 0,
      trips: [...bucket.trips].sort((a, b) => a.trip.startDate.localeCompare(b.trip.startDate)),
      byCategory: Object.fromEntries(
        COST_CATEGORIES.map((category) => [category, fromPreciseUnits(bucket.units[category], currency)]),
      ) as Record<CostCategory, number>,
    };
  });

  // Đơn vị tiền dùng nhiều nhất lên đầu.
  byCurrency.sort((a, b) => b.tripCount - a.tripCount);
  return { linkedTripCount, byCurrency };
}
