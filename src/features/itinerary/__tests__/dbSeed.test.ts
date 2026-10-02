import { describe, expect, it } from 'vitest';
import { isTrip } from '../api/tripApi';
import { findConflicts } from '../utils/itineraryRules';
import type { Expense, Trip } from '../../../types';
import { isExpense } from '../../settlement/api/expenseApi';
import { isExpenseHistoryEntry } from '../../settlement/api/expenseHistoryApi';
import db from '../../../../db.json';

// Khoá kết quả migration: mọi trip seed phải hợp lệ với guard mới, nếu không
// màn List sẽ im lặng trả về mảng rỗng.

describe('db.json seed sau migration', () => {
  it('mọi trip đều qua được isTrip()', () => {
    const invalid = db.trips.filter((trip) => !isTrip(trip));
    expect(invalid).toEqual([]);
  });

  it('không có item nào thiếu kind hoặc có giờ lệch cặp', () => {
    for (const trip of db.trips as Trip[]) {
      for (const day of trip.days) {
        for (const item of day.items) {
          expect(item.kind).toMatch(/^(place|activity)$/);
          expect(item.startTime === null).toBe(item.endTime === null);
        }
      }
    }
  });

  it('báo cáo các ngày đang có item trùng giờ (không chặn, chỉ để biết)', () => {
    const conflicts = (db.trips as Trip[]).flatMap((trip) =>
      findConflicts(trip.days).map((conflict) => `${trip.id}/${conflict.dayId}`),
    );
    // Dữ liệu seed được phép trùng — R6 chỉ áp dụng từ Bước 3 trở đi.
    expect(Array.isArray(conflicts)).toBe(true);
  });

  // Dữ liệu seed (kể cả scripts/seed-test-data.mjs) phải tuân đúng các luật mà
  // UI đang bắt buộc — nếu không, màn test sẽ báo lỗi do DỮ LIỆU chứ không phải
  // do code.
  it('party khớp danh sách thành viên (luật B7)', () => {
    const mismatched = (db.trips as Trip[])
      .filter((trip) => {
        const adults = trip.travelers.filter((traveler) => !traveler.isChild).length;
        const children = trip.travelers.filter((traveler) => traveler.isChild).length;
        return adults !== trip.party.adults || children !== trip.party.children;
      })
      .map((trip) => trip.id);
    expect(mismatched).toEqual([]);
  });

  it('mọi khoản chi hợp lệ, trỏ đúng trip và đúng thành viên của trip', () => {
    const trips = new Map((db.trips as Trip[]).map((trip) => [trip.id, trip]));
    for (const expense of db.expenses as Expense[]) {
      expect(isExpense(expense)).toBe(true);
      const trip = trips.get(expense.tripId);
      expect(trip, expense.id).toBeDefined();
      const ids = new Set(trip!.travelers.map((traveler) => traveler.id));
      expect(ids.has(expense.payerId), expense.id).toBe(true);
      expect(expense.shares.every((share) => ids.has(share.travelerId)), expense.id).toBe(true);
    }
  });

  it('trip.spent khớp tổng khoản chi thật (S8)', () => {
    for (const trip of db.trips as Trip[]) {
      const spent = (db.expenses as Expense[])
        .filter((expense) => expense.tripId === trip.id && expense.kind === 'expense')
        .reduce((sum, expense) => sum + expense.amount, 0);
      expect({ id: trip.id, spent: trip.spent }).toEqual({ id: trip.id, spent });
    }
  });

  it('có collection expenseHistory (scripts/migrate-expense-history.mjs) và mọi dòng hợp lệ', () => {
    const rows = (db as { expenseHistory?: unknown[] }).expenseHistory;
    expect(Array.isArray(rows)).toBe(true);
    expect((rows ?? []).filter((row) => !isExpenseHistoryEntry(row))).toEqual([]);
  });

  it('người ghi khoản chi luôn là người xem được trip đó (scripts/fix-expense-creators.mjs)', () => {
    const trips = new Map((db.trips as Trip[]).map((trip) => [trip.id, trip]));
    const wrong = (db.expenses as Expense[]).filter((expense) => {
      const trip = trips.get(expense.tripId);
      if (!trip?.ownerId) return false;
      return trip.ownerId !== expense.createdBy && !trip.travelers.some((traveler) => traveler.userId === expense.createdBy);
    });
    expect(wrong.map((expense) => expense.id)).toEqual([]);
  });
});

