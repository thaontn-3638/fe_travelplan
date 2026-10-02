import { describe, expect, it } from 'vitest';
import type { ItineraryDay, ItineraryItem, Trip } from '../../../types';
import {
  addDay,
  applyDateRange,
  autoAssignTimes,
  buildDays,
  countTripDays,
  findConflicts,
  isUsableDateRange,
  isValidRange,
  itemsLostByDateRange,
  moveItemToDay,
  normalizeTripDates,
  removeDay,
  reorderByTime,
  resolveConflictsByPushingDown,
  DEFAULT_ACTIVITY_MINUTES,
} from '../utils/itineraryRules';

let idCounter = 0;
const nextId = (): string => `id${(idCounter += 1)}`;

function item(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    id: nextId(),
    kind: 'place',
    placeId: 'p1',
    startTime: null,
    endTime: null,
    order: 0,
    ...overrides,
  };
}

function day(date: string, items: ItineraryItem[] = [], id = nextId()): ItineraryDay {
  return { id, date, items: items.map((entry, index) => ({ ...entry, order: index })) };
}

function trip(days: ItineraryDay[], unscheduledItems: ItineraryItem[] = []): Trip {
  return {
    id: 't1',
    name: 'Test',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: days[0]?.date ?? '2026-09-20',
    endDate: days.length > 1 ? days[days.length - 1]!.date : null,
    status: 'idea',
    travelers: [],
    party: { adults: 1, children: 0 },
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days,
    unscheduledItems,
    updatedAt: '2026-09-14T00:00:00.000Z',
  };
}

const oneHour = () => 60;

describe('R1 — ngày và khoảng ngày', () => {
  it('endDate null nghĩa là trip 1 ngày', () => {
    expect(countTripDays('2026-09-20', null)).toBe(1);
    expect(countTripDays('2026-09-20', '2026-09-22')).toBe(3);
    expect(buildDays('2026-09-20', null, nextId)).toHaveLength(1);
    expect(buildDays('2026-09-20', '2026-09-22', nextId).map((d) => d.date)).toEqual([
      '2026-09-20',
      '2026-09-21',
      '2026-09-22',
    ]);
  });

  it('chuẩn hoá: còn 1 ngày thì endDate về null', () => {
    const result = normalizeTripDates(trip([day('2026-09-20')]));
    expect(result.endDate).toBeNull();
  });

  it('chuẩn hoá: days luôn liên tục tính từ startDate', () => {
    const result = normalizeTripDates(
      trip([day('2026-09-20'), day('2026-09-25'), day('2026-09-30')]),
    );
    expect(result.days.map((d) => d.date)).toEqual(['2026-09-20', '2026-09-21', '2026-09-22']);
    expect(result.endDate).toBe('2026-09-22');
  });

  it('buildDays cắt ở 30 ngày', () => {
    expect(buildDays('2026-01-01', '2026-12-31', nextId)).toHaveLength(30);
  });
});

describe('R2 — thêm / xoá ngày', () => {
  it('thêm ngày thì endDate tự nới', () => {
    const result = addDay(trip([day('2026-09-20')]), nextId);
    expect(result.days).toHaveLength(2);
    expect(result.endDate).toBe('2026-09-21');
  });

  it('xoá ngày giữa: các ngày sau dồn lên, endDate lùi 1', () => {
    const d1 = day('2026-09-20', [item()]);
    const d2 = day('2026-09-21', [item()]);
    const d3 = day('2026-09-22', [item()]);
    const result = removeDay(trip([d1, d2, d3]), d2.id);

    expect(result.days).toHaveLength(2);
    expect(result.days.map((d) => d.date)).toEqual(['2026-09-20', '2026-09-21']);
    expect(result.days.map((d) => d.id)).toEqual([d1.id, d3.id]);
    expect(result.endDate).toBe('2026-09-21');
  });

  it('item của ngày bị xoá rơi vào "chưa xếp ngày" và mất giờ', () => {
    const kept = item();
    const lost = item({ startTime: '09:00', endTime: '10:00' });
    const d1 = day('2026-09-20', [kept]);
    const d2 = day('2026-09-21', [lost]);

    const result = removeDay(trip([d1, d2]), d2.id);

    expect(result.unscheduledItems).toHaveLength(1);
    expect(result.unscheduledItems[0]).toMatchObject({ id: lost.id, startTime: null, endTime: null });
    expect(result.endDate).toBeNull();
  });

  it('không xoá được khi chỉ còn 1 ngày', () => {
    const only = day('2026-09-20', [item()]);
    const source = trip([only]);
    expect(removeDay(source, only.id)).toBe(source);
  });
});

