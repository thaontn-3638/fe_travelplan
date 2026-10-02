import { describe, expect, it } from 'vitest';
import type { Trip } from '../../../types';
import { analyzeSave, changedSections, pickSections, takeLatest } from '../utils/tripMerge';

const base: Trip = {
  id: 't1',
  ownerId: 'u1',
  name: 'Kyoto',
  regions: [{ id: 'r1', name: 'Kyoto' }],
  startDate: '2026-10-10',
  endDate: '2026-10-11',
  status: 'planning',
  travelers: [{ id: 'a', fullName: 'A', initials: 'A', colorClass: 'bg-ocean' }],
  party: { adults: 1, children: 0 },
  currency: 'JPY',
  budget: null,
  budgetPerPerson: null,
  spent: 0,
  budgetPlan: [],
  days: [
    { id: 'd1', date: '2026-10-10', items: [] },
    { id: 'd2', date: '2026-10-11', items: [] },
  ],
  unscheduledItems: [],
  updatedAt: '2026-10-01T00:00:00.000Z',
};

describe('R13 — lưu khi người khác cũng đang sửa', () => {
  it('sửa phần khác nhau thì không xung đột, và chỉ ghi phần của mình', () => {
    const mine = { ...base, name: 'Kyoto mùa thu' };
    const latest = { ...base, budget: 100000, updatedAt: '2026-10-02T00:00:00.000Z' };

    const result = analyzeSave(base, mine, latest);
    expect(result).toEqual({ mine: ['basics'], theirs: ['budget'], conflicts: [] });

    // PATCH chỉ chứa field của phần "basics" → budget người kia vừa đặt còn nguyên.
    const patch = pickSections(mine, result.mine);
    expect(patch).toMatchObject({ name: 'Kyoto mùa thu' });
    expect('budget' in patch).toBe(false);
  });

  it('cùng sửa một phần thì báo xung đột', () => {
    const mine = { ...base, days: [{ ...base.days[0]!, items: [] }, { ...base.days[1]!, date: '2026-10-11', items: [] }], endDate: '2026-10-12' };
    const latest = { ...base, unscheduledItems: [{ id: 'x', kind: 'activity' as const, title: 'Onsen', startTime: null, endTime: null, order: 0 }] };

    expect(analyzeSave(base, mine, latest).conflicts).toEqual(['itinerary']);
  });

  it('thứ tự key khác nhau không bị coi là đã sửa', () => {
    const reordered = { ...base, party: { children: 0, adults: 1 } };
    expect(changedSections(base, reordered)).toEqual([]);
  });

  it('spent / treasurer / chia sẻ không thuộc phần nào — đổi chúng không gây xung đột', () => {
    const latest = { ...base, spent: 5000, treasurerId: 'a', shareToken: 'abc' };
    expect(changedSections(base, latest)).toEqual([]);
  });

  it('"lấy bản mới nhất" chỉ thay phần bị trùng, giữ phần khác mình đang sửa', () => {
    const mine = { ...base, name: 'Tên mới', travelers: [] };
    const latest = { ...base, travelers: [...base.travelers, { id: 'b', initials: 'B', colorClass: 'bg-coral' }] };
    const merged = takeLatest(mine, latest, ['travelers']);
    expect(merged.name).toBe('Tên mới');
    expect(merged.travelers.map((traveler) => traveler.id)).toEqual(['a', 'b']);
  });
});
