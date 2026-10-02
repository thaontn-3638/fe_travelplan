import { describe, expect, it } from 'vitest';
import { placeBlockReason, tripUsesPlace } from '../api/placeApi';

const trip = {
  ownerId: 'u1',
  travelers: [],
  days: [{ id: 'd1', date: '2026-10-10', items: [{ id: 'i1', kind: 'place' as const, placeId: 'p1', startTime: null, endTime: null, order: 0 }] }],
  unscheduledItems: [{ id: 'u1', kind: 'place' as const, placeId: 'p2', startTime: null, endTime: null, order: 0 }],
};

describe('Chặn xoá / chuyển riêng tư địa điểm đang được dùng', () => {
  it('tính cả mục trong ngày lẫn "Chưa xếp ngày"', () => {
    expect(tripUsesPlace(trip, 'p1')).toBe(true);
    expect(tripUsesPlace(trip, 'p2')).toBe(true);
    expect(tripUsesPlace(trip, 'p3')).toBe(false);
  });

  it('đang nằm trong trip bất kỳ → không xoá được, nhưng vẫn sửa được', () => {
    const usage = { otherSavers: 0, trips: 1, sharedTrips: 0 };
    expect(placeBlockReason(usage, 'delete')).toBe('inTrip');
    expect(placeBlockReason(usage, 'edit')).toBeNull();
    // Trip chỉ mình mình xem → chuyển riêng tư vẫn được
    expect(placeBlockReason(usage, 'makePrivate')).toBeNull();
  });

  it('nằm trong trip có người khác cùng xem → không chuyển riêng tư được', () => {
    expect(placeBlockReason({ otherSavers: 0, trips: 1, sharedTrips: 1 }, 'makePrivate')).toBe('inSharedTrip');
  });

  it('người khác đã lưu thì chặn mọi thao tác như trước', () => {
    const usage = { otherSavers: 2, trips: 0, sharedTrips: 0 };
    expect(placeBlockReason(usage, 'edit')).toBe('saved');
    expect(placeBlockReason(usage, 'delete')).toBe('saved');
    expect(placeBlockReason(usage, 'makePrivate')).toBe('saved');
  });
});
