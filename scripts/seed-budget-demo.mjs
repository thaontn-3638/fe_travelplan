// Seed dữ liệu DEMO cho Bước 4 (Dự trù chi phí) — chỉ để kiểm tra giao diện.
// Chạy: node scripts/seed-budget-demo.mjs   |   hoàn tác: --reset
//
// An toàn: chỉ đụng 2 trip demo, và chỉ khi budgetPlan của chúng đang rỗng.
// Không chạm tới days/items — lịch trình giữ nguyên tuyệt đối.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const BACKUP = new URL('../db.before-budget-demo.json', import.meta.url);
const reset = process.argv.includes('--reset');

const db = JSON.parse(readFileSync(DB, 'utf8'));
if (!existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(db, null, 2) + '\n');
  console.log('backup -> db.before-budget-demo.json');
}

const DEMO = ['t1', 'aKNkoi7R0Qs'];
let seq = 0;
const id = () => `bn_demo${(seq++).toString(36)}`;

const node = (o) => ({
  parentId: null,
  pricingMode: 'lumpSum',
  quantity: 1,
  order: 0,
  lumpSumSplit: 'perHead',
  ...o,
});

// t1 "Kyoto 3-Day Trip": cây 3 mức + khoản gắn lịch trình + khoản tự do.
const PLAN_T1 = [
  node({ id: 'bn_demo_air', category: 'transport', title: 'Vé máy bay khứ hồi', pricingMode: 'perPerson', unitAdult: 42000, unitChild: 32000 }),
  node({ id: 'bn_demo_jr', category: 'transport', title: 'JR Pass 7 ngày', lumpSum: 50000, lumpSumSplit: 'adultsOnly', order: 1 }),
  node({ id: 'bn_demo_hotel', category: 'lodging', title: 'Hotel Granvia Kyoto' }),
  node({ id: 'bn_demo_room', parentId: 'bn_demo_hotel', category: 'lodging', title: 'Phòng twin × 2', lumpSum: 24000, quantity: 3 }),
  node({ id: 'bn_demo_tax', parentId: 'bn_demo_hotel', category: 'lodging', title: 'Thuế lưu trú', pricingMode: 'perPerson', unitAdult: 200, unitChild: 0, quantity: 3, order: 1 }),
  node({ id: 'bn_demo_meal', category: 'food', title: 'Ăn uống hằng ngày', pricingMode: 'perPerson', unitAdult: 4000, unitChild: 2000, quantity: 3 }),
  // Gắn với đúng mục lịch trình đang có -> hiện chip "Ngày 1" và vào bảng theo ngày
  node({ id: 'bn_demo_kinkaku', category: 'sightseeing', title: 'Vé Kinkaku-ji', linkedItemId: 't1d2i1', linkedPlaceId: 'p1', pricingMode: 'perPerson', unitAdult: 500, unitChild: 300 }),
  node({ id: 'bn_demo_gift', category: 'other', title: 'Quà + sim + bảo hiểm', lumpSum: 18000, order: 1 }),
];

// aKNkoi7R0Qs: cây phẳng, ít khoản, để so sánh một trip "nhẹ".
const PLAN_HOK = [
  node({ id: 'bn_demo_ski', category: 'sightseeing', title: 'Vé trượt tuyết 2 ngày', pricingMode: 'perPerson', unitAdult: 12000, unitChild: 6000, quantity: 2 }),
  node({ id: 'bn_demo_lodge', category: 'lodging', title: 'Niseko Ski Resort', linkedItemId: '80a70edf-d25', pricingMode: 'perPerson', unitAdult: 18000, unitChild: 9000, quantity: 2, order: 1 }),
  node({ id: 'bn_demo_bus', category: 'transport', title: 'Xe buýt sân bay', lumpSum: 8000, order: 2 }),
];

