import { describe, it, expect } from 'vitest';
import {
  getDashboardTasks,
  getFeaturedTrip,
  getNextTripCountdownDays,
  getTotalBudgetByCurrency,
  nextIncompleteStep,
  type TripMoneyState,
} from '../selectors';
import type { ItineraryItem, Trip } from '../../../types';

function makeTrip(overrides: Partial<Trip>): Trip {
  return {
    id: 't1',
    name: 'Kyoto 3-Day Trip',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    status: 'confirmed',
    startDate: '2026-08-14',
    endDate: '2026-08-16',
    travelers: [],
    party: { adults: 1, children: 0 },
    currency: 'JPY',
    budget: 100000,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days: [],
    unscheduledItems: [],
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

const item = (startTime: string | null): ItineraryItem => ({
  id: `i-${startTime}`,
  kind: 'activity',
  title: 'x',
  startTime,
  endTime: startTime ? '23:00' : null,
  order: 0,
});

const fullPlan = { days: [{ id: 'd1', date: '2026-10-10', items: [item('09:00')] }] };
const noMoney = new Map<string, TripMoneyState>();
const TODAY = '2026-10-02';

describe('Dashboard — trip sắp tới', () => {
  it('trip khởi hành HÔM NAY vẫn là trip sắp tới, đếm ngược = 0', () => {
    const now = new Date(2026, 9, 2, 15, 0); // 15h giờ máy
    const trips = [makeTrip({ id: 'a', startDate: '2026-10-02', endDate: '2026-10-04' })];
    expect(getFeaturedTrip(trips, now)?.id).toBe('a');
    expect(getNextTripCountdownDays(trips, now)).toBe(0);
  });

  it('hạn mức cộng riêng theo từng đơn vị tiền', () => {
    const trips = [
      makeTrip({ id: 'a', budget: 1000 }),
      makeTrip({ id: 'b', budget: 500 }),
      makeTrip({ id: 'c', currency: 'USD', budget: 1235 }),
      makeTrip({ id: 'd', budget: null }),
    ];
    expect(getTotalBudgetByCurrency(trips)).toEqual({ JPY: 1500, USD: 1235 });
  });
});

describe('Dashboard — やること', () => {
  it('đang trong ngày đi mà status chưa phải 旅行中 → gợi ý 旅行中', () => {
    const trip = makeTrip({ status: 'confirmed', startDate: '2026-10-01', endDate: '2026-10-03', ...fullPlan });
    const [task] = getDashboardTasks([trip], noMoney, TODAY);
    expect(task).toMatchObject({ kind: 'status', suggested: 'ongoing', reason: 'inProgress' });
  });

  it('đã qua ngày về: có khoản chi → 精算待ち, chưa có → 完了', () => {
    const ended = makeTrip({ id: 'a', status: 'ongoing', startDate: '2026-09-20', endDate: '2026-09-25' });
    const withExpenses = new Map([['a', { hasExpenses: true, openBalance: true }]]);
    expect(getDashboardTasks([ended], withExpenses, TODAY)).toEqual([
      expect.objectContaining({ kind: 'status', suggested: 'settling', reason: 'ended' }),
    ]);
    expect(getDashboardTasks([ended], noMoney, TODAY)[0]).toMatchObject({ suggested: 'done' });
  });

  it('旅行中 nhưng chưa tới ngày đi → gợi ý 確定', () => {
    const trip = makeTrip({ status: 'ongoing', startDate: '2026-11-01', endDate: '2026-11-03', ...fullPlan });
    expect(getDashboardTasks([trip], noMoney, TODAY)[0]).toMatchObject({ suggested: 'confirmed', reason: 'notStarted' });
  });

  it('精算待ち, hoặc đã kết thúc mà còn số dư → việc quyết toán', () => {
    const settling = makeTrip({ id: 'a', status: 'settling', startDate: '2026-09-01', endDate: '2026-09-03' });
    const doneButOpen = makeTrip({ id: 'b', status: 'done', startDate: '2026-09-01', endDate: '2026-09-03' });
    const money = new Map([['b', { hasExpenses: true, openBalance: true }]]);
    const tasks = getDashboardTasks([settling, doneButOpen], money, TODAY);
    expect(tasks.map((task) => `${task.kind}:${task.trip.id}`)).toEqual(['settle:a', 'settle:b']);
  });

  it('plan chưa xong 4/4 của trip chưa đi → nhảy đúng bước còn thiếu, trip gần nhất trước', () => {
    const far = makeTrip({ id: 'far', status: 'planning', startDate: '2026-12-01', endDate: '2026-12-02' });
    const near = makeTrip({
      id: 'near',
      status: 'idea',
      startDate: '2026-10-05',
      endDate: '2026-10-06',
      budget: null,
      days: [{ id: 'd1', date: '2026-10-05', items: [item(null)] }],
    });
    const tasks = getDashboardTasks([far, near], noMoney, TODAY);
    expect(tasks).toEqual([
      expect.objectContaining({ kind: 'plan', trip: near, nextStep: 3, daysUntil: 3 }),
      expect.objectContaining({ kind: 'plan', trip: far, nextStep: 2 }),
    ]);
  });

  it('một trip vừa lệch status vừa còn số dư thì chỉ hiện một việc', () => {
    const trip = makeTrip({ id: 'a', status: 'ongoing', startDate: '2026-09-20', endDate: '2026-09-25' });
    const money = new Map([['a', { hasExpenses: true, openBalance: true }]]);
    expect(getDashboardTasks([trip], money, TODAY)).toHaveLength(1);
  });

  it('xếp theo ưu tiên: status → quyết toán → plan', () => {
    const trips = [
      makeTrip({ id: 'p', status: 'planning', startDate: '2026-10-10', endDate: '2026-10-11' }),
      makeTrip({ id: 's', status: 'settling', startDate: '2026-09-01', endDate: '2026-09-02' }),
      makeTrip({ id: 'o', status: 'planning', startDate: '2026-10-01', endDate: '2026-10-05', ...fullPlan }),
    ];
    expect(getDashboardTasks(trips, noMoney, TODAY).map((task) => task.kind)).toEqual(['status', 'settle', 'plan']);
  });

  it('trip đã xong hết thì không có việc gì', () => {
    const trip = makeTrip({ status: 'done', startDate: '2026-09-01', endDate: '2026-09-02' });
    expect(getDashboardTasks([trip], noMoney, TODAY)).toEqual([]);
  });

  it('nextIncompleteStep khớp với tiến độ R11', () => {
    expect(nextIncompleteStep(makeTrip({}))).toBe(2);
    expect(nextIncompleteStep(makeTrip({ ...fullPlan }))).toBeNull();
    expect(nextIncompleteStep(makeTrip({ ...fullPlan, budget: null }))).toBe(4);
  });
});
