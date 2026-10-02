// Sửa dữ liệu: khoản chi (và dòng lịch sử của nó) có `createdBy` là tài khoản
// KHÔNG xem được trip đó (không phải chủ, không phải thành viên đã gắn tài
// khoản) → gán lại cho chủ trip. Dữ liệu kiểu này chỉ sinh ra từ seed/migrate
// cũ; app hiện tại luôn ghi đúng người đang đăng nhập.
//
// Chạy: TẮT json-server trước, rồi `node scripts/fix-expense-creators.mjs`.
// Idempotent.
import { readFileSync, writeFileSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const db = JSON.parse(readFileSync(DB, 'utf8'));

const trips = new Map((db.trips ?? []).map((trip) => [trip.id, trip]));
const userName = (id) => (db.users ?? []).find((user) => user.id === id)?.fullName ?? '';
const viewers = (trip) =>
  new Set([trip.ownerId, ...trip.travelers.map((traveler) => traveler.userId)].filter(Boolean));

const fixed = new Map(); // expenseId -> ownerId
for (const expense of db.expenses ?? []) {
  const trip = trips.get(expense.tripId);
  if (!trip?.ownerId || viewers(trip).has(expense.createdBy)) continue;
  console.log(`expense ${expense.id} (${trip.name}): ${expense.createdBy} -> ${trip.ownerId}`);
  expense.createdBy = trip.ownerId;
  fixed.set(expense.id, trip.ownerId);
}

let historyFixed = 0;
for (const entry of db.expenseHistory ?? []) {
  const owner = fixed.get(entry.expenseId);
  const trip = trips.get(entry.tripId);
  const target = owner ?? (trip?.ownerId && !viewers(trip).has(entry.userId) ? trip.ownerId : null);
  if (!target || entry.userId === target) continue;
  entry.userId = target;
  entry.userName = userName(target);
  historyFixed += 1;
}

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(`expenses: ${fixed.size} sửa · expenseHistory: ${historyFixed} sửa`);