for (const trip of db.trips) {
  if (!DEMO.includes(trip.id)) continue;

  if (reset) {
    trip.budgetPlan = [];
    trip.travelers = trip.travelers.filter((t) => !t.id.startsWith('tv_demo'));
    if (trip.id === 't1') trip.party = { adults: 5, children: 0 };
    trip.budgetPerPerson = null;
    if (trip.id === 'aKNkoi7R0Qs') trip.party = { adults: 2, children: 0 };
    trip.budget = trip.id === 't1' ? 120000 : null;
    console.log(`reset ${trip.id}`);
    continue;
  }

  if (Array.isArray(trip.budgetPlan) && trip.budgetPlan.length > 0) {
    console.log(`bỏ qua ${trip.id}: đã có ${trip.budgetPlan.length} khoản, không ghi đè`);
    continue;
  }

  if (trip.id === 't1') {
    trip.budgetPlan = PLAN_T1;
    // Đặt hạn mức theo ĐẦU NGƯỜI để demo đúng tính năng B6: ¥70.000 × 5 người.
    trip.budget = null;
    trip.budgetPerPerson = 70000;
    // Có trẻ em thì cột "Trẻ em" và cảnh báo B7 mới xuất hiện để kiểm tra.
    trip.party = { adults: 2, children: 2 };
    trip.travelers = [
      ...trip.travelers.slice(0, 2),
      { id: 'tv_demo_kid1', fullName: 'Bi', initials: 'B', colorClass: 'bg-mint', isChild: true },
    ];
  } else {
    trip.budgetPlan = PLAN_HOK;
    trip.budget = 90000;
    trip.party = { adults: 2, children: 1 };
  }
  console.log(`seed ${trip.id}: ${trip.budgetPlan.length} khoản chi phí`);
}

// --- Thành viên có tên + chi tiêu thực tế cho t1 --------------------------
// Bộ số này chính là fixture đã chốt ở trip-budget.md §9.3 (đã kiểm bằng test):
// tổng ¥182.400, 4 người lớn + 1 trẻ, có một khoản nhập riêng và một khoản chỉ
// chi cho trẻ em.
const TEAM = [
  { id: 'tv_demo_minh', fullName: 'Minh', initials: 'M', colorClass: 'bg-ocean' },
  { id: 'tv_demo_lan', fullName: 'Lan', initials: 'L', colorClass: 'bg-coral' },
  { id: 'tv_demo_hung', fullName: 'Hùng', initials: 'H', colorClass: 'bg-mint' },
  { id: 'tv_demo_ban', fullName: 'Thảo', initials: 'T', colorClass: 'bg-violet' },
  { id: 'tv_demo_bi', fullName: 'Bi', initials: 'B', colorClass: 'bg-amber-dark', isChild: true, guardianId: 'tv_demo_lan' },
];
const ALL = TEAM.map((t) => t.id);
const ex = (o) => ({
  tripId: 't1',
  kind: 'expense',
  splitMode: 'equal',
  shares: ALL.map((id) => ({ travelerId: id })),
  createdAt: '2026-09-20T02:00:00.000Z',
  createdBy: 'nb3fbQt2Mhk',
  ...o,
});

const DEMO_EXPENSES = [
  ex({ id: 'ex_demo1', date: '2026-09-20', category: 'lodging', title: 'Khách sạn 3 đêm', amount: 97200, payerId: 'tv_demo_minh' }),
  ex({
    id: 'ex_demo2', date: '2026-09-20', category: 'food', title: 'Ăn tối izakaya', amount: 12000,
    payerId: 'tv_demo_ban', splitMode: 'exact',
    shares: [
      { travelerId: 'tv_demo_minh', amount: 3500 },
      { travelerId: 'tv_demo_lan', amount: 2500 },
      { travelerId: 'tv_demo_hung', amount: 3000 },
      { travelerId: 'tv_demo_ban', amount: 2000 },
      { travelerId: 'tv_demo_bi', amount: 1000 },
    ],
  }),
  ex({ id: 'ex_demo3', date: '2026-09-21', category: 'transport', title: 'Vé tàu Shinkansen', amount: 46500, payerId: 'tv_demo_hung' }),
  ex({ id: 'ex_demo4', date: '2026-09-21', category: 'sightseeing', title: 'Vé vào cửa trẻ em', amount: 2000, payerId: 'tv_demo_lan', shares: [{ travelerId: 'tv_demo_bi' }] }),
  ex({ id: 'ex_demo5', date: '2026-09-21', category: 'food', title: 'Ăn trưa', amount: 24700, payerId: 'tv_demo_lan' }),
];

const t1 = db.trips.find((trip) => trip.id === 't1');
if (reset) {
  db.expenses = (db.expenses ?? []).filter((e) => !e.id.startsWith('ex_demo'));
  if (t1) t1.spent = 0;
  console.log('gỡ chi tiêu demo');
} else if (t1 && !(db.expenses ?? []).some((e) => e.id.startsWith('ex_demo'))) {
  t1.travelers = TEAM;
  t1.party = { adults: 4, children: 1 };
  t1.status = 'settling';
  db.expenses = [...(db.expenses ?? []), ...DEMO_EXPENSES];
  t1.spent = DEMO_EXPENSES.reduce((sum, e) => sum + e.amount, 0);
  console.log(`seed ${DEMO_EXPENSES.length} khoản chi thực tế cho t1 (tổng ¥${t1.spent.toLocaleString()})`);
}

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(reset ? 'đã hoàn tác seed demo' : 'xong');
