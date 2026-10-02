// Migration một lần cho phần Chi phí (docs/features/trip-budget.md, Đợt 6).
// Chạy: node scripts/migrate-budget.mjs
//
// Idempotent: chạy nhiều lần cho cùng kết quả.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const BACKUP = new URL('../db.before-budget-migration.json', import.meta.url);

const db = JSON.parse(readFileSync(DB, 'utf8'));

if (!existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(db, null, 2) + '\n');
  console.log('backup -> db.before-budget-migration.json');
}

// Id ngắn, ổn định, không phụ thuộc crypto (script chạy một lần rồi thôi).
let seq = 0;
const nextId = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

const stat = { travelerIds: 0, currency: 0, budgetPerPerson: 0, budgetPlan: 0, spentReset: 0, movedCosts: 0, places: 0 };

db.trips = (db.trips ?? []).map((trip) => {
  const next = { ...trip };

  // --- Traveler.id: khoá ổn định cho mọi tham chiếu chia tiền (§2.3) ---
  next.travelers = (next.travelers ?? []).map((traveler) => {
    if (traveler.id) return traveler;
    stat.travelerIds += 1;
    return { id: nextId('tv_'), ...traveler };
  });

  // --- Đơn vị tiền: toàn bộ dữ liệu hiện có là JPY (D1) ---
  if (!next.currency) {
    next.currency = 'JPY';
    stat.currency += 1;
  }

  // --- Hạn mức theo đầu người: đúng một trong hai trường khác null (B6) ---
  if (next.budgetPerPerson === undefined) {
    next.budgetPerPerson = null;
    stat.budgetPerPerson += 1;
  }

  // --- budgetPlan + chuyển estimatedCost cũ thành BudgetNode (D2) ---
  if (!Array.isArray(next.budgetPlan)) {
    const plan = [];

    const collect = (items) => {
      for (const item of items ?? []) {
        if (typeof item.estimatedCost !== 'number') continue;
        plan.push({
          id: nextId('bn_'),
          parentId: null,
          // Không suy được category thật ở đây (cần join sang places), nên để
          // 'other' — user đổi lại ở Bước 4 bằng một click.
          category: 'other',
          title: item.title ?? 'Chi phí đã nhập trước đây',
          linkedItemId: item.id,
          ...(item.placeId ? { linkedPlaceId: item.placeId } : {}),
          pricingMode: 'lumpSum',
          lumpSum: item.estimatedCost,
          lumpSumSplit: 'perHead',
          quantity: 1,
          order: plan.length,
        });
        stat.movedCosts += 1;
      }
    };

    for (const day of next.days ?? []) collect(day.items);
    collect(next.unscheduledItems);

    next.budgetPlan = plan;
    stat.budgetPlan += 1;
  }

  // --- Bỏ hẳn estimatedCost khỏi item (nguồn sự thật giờ là budgetPlan) ---
  const stripItem = ({ estimatedCost, ...item }) => item;
  next.days = (next.days ?? []).map((day) => ({ ...day, items: (day.items ?? []).map(stripItem) }));
  next.unscheduledItems = (next.unscheduledItems ?? []).map(stripItem);

  // --- spent = Σ Expense (S8). Chỉ đưa về 0 khi chuyến đi CHƯA CÓ khoản chi
  // nào — lúc viết migration này thì chưa có `expenses`, nhưng script phải chạy
  // lại được sau đó mà không xoá mất số liệu thật. ---
  const spentReal = (db.expenses ?? [])
    .filter((expense) => expense.tripId === next.id && expense.kind !== 'settlement')
    .reduce((sum, expense) => sum + expense.amount, 0);
  if (next.spent !== spentReal) {
    next.spent = spentReal;
    stat.spentReset += 1;
  }

  return next;
});

// --- Đơn vị của giá tham khảo trong catalog (B4 / Q1) ---
db.places = (db.places ?? []).map((place) => {
  if (typeof place.price !== 'number' || place.priceCurrency) return place;
  stat.places += 1;
  return { ...place, priceCurrency: 'JPY' };
});

// --- Collection mới cho chi thực tế (§2.4) ---
if (!Array.isArray(db.expenses)) {
  db.expenses = [];
  console.log('thêm collection expenses: []');
}

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(
  `xong: ${stat.travelerIds} traveler.id, ${stat.currency} currency, ` +
    `${stat.budgetPlan} budgetPlan (${stat.movedCosts} khoản chuyển từ estimatedCost), ` +
    `${stat.spentReset} trip reset spent=0, ${stat.places} place gán priceCurrency, ` +
    `${stat.budgetPerPerson} trip thêm budgetPerPerson`,
);