describe('R3 — đổi khoảng ngày ở Step 1', () => {
  it('kéo dài chuyến thì thêm ngày rỗng ở cuối', () => {
    const result = applyDateRange(trip([day('2026-09-20', [item()])]), '2026-09-20', '2026-09-22', nextId);
    expect(result.days).toHaveLength(3);
    expect(result.days[0]!.items).toHaveLength(1);
    expect(result.days[2]!.items).toHaveLength(0);
  });

  it('rút ngắn chuyến thì item bị cắt chuyển sang "chưa xếp ngày", không xoá', () => {
    const survivor = item();
    const orphan = item({ startTime: '09:00', endTime: '10:00' });
    const source = trip([day('2026-09-20', [survivor]), day('2026-09-21', [orphan])]);

    expect(itemsLostByDateRange(source, '2026-09-20', null)).toEqual({
      removedDays: 1,
      movedItems: 1,
    });

    const result = applyDateRange(source, '2026-09-20', null, nextId);
    expect(result.days).toHaveLength(1);
    expect(result.endDate).toBeNull();
    expect(result.unscheduledItems.map((entry) => entry.id)).toEqual([orphan.id]);
    expect(result.unscheduledItems[0]!.startTime).toBeNull();
  });

  it('đổi startDate thì toàn bộ ngày dịch theo, item giữ nguyên', () => {
    const kept = item();
    const result = applyDateRange(
      trip([day('2026-09-20', [kept]), day('2026-09-21')]),
      '2026-10-01',
      '2026-10-02',
      nextId,
    );

    expect(result.days.map((d) => d.date)).toEqual(['2026-10-01', '2026-10-02']);
    expect(result.days[0]!.items.map((entry) => entry.id)).toEqual([kept.id]);
  });
});

describe('R4 — thời gian thắng order', () => {
  it('reorderByTime sắp theo giờ, item chưa gán giờ xếp cuối và giữ thứ tự tương đối', () => {
    const late = item({ startTime: '14:00', endTime: '15:00' });
    const early = item({ startTime: '09:00', endTime: '10:00' });
    const untimedA = item();
    const untimedB = item();

    const [result] = reorderByTime([day('2026-09-20', [late, early, untimedA, untimedB])]);

    expect(result!.items.map((entry) => entry.id)).toEqual([
      early.id,
      late.id,
      untimedA.id,
      untimedB.id,
    ]);
    expect(result!.items.map((entry) => entry.order)).toEqual([0, 1, 2, 3]);
  });
});

describe('R5 — gán giờ tự động', () => {
  it('ngày rỗng: item đầu tiên bắt đầu 08:00, các item nối tiếp nhau', () => {
    const result = autoAssignTimes(day('2026-09-20', [item(), item(), item()]), oneHour);

    expect(result.items.map((entry) => [entry.startTime, entry.endTime])).toEqual([
      ['08:00', '09:00'],
      ['09:00', '10:00'],
      ['10:00', '11:00'],
    ]);
  });

  it('không đụng vào item đã có giờ, và xếp tiếp sau item cuối cùng có giờ', () => {
    const fixed = item({ startTime: '13:00', endTime: '14:30' });
    const fresh = item();
    const result = autoAssignTimes(day('2026-09-20', [fixed, fresh]), oneHour);

    expect(result.items[0]).toMatchObject({ startTime: '13:00', endTime: '14:30' });
    expect(result.items[1]).toMatchObject({ startTime: '14:30', endTime: '15:30' });
  });

  it('idempotent: chạy lại cho cùng kết quả', () => {
    const source = day('2026-09-20', [item(), item()]);
    const once = autoAssignTimes(source, oneHour);
    expect(autoAssignTimes(once, oneHour)).toEqual(once);
  });

  it('không bao giờ tự sinh ra trùng giờ', () => {
    const result = autoAssignTimes(day('2026-09-20', [item(), item(), item(), item()]), oneHour);
    expect(findConflicts([result])).toEqual([]);
  });

  it('tràn quá 23:00 thì để lại item ở trạng thái chưa gán giờ', () => {
    const many = Array.from({ length: 20 }, () => item());
    const result = autoAssignTimes(day('2026-09-20', many), oneHour);

    const timed = result.items.filter((entry) => entry.startTime !== null);
    expect(timed).toHaveLength(15); // 08:00 -> 23:00
    expect(result.items.filter((entry) => entry.startTime === null)).toHaveLength(5);
  });

  it('dùng thời lượng theo từng item', () => {
    const activity = item({ kind: 'activity', title: 'Tự do', placeId: undefined });
    const result = autoAssignTimes(day('2026-09-20', [activity]), () => DEFAULT_ACTIVITY_MINUTES);
    expect(result.items[0]).toMatchObject({ startTime: '08:00', endTime: '09:00' });
  });
});

