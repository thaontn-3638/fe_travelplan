import { differenceInCalendarDays, isSameDay, isSameMonth, parseISO } from 'date-fns';
import type { Currency, Trip, TripStatus } from '../../types';
import { budgetTotal } from '../budget/utils/budgetRules';
import { tripProgress } from '../itinerary/utils/tripProgress';
import { todayISO } from '../../utils/dateFormat';

export function getTripsThisMonthCount(trips: Trip[], now: Date): number {
  return trips.filter((trip) => isSameMonth(parseISO(trip.startDate), now)).length;
}

// Hạn mức của các trip, cộng RIÊNG theo từng đơn vị tiền — không có tỉ giá
// (trip-budget.md D1) nên ¥ và $ không bao giờ được cộng vào nhau.
export function getTotalBudgetByCurrency(trips: Trip[]): Partial<Record<Currency, number>> {
  const totals: Partial<Record<Currency, number>> = {};
  for (const trip of trips) {
    const cap = budgetTotal(trip);
    if (cap === null) continue;
    totals[trip.currency] = (totals[trip.currency] ?? 0) + cap;
  }
  return totals;
}

// So theo NGÀY (chuỗi yyyy-MM-dd theo giờ máy), không theo thời điểm: trước
// đây trip khởi hành hôm nay bị loại vì 00:00 hôm nay "không sau" lúc này.
function getUpcomingTrips(trips: Trip[], now: Date): Trip[] {
  const today = todayISO(now);
  return trips
    .filter((trip) => (trip.status === 'planning' || trip.status === 'confirmed') && trip.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function getFeaturedTrip(trips: Trip[], now: Date): Trip | null {
  const [nextUpcoming] = getUpcomingTrips(trips, now);
  if (nextUpcoming) {
    return nextUpcoming;
  }

  return trips.find((trip) => trip.status === 'ongoing') ?? null;
}

export function getNextTripCountdownDays(trips: Trip[], now: Date): number | null {
  const [nextUpcoming] = getUpcomingTrips(trips, now);
  return nextUpcoming ? differenceInCalendarDays(parseISO(nextUpcoming.startDate), parseISO(todayISO(now))) : null;
}

export interface GreetingHighlights {
  endingToday: Trip | null;
  pendingSettlement: Trip | null;
}

export function getGreetingHighlights(trips: Trip[], now: Date): GreetingHighlights {
  return {
    endingToday:
      trips.find((trip) => trip.status === 'ongoing' && isSameDay(parseISO(trip.endDate ?? trip.startDate), now)) ??
      null,
    pendingSettlement: trips.find((trip) => trip.status === 'settling') ?? null,
  };
}

// ---------------------------------------------------------------------------
// Danh sách việc cần làm (やること)
//
// Status trip do người dùng tự đổi — app không tự đổi ngầm. Thay vào đó Dashboard
// chỉ ra chỗ lệch và cho sửa bằng một click.
// ---------------------------------------------------------------------------

export type DashboardTask =
  | {
      kind: 'status';
      key: string;
      trip: Trip;
      suggested: TripStatus;
      // inProgress: đang trong ngày đi · ended: đã qua ngày về · notStarted: chưa tới ngày đi
      reason: 'inProgress' | 'ended' | 'notStarted';
    }
  | {
      kind: 'settle';
      key: string;
      trip: Trip;
      // true: còn số dư khác 0 · false: status là 精算待ち nhưng chưa có gì để chia
      openBalance: boolean;
    }
  | {
      kind: 'plan';
      key: string;
      trip: Trip;
      progress: number;
      nextStep: 2 | 3 | 4;
      daysUntil: number;
    };

export interface TripMoneyState {
  hasExpenses: boolean;
  openBalance: boolean;
}

const PLANNING_STATUSES: TripStatus[] = ['idea', 'planning', 'confirmed'];

// Bước đầu tiên còn thiếu — cùng điều kiện "done" với tripProgress (R11).
export function nextIncompleteStep(trip: Trip): 2 | 3 | 4 | null {
  const items = trip.days.flatMap((day) => day.items);
  if (items.length === 0) return 2;
  if (!items.some((item) => item.startTime !== null)) return 3;
  if (trip.budget === null && trip.budgetPerPerson === null && trip.budgetPlan.length === 0) return 4;
  return null;
}

const KIND_RANK: Record<DashboardTask['kind'], number> = { status: 0, settle: 1, plan: 2 };

export function getDashboardTasks(
  trips: Trip[],
  moneyByTrip: Map<string, TripMoneyState>,
  today: string,
): DashboardTask[] {
  const tasks: DashboardTask[] = [];

  for (const trip of trips) {
    const start = trip.startDate;
    const end = trip.endDate ?? trip.startDate;
    const ended = today > end;
    const inProgress = start <= today && today <= end;
    const notStarted = today < start;
    const money = moneyByTrip.get(trip.id) ?? { hasExpenses: false, openBalance: false };

    // ① Status lệch so với ngày đi.
    let statusTask: DashboardTask | null = null;
    if (inProgress && PLANNING_STATUSES.includes(trip.status)) {
      statusTask = { kind: 'status', key: `status:${trip.id}:ongoing`, trip, suggested: 'ongoing', reason: 'inProgress' };
    } else if (ended && (PLANNING_STATUSES.includes(trip.status) || trip.status === 'ongoing')) {
      const suggested: TripStatus = money.hasExpenses ? 'settling' : 'done';
      statusTask = { kind: 'status', key: `status:${trip.id}:${suggested}`, trip, suggested, reason: 'ended' };
    } else if (notStarted && trip.status === 'ongoing') {
      statusTask = { kind: 'status', key: `status:${trip.id}:confirmed`, trip, suggested: 'confirmed', reason: 'notStarted' };
    }
    if (statusTask) tasks.push(statusTask);

    // ② Chờ quyết toán. Đã có việc ① cho trip này thì gộp: đổi status xong
    //    việc ② tự hiện ra, hai dòng cùng lúc cho một trip là nhiễu.
    if (!statusTask && (trip.status === 'settling' || (ended && money.openBalance))) {
      tasks.push({ kind: 'settle', key: `settle:${trip.id}`, trip, openBalance: money.openBalance });
    }

    // ③ Plan chưa xong — chỉ cho trip chưa khởi hành.
    if (notStarted && PLANNING_STATUSES.includes(trip.status)) {
      const nextStep = nextIncompleteStep(trip);
      if (nextStep !== null) {
        tasks.push({
          kind: 'plan',
          key: `plan:${trip.id}:${nextStep}`,
          trip,
          progress: tripProgress(trip),
          nextStep,
          daysUntil: differenceInCalendarDays(parseISO(start), parseISO(today)),
        });
      }
    }
  }

  return tasks.sort((a, b) => {
    if (a.kind !== b.kind) return KIND_RANK[a.kind] - KIND_RANK[b.kind];
    // Cùng loại: trip sắp tới / gần nhất trước.
    if (a.kind === 'plan' && b.kind === 'plan') return a.daysUntil - b.daysUntil;
    return a.trip.startDate.localeCompare(b.trip.startDate);
  });
}
