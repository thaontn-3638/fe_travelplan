import { describe, expect, it } from 'vitest';
import type { Traveler } from '../../../types';
import { partyFromTravelers, validateBasics, type TripBasics } from '../utils/tripBasics';

const t = (key: string): string => key;

const adult = (id: string, extra: Partial<Traveler> = {}): Traveler => ({
  id,
  fullName: id,
  initials: id,
  colorClass: 'bg-ocean',
  ...extra,
});

function basics(overrides: Partial<TripBasics> = {}): TripBasics {
  return {
    name: 'Kyoto',
    regions: [{ id: 'r1', name: 'Kyoto' }],
    startDate: '2099-01-01',
    endDate: '2099-01-03',
    party: { adults: 2, children: 1 },
    travelers: [adult('a'), adult('b'), adult('c', { isChild: true })],
    status: 'planning',
    ...overrides,
  };
}

describe('Bước 1 — số người phải khớp danh sách thành viên', () => {
  it('khớp thì lưu được', () => {
    const result = validateBasics(basics(), t);
    expect(result.partyError).toBeNull();
    expect(result.canSubmit).toBe(true);
  });

  it('lệch số người lớn thì chặn lưu và gợi ý đúng con số để sửa nhanh', () => {
    const result = validateBasics(basics({ party: { adults: 4, children: 1 } }), t);
    expect(result.partyError).toBe('itinerary.stepOne.partyMismatch');
    expect(result.canSubmit).toBe(false);
    expect(result.partySuggestion).toEqual({ adults: 2, children: 1 });
  });

  it('lệch số trẻ em cũng chặn', () => {
    const result = validateBasics(basics({ party: { adults: 2, children: 0 } }), t);
    expect(result.canSubmit).toBe(false);
  });

  it('thành viên đã rời nhóm vẫn được tính', () => {
    const travelers = [adult('a'), adult('b', { leftGroup: true }), adult('c', { isChild: true })];
    expect(partyFromTravelers(travelers)).toEqual({ adults: 2, children: 1 });
    expect(validateBasics(basics({ travelers }), t).partyError).toBeNull();
  });

  it('chưa có người lớn nào thì báo riêng và không có nút sửa nhanh', () => {
    const result = validateBasics(
      basics({ travelers: [adult('c', { isChild: true })], party: { adults: 1, children: 1 } }),
      t,
    );
    expect(result.partyError).toBe('itinerary.stepOne.partyNeedAdult');
    expect(result.partySuggestion).toBeNull();
  });
});
