import { describe, expect, it } from 'vitest';
import { canManageTrip, canViewTrip, travelerOfUser } from '../utils/tripAccess';
import type { Traveler } from '../../../types';

const named = (id: string, userId?: string): Traveler => ({ id, userId, initials: id, colorClass: 'bg-ocean' });

describe('canViewTrip', () => {
  it('chủ trip thấy trip của mình', () => {
    expect(canViewTrip({ ownerId: 'u1', travelers: [] }, 'u1')).toBe(true);
  });

  it('thành viên đã gắn tài khoản cũng thấy', () => {
    expect(canViewTrip({ ownerId: 'u1', travelers: [named('a', 'u2')] }, 'u2')).toBe(true);
  });

  it('tài khoản khác không thấy, kể cả khi trip chưa có chủ', () => {
    expect(canViewTrip({ ownerId: 'u1', travelers: [named('a')] }, 'u2')).toBe(false);
    expect(canViewTrip({ travelers: [named('a')] }, 'u2')).toBe(false);
    expect(canViewTrip({ ownerId: 'u1', travelers: [] }, '')).toBe(false);
  });

  it('tìm đúng thành viên của tài khoản', () => {
    const trip = { travelers: [named('a'), named('b', 'u2')] };
    expect(travelerOfUser(trip, 'u2')?.id).toBe('b');
    expect(travelerOfUser(trip, 'u3')).toBeUndefined();
  });
});

describe('canManageTrip', () => {
  it('chỉ chủ trip quản lý được (xoá trip, xoá thành viên, chia sẻ)', () => {
    expect(canManageTrip({ ownerId: 'u1' }, 'u1')).toBe(true);
    expect(canManageTrip({ ownerId: 'u1' }, 'u2')).toBe(false);
    expect(canManageTrip({ ownerId: 'u1' }, '')).toBe(false);
  });

  it('trip cũ chưa có chủ: ai xem được thì quản lý được', () => {
    expect(canManageTrip({}, 'u2')).toBe(true);
  });
});
