// Migration: thêm collection `expenseHistory` (lịch sử thêm/sửa/xoá khoản chi,
// trip-budget.md §S10) và — tuỳ chọn — dựng dòng "đã thêm" cho các khoản chi
// có sẵn để màn 履歴 không trống trơn.
//
// Chạy: TẮT json-server trước, rồi
//   node scripts/migrate-expense-history.mjs            # chỉ tạo collection
//   node scripts/migrate-expense-history.mjs --backfill # + dòng "đã thêm" cho khoản chi cũ
// rồi bật lại json-server. json-server v1 giữ dữ liệu trong bộ nhớ và ghi đè
// db.json ở lần ghi kế tiếp — sửa file khi server đang chạy sẽ bị mất.
//
// Idempotent: chạy lại không tạo trùng (mỗi khoản chi tối đa một dòng backfill).
import { readFileSync, writeFileSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const db = JSON.parse(readFileSync(DB, 'utf8'));
const backfill = process.argv.includes('--backfill');

db.expenseHistory ??= [];

if (backfill) {
  const users = new Map((db.users ?? []).map((user) => [user.id, user.fullName ?? '']));
  const logged = new Set(db.expenseHistory.map((entry) => entry.expenseId));
  let added = 0;
  for (const expense of db.expenses ?? []) {
    if (logged.has(expense.id)) continue;
    const { id, tripId, createdAt, createdBy, ...rest } = expense;
    db.expenseHistory.push({
      id: `hist_${id}`,
      tripId,
      expenseId: id,
      action: 'create',
      at: createdAt,
      userId: createdBy,
      userName: users.get(createdBy) ?? '',
      after: rest,
    });
    added += 1;
  }
  console.log(`backfill: +${added} dòng`);
}

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(`expenseHistory: ${db.expenseHistory.length} dòng`);