describe('R6 — trùng giờ', () => {
  it('chạm biên không tính là trùng', () => {
    const a = item({ startTime: '10:00', endTime: '11:00' });
    const b = item({ startTime: '11:00', endTime: '12:00' });
    expect(findConflicts([day('2026-09-20', [a, b])])).toEqual([]);
  });

  it('chồng lấn bị bắt', () => {
    const a = item({ startTime: '10:00', endTime: '11:00' });
    const b = item({ startTime: '10:30', endTime: '11:30' });
    const conflicts = findConflicts([day('2026-09-20', [a, b])]);

    expect(conflicts).toHaveLength(1);
    expect([conflicts[0]!.aId, conflicts[0]!.bId].sort()).toEqual([a.id, b.id].sort());
  });

  it('item chưa gán giờ không tham gia kiểm tra', () => {
    const timed = item({ startTime: '10:00', endTime: '11:00' });
    expect(findConflicts([day('2026-09-20', [timed, item(), item()])])).toEqual([]);
  });

  it('isValidRange: end phải sau start và không vượt 23:59', () => {
    expect(isValidRange('09:00', '10:00')).toBe(true);
    expect(isValidRange('10:00', '10:00')).toBe(false);
    expect(isValidRange('11:00', '10:00')).toBe(false);
    expect(isValidRange('23:00', '23:59')).toBe(true);
  });

  it('dồn xuống: giữ nguyên thời lượng và xoá hết trùng', () => {
    const a = item({ startTime: '10:00', endTime: '12:00' });
    const b = item({ startTime: '10:30', endTime: '11:30' });
    const c = item({ startTime: '11:00', endTime: '11:30' });

    const result = resolveConflictsByPushingDown(day('2026-09-20', [a, b, c]))!;

    expect(result).not.toBeNull();
    expect(findConflicts([result])).toEqual([]);
    expect(result.items.map((entry) => [entry.startTime, entry.endTime])).toEqual([
      ['10:00', '12:00'],
      ['12:00', '13:00'],
      ['13:00', '13:30'],
    ]);
  });

  it('dồn xuống trả null khi phải vượt quá 23:59', () => {
    const a = item({ startTime: '22:00', endTime: '23:30' });
    const b = item({ startTime: '22:30', endTime: '23:30' });
    expect(resolveConflictsByPushingDown(day('2026-09-20', [a, b]))).toBeNull();
  });
});

describe('di chuyển item', () => {
  it('kéo sang ngày khác thì giờ bị xoá', () => {
    const moving = item({ startTime: '09:00', endTime: '10:00' });
    const d1 = day('2026-09-20', [moving]);
    const d2 = day('2026-09-21');

    const result = moveItemToDay(trip([d1, d2]), moving.id, d1.id, d2.id, null);

    expect(result.days[0]!.items).toHaveLength(0);
    expect(result.days[1]!.items[0]).toMatchObject({ id: moving.id, startTime: null, endTime: null });
  });

  it('kéo trong cùng một ngày thì giữ nguyên giờ và chỉ đổi order', () => {
    const first = item({ startTime: '09:00', endTime: '10:00' });
    const second = item({ startTime: '11:00', endTime: '12:00' });
    const d1 = day('2026-09-20', [first, second]);

    const result = moveItemToDay(trip([d1]), first.id, d1.id, d1.id, second.id);

    expect(result.days[0]!.items.map((entry) => entry.id)).toEqual([second.id, first.id]);
    expect(result.days[0]!.items[1]!.startTime).toBe('09:00');
  });

  it('kéo từ "chưa xếp ngày" vào một ngày', () => {
    const orphan = item();
    const d1 = day('2026-09-20');
    const result = moveItemToDay(trip([d1], [orphan]), orphan.id, null, d1.id, null);

    expect(result.unscheduledItems).toHaveLength(0);
    expect(result.days[0]!.items.map((entry) => entry.id)).toEqual([orphan.id]);
  });
});

describe('R3b — đang gõ dở ngày thì không dựng lại lịch', () => {
  it('chỉ coi là dùng được khi ngày đi hợp lệ và ngày về không trước ngày đi', () => {
    expect(isUsableDateRange('2026-08-14', '2026-08-20')).toBe(true);
    expect(isUsableDateRange('2026-08-14', null)).toBe(true);
    expect(isUsableDateRange('2026-08-14', '2026-08-14')).toBe(true);
    expect(isUsableDateRange('', '2026-08-20')).toBe(false);
    expect(isUsableDateRange('2026-08-14', '2026-08-01')).toBe(false);
    expect(isUsableDateRange('2026-08-14', '2026-13-40')).toBe(false);
  });
});
