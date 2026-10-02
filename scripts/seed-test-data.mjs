// Seed dữ liệu TEST: thêm region, place, trip (đủ plan + chi tiêu) để kiểm tra
// càng nhiều trường hợp và màn hình càng tốt.
//
//   node scripts/seed-test-data.mjs           thêm / làm mới dữ liệu test
//   node scripts/seed-test-data.mjs --reset   gỡ toàn bộ dữ liệu test
//
// TẮT json-server trước khi chạy (nó giữ db trong bộ nhớ và sẽ ghi đè lại).
//
// - Mọi bản ghi do script này tạo đều có id bắt đầu bằng `seed_`. Chạy lại là
//   gỡ hết bản cũ rồi tạo lại, nên chạy bao nhiêu lần cũng ra cùng một bộ dữ
//   liệu — KHÔNG đụng tới dữ liệu khác.
// - Ngày tháng tính TƯƠNG ĐỐI theo hôm nay (giờ máy), nên các ca "đang đi",
//   "sắp đi 2 ngày nữa", "đã về mà quên đổi status"... luôn đúng mỗi lần chạy.
// - Ảnh địa điểm lấy lại từ ảnh thật (Wikimedia) của các place catalog SẴN CÓ
//   trong db: ưu tiên cùng thành phố + cùng loại, không có thì cùng loại. Với
//   thành phố mới (Kanazawa, Hakone...) ảnh vì vậy KHÔNG đúng địa điểm — chỉ để
//   UI có ảnh thật mà test.
//
// Danh sách ca test: xem bảng CASES ở cuối file (cũng được in ra khi chạy).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const BACKUP = new URL('../db.before-seed-test-data.json', import.meta.url);
// Bản cũ của script sinh ảnh SVG vào đây — giờ không dùng nữa, dọn đi.
const LEGACY_IMG_DIR = new URL('../public/seed/', import.meta.url);
const reset = process.argv.includes('--reset');

const db = JSON.parse(readFileSync(DB, 'utf8'));
if (!existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(db, null, 2) + '\n');
  console.log('backup -> db.before-seed-test-data.json');
}

// ---------------------------------------------------------------------------
// Gỡ bản seed cũ
// ---------------------------------------------------------------------------
const isSeed = (record) => typeof record?.id === 'string' && record.id.startsWith('seed_');
for (const key of ['regions', 'places', 'trips', 'expenses', 'savedPlaces', 'expenseHistory']) {
  db[key] = (db[key] ?? []).filter((record) => !isSeed(record));
}
if (existsSync(LEGACY_IMG_DIR)) {
  rmSync(LEGACY_IMG_DIR, { recursive: true, force: true });
  console.log('đã xoá ảnh SVG seed cũ ở public/seed/');
}

if (reset) {
  writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
  console.log('Đã gỡ toàn bộ dữ liệu seed_.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Tiện ích
// ---------------------------------------------------------------------------
const ME = 'nb3fbQt2Mhk'; // thao@gmail.com — tài khoản test chính
const OTHER = '9cCnRJ9YEqc'; // thao2@gmail.com
const KENJI = 'u1'; // kenji@gmail.com (trước đây là tài khoản admin)

const pad = (n) => String(n).padStart(2, '0');
const toISODate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = new Date();
TODAY.setHours(12, 0, 0, 0);
// d(0) = hôm nay, d(-3) = 3 ngày trước, d(10) = 10 ngày nữa
const d = (offset) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + offset);
  return toISODate(date);
};
const isoAt = (offset, hour = 10) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + offset);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const COLORS = ['bg-ocean', 'bg-coral', 'bg-mint', 'bg-violet', 'bg-amber-dark', 'bg-navy'];
const initialsOf = (name) => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
};
let colorSeq = 0;
const tv = (id, fullName, extra = {}) => ({
  id,
  fullName,
  initials: initialsOf(fullName),
  colorClass: COLORS[colorSeq++ % COLORS.length],
  ...extra,
});

// Một mục lịch trình. `at` = ['09:00', '11:00'] hoặc null (chưa gán giờ).
const place = (id, placeId, at = null, extra = {}) => ({
  id,
  kind: 'place',
  placeId,
  startTime: at ? at[0] : null,
  endTime: at ? at[1] : null,
  order: 0,
  ...extra,
});
const act = (id, title, category, at = null, extra = {}) => ({
  id,
  kind: 'activity',
  title,
  category,
  startTime: at ? at[0] : null,
  endTime: at ? at[1] : null,
  order: 0,
  ...extra,
});

// Dựng `days` từ ngày đi + danh sách item theo từng ngày.
function buildDays(tripId, start, itemsByDay) {
  const base = new Date(`${start}T12:00:00`);
  return itemsByDay.map((items, index) => {
    const date = new Date(base);
    date.setDate(base.getDate() + index);
    return {
      id: `${tripId}_d${index + 1}`,
      date: toISODate(date),
      items: items.map((item, order) => ({ ...item, order })),
    };
  });
}

const node = (o) => ({ parentId: null, pricingMode: 'lumpSum', quantity: 1, order: 0, ...o });

function trip(o) {
  const startDate = o.startDate;
  const endDate = o.endDate ?? null;
  const travelers = o.travelers;
  return {
    id: o.id,
    ownerId: o.ownerId ?? ME,
    name: o.name,
    regions: o.regions,
    startDate,
    endDate,
    status: o.status,
    travelers,
    // party luôn khớp danh sách thành viên (luật B7 mới, kể cả người đã rời nhóm)
    party: {
      adults: travelers.filter((t) => !t.isChild).length,
      children: travelers.filter((t) => t.isChild).length,
    },
    currency: o.currency ?? 'JPY',
    budget: o.budget ?? null,
    budgetPerPerson: o.budgetPerPerson ?? null,
    spent: 0, // tính lại ở cuối từ các khoản chi
    budgetPlan: o.budgetPlan ?? [],
    ...(o.treasurerId ? { treasurerId: o.treasurerId } : {}),
    days: o.days ?? [],
    unscheduledItems: o.unscheduledItems ?? [],
    updatedAt: o.updatedAt ?? isoAt(-1),
  };
}

let exSeq = 0;
// Khoản chi. `shares`: mảng travelerId (chia đều) hoặc { id: amount } (nhập riêng).
function expense(tripId, o) {
  const exact = o.shares && !Array.isArray(o.shares);
  return {
    id: `seed_ex_${tripId.replace('seed_', '')}_${(exSeq++).toString().padStart(3, '0')}`,
    tripId,
    kind: o.kind ?? 'expense',
    date: o.date,
    category: o.category ?? 'other',
    ...(o.budgetNodeId ? { budgetNodeId: o.budgetNodeId } : {}),
    title: o.title,
    ...(o.note ? { note: o.note } : {}),
    amount: o.amount,
    payerId: o.payer,
    splitMode: exact ? 'exact' : 'equal',
    shares: exact
      ? Object.entries(o.shares).map(([travelerId, amount]) => ({ travelerId, amount }))
      : o.shares.map((travelerId) => ({ travelerId })),
    createdAt: o.createdAt ?? `${o.date}T03:00:00.000Z`,
    createdBy: o.createdBy ?? ME,
  };
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------
const REGIONS = [
  { id: 'seed_r_kanazawa', name: 'Kanazawa', country: 'Japan', aliases: ['金沢'] },
  { id: 'seed_r_hakone', name: 'Hakone', country: 'Japan', aliases: ['箱根'] },
  { id: 'seed_r_hiroshima', name: 'Hiroshima', country: 'Japan', aliases: ['広島', '宮島'] },
  { id: 'seed_r_fukuoka', name: 'Fukuoka', country: 'Japan', aliases: ['福岡', '博多'] },
  { id: 'seed_r_nara', name: 'Nara', country: 'Japan', aliases: ['奈良'] },
  { id: 'seed_r_busan', name: 'Busan', country: 'South Korea', aliases: ['부산', '釜山'] },
  { id: 'seed_r_honolulu', name: 'Honolulu', country: 'USA', aliases: ['Hawaii', 'ホノルル'] },
].map((region) => ({ ...region, source: 'catalog' }));

// Region tự tạo: một của tôi (thấy được), một của người khác (không thấy).
REGIONS.push(
  { id: 'seed_r_custom_me', name: 'Shirakawa-go', country: 'Japan', aliases: ['白川郷'], source: 'custom', createdBy: ME },
  { id: 'seed_r_custom_other', name: 'Private Island X', country: 'Japan', source: 'custom', createdBy: OTHER },
);
db.regions.push(...REGIONS);

const regionRef = (id) => {
  const region = [...db.regions].find((r) => r.id === id);
  return { id: region.id, name: region.name, country: region.country };
};

// ---------------------------------------------------------------------------
// Places (ảnh dùng lại từ catalog sẵn có)
// ---------------------------------------------------------------------------
// Kho ảnh = ảnh thật của place catalog sẵn có (không phải seed_), theo vùng + loại.
const PHOTO_POOL = db.places
  .filter((p) => !isSeed(p) && p.source === 'catalog' && /^https?:\/\//.test(p.coverUrl ?? ''))
  .map((p) => ({
    region: p.region,
    category: p.category ?? 'attraction',
    images: [...new Set([p.coverUrl, ...(p.images ?? [])].filter((url) => /^https?:\/\//.test(url)))],
  }));
if (PHOTO_POOL.length === 0) {
  console.error('Không tìm thấy place catalog nào có ảnh http(s) để dùng lại.');
  process.exit(1);
}

// Thành phố mới chưa có ảnh → mượn ảnh của thành phố "gần giống" nhất cho đỡ
// lệch (đền chùa Kanazawa/Nara mượn Kyoto, biển Honolulu mượn Okinawa...).
const LOOKS_LIKE = {
  Kanazawa: 'Kyoto',
  Nara: 'Kyoto',
  Hiroshima: 'Kyoto',
  Hakone: 'Hokkaido',
  Fukuoka: 'Osaka',
  Busan: 'Seoul',
  Honolulu: 'Okinawa',
};

let photoSeq = 0;
// Chọn 1–2 ảnh: cùng vùng + cùng loại → vùng "gần giống" + cùng loại → cùng
// loại → bất kỳ. Xoay vòng để các place cùng loại không dùng chung một tấm.
function pickPhotos(region, category, count) {
  const wanted = category === 'other' ? 'attraction' : category;
  const tiers = [
    PHOTO_POOL.filter((p) => p.region === region && p.category === wanted),
    PHOTO_POOL.filter((p) => p.region === LOOKS_LIKE[region] && p.category === wanted),
    PHOTO_POOL.filter((p) => p.category === wanted),
    PHOTO_POOL,
  ];
  const pool = tiers.find((tier) => tier.length > 0);
  const urls = pool.flatMap((p) => p.images);
  const start = photoSeq++ % urls.length;
  return Array.from({ length: Math.min(count, urls.length) }, (_, i) => urls[(start + i) % urls.length]);
}

// [id, title, region, category, price, priceUnit, rating, aliases?, extra?]
const PLACE_ROWS = [
  // Kanazawa
  ['kenrokuen', 'Kenroku-en Garden', 'Kanazawa', 'attraction', 320, 'perPerson', 4.7, ['兼六園']],
  ['higashi', 'Higashi Chaya District', 'Kanazawa', 'attraction', 0, undefined, 4.5, ['ひがし茶屋街']],
  ['omicho', 'Omicho Market', 'Kanazawa', 'restaurant', 3000, 'perPerson', 4.4, ['近江町市場']],
  ['hyatt_kz', 'Hyatt Centric Kanazawa', 'Kanazawa', 'hotel', 28000, 'perNight', 4.6],
  ['21c', '21st Century Museum', 'Kanazawa', 'attraction', 1400, 'perPerson', 4.3, ['21世紀美術館']],
  // Hakone
  ['owakudani', 'Owakudani Valley', 'Hakone', 'attraction', 0, undefined, 4.4, ['大涌谷']],
  ['ropeway', 'Hakone Ropeway', 'Hakone', 'attraction', 2500, 'perPerson', 4.2, ['箱根ロープウェイ']],
  ['gora_kadan', 'Gora Kadan Ryokan', 'Hakone', 'hotel', 120000, 'perNight', 4.9, ['強羅花壇']],
  ['soba_hakone', 'Hatsuhana Soba', 'Hakone', 'restaurant', 1500, 'perPerson', 4.3, ['はつ花']],
  // Hiroshima
  ['peace_park', 'Peace Memorial Park', 'Hiroshima', 'attraction', 0, undefined, 4.8, ['平和記念公園']],
  ['itsukushima', 'Itsukushima Shrine', 'Hiroshima', 'attraction', 300, 'perPerson', 4.8, ['厳島神社', '宮島']],
  ['okonomi', 'Okonomimura', 'Hiroshima', 'restaurant', 1200, 'perPerson', 4.2, ['お好み村']],
  ['sheraton_hr', 'Sheraton Grand Hiroshima', 'Hiroshima', 'hotel', 22000, 'perNight', 4.5],
  // Fukuoka
  ['yatai', 'Nakasu Yatai Stalls', 'Fukuoka', 'restaurant', 2500, 'perPerson', 4.3, ['中洲屋台']],
  ['ichiran', 'Ichiran Ramen Main Store', 'Fukuoka', 'restaurant', 1180, 'perPerson', 4.4, ['一蘭']],
  ['dazaifu', 'Dazaifu Tenmangu', 'Fukuoka', 'attraction', 0, undefined, 4.6, ['太宰府天満宮']],
  ['canal_city', 'Canal City Hakata', 'Fukuoka', 'shopping', 0, undefined, 4.1, ['キャナルシティ博多']],
  ['hotel_fk', 'Hotel Il Palazzo', 'Fukuoka', 'hotel', 16000, 'perNight', 4.2],
  // Nara
  ['nara_park', 'Nara Park', 'Nara', 'attraction', 0, undefined, 4.7, ['奈良公園']],
  ['todaiji', 'Todai-ji Temple', 'Nara', 'attraction', 800, 'perPerson', 4.8, ['東大寺']],
  ['kakinoha', 'Hiraso Kakinoha-zushi', 'Nara', 'restaurant', 1600, 'perPerson', 4.1, ['柿の葉寿司']],
  // Busan (giá để JPY)
  ['haeundae', 'Haeundae Beach', 'Busan', 'attraction', 0, undefined, 4.5, ['해운대']],
  ['gamcheon', 'Gamcheon Culture Village', 'Busan', 'attraction', 0, undefined, 4.4, ['감천문화마을']],
  ['jagalchi', 'Jagalchi Fish Market', 'Busan', 'restaurant', 3500, 'perPerson', 4.2, ['자갈치시장']],
  // Honolulu (USD — giá lưu theo cent)
  ['waikiki', 'Waikiki Beach', 'Honolulu', 'attraction', 0, undefined, 4.6, [], { priceCurrency: 'USD' }],
  ['diamond_head', 'Diamond Head Trail', 'Honolulu', 'attraction', 500, 'perPerson', 4.7, [], { priceCurrency: 'USD' }],
  ['pearl_harbor', 'Pearl Harbor Memorial', 'Honolulu', 'attraction', 0, undefined, 4.8, [], { priceCurrency: 'USD' }],
  ['poke_bar', 'Ono Seafood Poke', 'Honolulu', 'restaurant', 1800, 'perPerson', 4.6, [], { priceCurrency: 'USD' }],
  ['halekulani', 'Halekulani Hotel', 'Honolulu', 'hotel', 65000, 'perNight', 4.8, [], { priceCurrency: 'USD' }],
  ['ala_moana', 'Ala Moana Center', 'Honolulu', 'shopping', 0, undefined, 4.4, [], { priceCurrency: 'USD' }],
  // Bổ sung cho Tokyo/Kyoto/Osaka sẵn có: khách sạn & chỗ mua sắm (catalog cũ thiếu)
  ['park_hyatt', 'Park Hyatt Tokyo', 'Tokyo', 'hotel', 85000, 'perNight', 4.7],
  ['ginza_six', 'GINZA SIX', 'Tokyo', 'shopping', 0, undefined, 4.3],
  ['nishiki_inn', 'Kyoto Machiya Inn', 'Kyoto', 'hotel', 32000, 'perNight', 4.6, ['町家の宿']],
  ['kuromon', 'Kuromon Market', 'Osaka', 'restaurant', 2500, 'perPerson', 4.2, ['黒門市場']],
];

const COUNTRY_OF = Object.fromEntries(
  [...db.regions].map((region) => [region.name, region.country]),
);

const PLACES = PLACE_ROWS.map(([key, title, region, category, price, priceUnit, rating, aliases = [], extra = {}], index) => {
  const id = `seed_p_${key}`;
  // Một nửa số place có 2 ảnh để test carousel.
  const images = pickPhotos(region, category, index % 2 === 0 ? 2 : 1);
  const cover = images[0];
  return {
    id,
    title,
    coverUrl: cover,
    ...(price !== undefined ? { price } : {}),
    priceCurrency: extra.priceCurrency ?? 'JPY',
    ...(priceUnit ? { priceUnit } : {}),
    rating,
    address: `${title}, ${region}, ${COUNTRY_OF[region] ?? ''}`.replace(/, $/, ''),
    region,
    country: COUNTRY_OF[region],
    category,
    description: `${title} — dữ liệu test (seed) cho khu vực ${region}.`,
    images,
    ...(aliases.length > 0 ? { aliases } : {}),
    source: 'catalog',
    savedCount: (index * 7) % 40,
  };
});

// Place tự tạo: của tôi (riêng tư, chưa có rating), của người khác công khai,
// và của người khác riêng tư (KHÔNG được thấy).
const customPlace = (key, title, region, createdBy, isPublic, extra = {}) => {
  const id = `seed_p_${key}`;
  const images = pickPhotos(region, 'attraction', 1);
  return {
    id,
    title,
    coverUrl: images[0],
    address: `${region}`,
    region,
    country: 'Japan',
    category: 'other',
    source: 'custom',
    isPublic,
    createdBy,
    createdAt: isoAt(-30),
    savedCount: 0,
    images,
    ...extra,
  };
};
PLACES.push(
  customPlace('custom_mine', 'Quán cà phê nhà bác Tanaka', 'Kanazawa', ME, false, { description: 'Place tự tạo, riêng tư, chưa có đánh giá.' }),
  customPlace('custom_public', 'Onsen bí mật ở Hakone', 'Hakone', OTHER, true, { rating: 4.0 }),
  customPlace('custom_private_other', 'Nhà riêng của Thao Nguyen', 'Tokyo', OTHER, false),
);
db.places.push(...PLACES);

db.savedPlaces.push(
  ...['kenrokuen', 'gora_kadan', 'itsukushima', 'yatai', 'diamond_head', 'custom_mine'].map((key, index) => ({
    id: `seed_sp_${key}`,
    userId: ME,
    placeId: `seed_p_${key}`,
    addedAt: isoAt(-20 + index),
  })),
);

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------
const TRIPS = [];
const EXPENSES = [];

// S1 — Sắp đi 2 ngày nữa, plan 4/4, gia đình có trẻ em, hạn mức theo đầu người,
//      cây dự trù 3 mức, có memo. → trip nổi bật + đếm ngược ở Dashboard.
{
  const id = 'seed_t_kanazawa';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const an = tv(`${id}_an`, 'Trần An');
  const bi = tv(`${id}_bi`, 'Bé Bi', { isChild: true, guardianId: me.id });
  const start = d(2);
  const days = buildDays(id, start, [
    [
      act(`${id}_i1`, 'Shinkansen Tokyo → Kanazawa', 'other', ['08:00', '10:30'], { note: 'Kagayaki 505, toa 7, ghế 3A–3C' }),
      place(`${id}_i2`, 'seed_p_omicho', ['11:00', '12:30'], { note: 'Ăn kaisendon, nhớ mang tiền mặt' }),
      place(`${id}_i3`, 'seed_p_kenrokuen', ['13:30', '15:30']),
      place(`${id}_i4`, 'seed_p_hyatt_kz', ['17:00', '18:00'], { note: 'Check-in sau 15:00' }),
    ],
    [
      place(`${id}_i5`, 'seed_p_21c', ['09:30', '11:30']),
      place(`${id}_i6`, 'seed_p_higashi', ['13:00', '15:00'], { note: 'Thử kem lá vàng' }),
      place(`${id}_i7`, 'seed_p_custom_mine', ['15:30', '16:30']),
    ],
    [
      act(`${id}_i8`, 'Xe buýt sang Hakone', 'other', ['08:00', '12:00']),
      place(`${id}_i9`, 'seed_p_owakudani', ['13:00', '14:30'], { note: 'Trứng đen kuro-tamago' }),
      place(`${id}_i10`, 'seed_p_gora_kadan', ['16:00', '17:00']),
    ],
    [
      place(`${id}_i11`, 'seed_p_ropeway', ['09:00', '10:30']),
      place(`${id}_i12`, 'seed_p_soba_hakone', ['11:30', '12:30']),
      act(`${id}_i13`, 'Về Tokyo', 'other', ['14:00', '16:00']),
    ],
  ]);
  TRIPS.push(
    trip({
      id,
      name: '金沢・箱根 家族旅行',
      regions: [regionRef('seed_r_kanazawa'), regionRef('seed_r_hakone')],
      startDate: start,
      endDate: d(5),
      status: 'confirmed',
      travelers: [me, an, bi],
      budgetPerPerson: 90000,
      days,
      budgetPlan: [
        node({ id: 'seed_bn_kz_shin', category: 'transport', title: 'Shinkansen khứ hồi', pricingMode: 'perPerson', unitAdult: 14000, unitChild: 7000, quantity: 2, linkedItemId: `${id}_i1`, linkedItemTitle: 'Shinkansen Tokyo → Kanazawa' }),
        node({ id: 'seed_bn_kz_bus', category: 'transport', title: 'Xe buýt Kanazawa → Hakone', lumpSum: 12000, lumpSumSplit: 'adultsOnly', order: 1, linkedItemId: `${id}_i8`, linkedItemTitle: 'Xe buýt sang Hakone' }),
        // Cây 3 mức: Lưu trú → Kanazawa → (phòng, thuế)
        node({ id: 'seed_bn_kz_lodge', category: 'lodging', title: 'Lưu trú', note: 'Tổng cả 3 đêm' }),
        node({ id: 'seed_bn_kz_lodge_kz', parentId: 'seed_bn_kz_lodge', category: 'lodging', title: 'Hyatt Centric Kanazawa', linkedItemId: `${id}_i4`, linkedPlaceId: 'seed_p_hyatt_kz' }),
        node({ id: 'seed_bn_kz_room', parentId: 'seed_bn_kz_lodge_kz', category: 'lodging', title: 'Phòng gia đình', lumpSum: 28000, quantity: 2 }),
        node({ id: 'seed_bn_kz_tax', parentId: 'seed_bn_kz_lodge_kz', category: 'lodging', title: 'Thuế lưu trú', pricingMode: 'perPerson', unitAdult: 200, unitChild: 0, quantity: 2, order: 1 }),
        node({ id: 'seed_bn_kz_ryokan', parentId: 'seed_bn_kz_lodge', category: 'lodging', title: 'Gora Kadan (1 đêm, gồm ăn tối)', pricingMode: 'perPerson', unitAdult: 60000, unitChild: 30000, order: 1, linkedItemId: `${id}_i10`, linkedPlaceId: 'seed_p_gora_kadan' }),
        node({ id: 'seed_bn_kz_food', category: 'food', title: 'Ăn uống hằng ngày', pricingMode: 'perPerson', unitAdult: 5000, unitChild: 2500, quantity: 4 }),
        node({ id: 'seed_bn_kz_omicho', category: 'food', title: 'Kaisendon ở chợ Omicho', pricingMode: 'perPerson', unitAdult: 3000, unitChild: 1500, order: 1, linkedItemId: `${id}_i2`, linkedPlaceId: 'seed_p_omicho' }),
        node({ id: 'seed_bn_kz_kenroku', category: 'sightseeing', title: 'Vé Kenroku-en', pricingMode: 'perPerson', unitAdult: 320, unitChild: 100, linkedItemId: `${id}_i3`, linkedPlaceId: 'seed_p_kenrokuen' }),
        node({ id: 'seed_bn_kz_rope', category: 'sightseeing', title: 'Hakone Free Pass', pricingMode: 'perPerson', unitAdult: 6100, unitChild: 1100, order: 1, linkedItemId: `${id}_i11`, linkedPlaceId: 'seed_p_ropeway' }),
        node({ id: 'seed_bn_kz_other', category: 'other', title: 'Sim + bảo hiểm du lịch', note: 'Mua trước ở sân bay', lumpSum: 9000 }),
      ],
      updatedAt: isoAt(-1, 21),
    }),
  );
}

// S2 — Đang đi (hôm qua → 2 ngày nữa), chi tiêu ghi dở dang, có khoản nhập
//      riêng, có khoản gắn dự trù. → card "đang đi" ở màn Tính toán.
{
  const id = 'seed_t_hiroshima';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const kenji = tv(`${id}_kenji`, 'Kenji Sato');
  const mai = tv(`${id}_mai`, 'Nguyễn Mai');
  const all = [me.id, kenji.id, mai.id];
  const start = d(-1);
  const days = buildDays(id, start, [
    [place(`${id}_i1`, 'seed_p_peace_park', ['10:00', '12:00']), place(`${id}_i2`, 'seed_p_okonomi', ['12:30', '13:30'], { note: 'Tầng 3, quán Hassho' }), place(`${id}_i3`, 'seed_p_sheraton_hr', ['18:00', '19:00'])],
    [act(`${id}_i4`, 'Phà sang Miyajima', 'other', ['08:30', '09:30']), place(`${id}_i5`, 'seed_p_itsukushima', ['09:30', '12:00'], { note: 'Xem giờ thuỷ triều để thấy cổng nổi' }), act(`${id}_i6`, 'Ăn hàu nướng', 'restaurant', ['12:00', '13:00'])],
    [act(`${id}_i7`, 'Mua quà momiji manju', 'shopping', ['10:00', '11:00']), act(`${id}_i8`, 'Shinkansen về Osaka', 'other', ['14:00', '15:30'])],
    [act(`${id}_i9`, 'Ngày tự do', 'other')],
  ]);
  TRIPS.push(
    trip({
      id,
      name: 'Hiroshima – Miyajima',
      regions: [regionRef('seed_r_hiroshima')],
      startDate: start,
      endDate: d(2),
      status: 'ongoing',
      travelers: [me, kenji, mai],
      budget: 240000,
      days,
      budgetPlan: [
        node({ id: 'seed_bn_hr_hotel', category: 'lodging', title: 'Sheraton Grand Hiroshima', lumpSum: 44000, quantity: 3, linkedItemId: `${id}_i3`, linkedPlaceId: 'seed_p_sheraton_hr' }),
        node({ id: 'seed_bn_hr_jr', category: 'transport', title: 'JR + phà Miyajima', pricingMode: 'perPerson', unitAdult: 11000 }),
        node({ id: 'seed_bn_hr_food', category: 'food', title: 'Ăn uống', pricingMode: 'perPerson', unitAdult: 6000, quantity: 4 }),
        node({ id: 'seed_bn_hr_sight', category: 'sightseeing', title: 'Vé tham quan', pricingMode: 'perPerson', unitAdult: 1500 }),
      ],
      updatedAt: isoAt(0, 9),
    }),
  );
  EXPENSES.push(
    expense(id, { date: d(-1), category: 'lodging', budgetNodeId: 'seed_bn_hr_hotel', title: 'Khách sạn 3 đêm (đặt cọc)', amount: 132000, payer: me.id, shares: all }),
    expense(id, { date: d(-1), category: 'food', title: 'Okonomiyaki', amount: 4350, payer: kenji.id, shares: all, note: 'Chia 3 ra số lẻ — để test làm tròn 0,01' }),
    expense(id, { date: d(-1), category: 'transport', budgetNodeId: 'seed_bn_hr_jr', title: 'Vé JR', amount: 33000, payer: mai.id, shares: all }),
    expense(id, { date: d(0), category: 'food', title: 'Hàu nướng + bia', amount: 7800, payer: me.id, shares: { [me.id]: 2000, [kenji.id]: 3800, [mai.id]: 2000 }, note: 'Kenji gọi thêm bia' }),
    expense(id, { date: d(0), category: 'sightseeing', title: 'Vé đền Itsukushima', amount: 900, payer: kenji.id, shares: all }),
  );
}

// S3 — Đã về 3 ngày nhưng status vẫn "đang đi" (quên đổi) → Dashboard gợi ý
//      chuyển 精算待ち. Nhiều khoản chi, nhiều người trả, 1 người đã rời nhóm,
//      vượt dự trù ở mục ăn uống.
{
  const id = 'seed_t_fukuoka';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const linh = tv(`${id}_linh`, 'Linh');
  const huy = tv(`${id}_huy`, 'Huy');
  const dung = tv(`${id}_dung`, 'Dũng', { leftGroup: true });
  const all = [me.id, linh.id, huy.id, dung.id];
  const start = d(-6);
  const days = buildDays(id, start, [
    [act(`${id}_i1`, 'Bay Haneda → Fukuoka', 'other', ['07:00', '09:00']), place(`${id}_i2`, 'seed_p_hotel_fk', ['10:00', '10:30']), place(`${id}_i3`, 'seed_p_ichiran', ['11:30', '12:30']), place(`${id}_i4`, 'seed_p_yatai', ['19:00', '21:00'], { note: 'Quán yatai số 12, mentaiko tamagoyaki' })],
    [place(`${id}_i5`, 'seed_p_dazaifu', ['09:00', '12:00']), place(`${id}_i6`, 'seed_p_canal_city', ['15:00', '18:00'])],
    [act(`${id}_i7`, 'Motsunabe tối', 'restaurant', ['18:30', '20:30'])],
    [act(`${id}_i8`, 'Bay về Tokyo', 'other', ['12:00', '14:00'])],
  ]);
  TRIPS.push(
    trip({
      id,
      name: 'Fukuoka ăn sập phố',
      regions: [regionRef('seed_r_fukuoka')],
      startDate: start,
      endDate: d(-3),
      status: 'ongoing',
      travelers: [me, linh, huy, dung],
      budget: 260000,
      treasurerId: me.id,
      days,
      budgetPlan: [
        node({ id: 'seed_bn_fk_air', category: 'transport', title: 'Vé máy bay', pricingMode: 'perPerson', unitAdult: 24000 }),
        node({ id: 'seed_bn_fk_hotel', category: 'lodging', title: 'Hotel Il Palazzo', lumpSum: 32000, quantity: 3, linkedItemId: `${id}_i2`, linkedPlaceId: 'seed_p_hotel_fk' }),
        node({ id: 'seed_bn_fk_food', category: 'food', title: 'Ăn uống (ước lượng thấp)', pricingMode: 'perPerson', unitAdult: 4000, quantity: 4 }),
        node({ id: 'seed_bn_fk_shop', category: 'other', title: 'Mua sắm', lumpSum: 20000 }),
      ],
    }),
  );
  EXPENSES.push(
    expense(id, { date: d(-6), category: 'transport', budgetNodeId: 'seed_bn_fk_air', title: 'Vé máy bay 4 người', amount: 98400, payer: me.id, shares: all }),
    expense(id, { date: d(-6), category: 'lodging', budgetNodeId: 'seed_bn_fk_hotel', title: 'Khách sạn 3 đêm', amount: 99000, payer: linh.id, shares: all }),
    expense(id, { date: d(-6), category: 'food', title: 'Ichiran ramen', amount: 4720, payer: huy.id, shares: all }),
    expense(id, { date: d(-6), category: 'food', title: 'Yatai tối', amount: 13300, payer: dung.id, shares: all }),
    expense(id, { date: d(-5), category: 'sightseeing', title: 'Tàu đi Dazaifu', amount: 2400, payer: me.id, shares: all }),
    expense(id, { date: d(-5), category: 'food', title: 'Umegae mochi', amount: 1000, payer: linh.id, shares: [me.id, linh.id] }),
    expense(id, { date: d(-5), category: 'other', title: 'Mua sắm Canal City', amount: 18900, payer: huy.id, shares: { [huy.id]: 12000, [me.id]: 6900 } }),
    expense(id, { date: d(-4), category: 'food', title: 'Motsunabe', amount: 16480, payer: me.id, shares: all, note: 'Dũng đã về trước, vẫn chia vì đặt bàn 4 người' }),
    expense(id, { date: d(-4), category: 'food', title: 'Cà phê sáng', amount: 2310, payer: huy.id, shares: [me.id, linh.id, huy.id] }),
    expense(id, { date: d(-3), category: 'food', title: 'Bento sân bay', amount: 4560, payer: linh.id, shares: [me.id, linh.id, huy.id] }),
    expense(id, { date: d(-3), category: 'transport', title: 'Taxi ra sân bay', amount: 3270, payer: me.id, shares: [me.id, linh.id, huy.id] }),
  );
}

// S4 — Busan cuối tuần, ĐÃ XONG và quyết toán hết (mọi số dư = 0).
{
  const id = 'seed_t_busan';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const minh = tv(`${id}_minh`, 'Minh');
  const both = [me.id, minh.id];
  const start = d(-45);
  TRIPS.push(
    trip({
      id,
      name: 'Busan cuối tuần',
      regions: [regionRef('seed_r_busan')],
      startDate: start,
      endDate: d(-43),
      status: 'done',
      travelers: [me, minh],
      budget: 120000,
      treasurerId: me.id,
      days: buildDays(id, start, [
        [place(`${id}_i1`, 'seed_p_haeundae', ['10:00', '12:00']), place(`${id}_i2`, 'seed_p_jagalchi', ['18:00', '20:00'])],
        [place(`${id}_i3`, 'seed_p_gamcheon', ['10:00', '13:00'])],
        [act(`${id}_i4`, 'Bay về', 'other', ['15:00', '17:00'])],
      ]),
      budgetPlan: [
        node({ id: 'seed_bn_bs_air', category: 'transport', title: 'Vé máy bay', pricingMode: 'perPerson', unitAdult: 30000 }),
        node({ id: 'seed_bn_bs_hotel', category: 'lodging', title: 'Khách sạn 2 đêm', lumpSum: 36000 }),
        node({ id: 'seed_bn_bs_food', category: 'food', title: 'Ăn uống', pricingMode: 'perPerson', unitAdult: 8000 }),
      ],
      updatedAt: isoAt(-40),
    }),
  );
  // Tôi trả 66.000, Minh trả 26.000, chia đều → Minh nợ tôi 20.000 → đã trả.
  EXPENSES.push(
    expense(id, { date: d(-45), category: 'transport', budgetNodeId: 'seed_bn_bs_air', title: 'Vé máy bay', amount: 60000, payer: me.id, shares: both }),
    expense(id, { date: d(-45), category: 'lodging', budgetNodeId: 'seed_bn_bs_hotel', title: 'Khách sạn', amount: 18000, payer: minh.id, shares: both }),
    expense(id, { date: d(-44), category: 'food', title: 'Chợ cá Jagalchi', amount: 6000, payer: me.id, shares: both }),
    expense(id, { date: d(-44), category: 'food', title: 'Gà rán + bia', amount: 8000, payer: minh.id, shares: both }),
    expense(id, { kind: 'settlement', date: d(-42), category: 'other', title: 'settlement', amount: 20000, payer: minh.id, shares: { [me.id]: 20000 } }),
  );
}

// S5 — Honolulu (USD, lưu theo cent), đã xong nhưng VƯỢT dự trù và còn số dư
//      → Dashboard nhắc quyết toán dù status đã 完了.
{
  const id = 'seed_t_honolulu';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const yuki = tv(`${id}_yuki`, 'Yuki');
  const both = [me.id, yuki.id];
  const start = d(-70);
  TRIPS.push(
    trip({
      id,
      name: 'Honolulu honeymoon-ish',
      regions: [regionRef('seed_r_honolulu')],
      startDate: start,
      endDate: d(-65),
      status: 'done',
      travelers: [me, yuki],
      currency: 'USD',
      budget: 400000, // $4,000.00
      days: buildDays(id, start, [
        [place(`${id}_i1`, 'seed_p_halekulani', ['15:00', '16:00']), place(`${id}_i2`, 'seed_p_waikiki', ['16:30', '19:00'])],
        [place(`${id}_i3`, 'seed_p_diamond_head', ['06:00', '09:00'], { note: 'Đặt slot leo núi trước 2 tuần' }), place(`${id}_i4`, 'seed_p_poke_bar', ['11:00', '12:00'])],
        [place(`${id}_i5`, 'seed_p_pearl_harbor', ['08:00', '12:00'])],
        [place(`${id}_i6`, 'seed_p_ala_moana', ['10:00', '15:00'])],
        [act(`${id}_i7`, 'Lặn ngắm san hô', 'attraction', ['08:00', '12:00'])],
        [act(`${id}_i8`, 'Bay về', 'other', ['13:00', '22:00'])],
      ]),
      budgetPlan: [
        node({ id: 'seed_bn_hn_air', category: 'transport', title: 'Flights', pricingMode: 'perPerson', unitAdult: 95000 }),
        node({ id: 'seed_bn_hn_hotel', category: 'lodging', title: 'Halekulani 5 nights', lumpSum: 65000, quantity: 5, linkedItemId: `${id}_i1`, linkedPlaceId: 'seed_p_halekulani' }),
        node({ id: 'seed_bn_hn_food', category: 'food', title: 'Food', pricingMode: 'perPerson', unitAdult: 8000, quantity: 6 }),
      ],
      updatedAt: isoAt(-60),
    }),
  );
  EXPENSES.push(
    expense(id, { date: d(-71), category: 'transport', budgetNodeId: 'seed_bn_hn_air', title: 'Flights', amount: 198050, payer: me.id, shares: both }),
    expense(id, { date: d(-70), category: 'lodging', budgetNodeId: 'seed_bn_hn_hotel', title: 'Halekulani 5 nights', amount: 349999, payer: yuki.id, shares: both, note: 'Số lẻ cent — test chia' }),
    expense(id, { date: d(-69), category: 'food', title: 'Poke & shave ice', amount: 6425, payer: me.id, shares: both }),
    expense(id, { date: d(-68), category: 'sightseeing', title: 'Snorkel tour', amount: 31000, payer: yuki.id, shares: both }),
    expense(id, { date: d(-67), category: 'other', title: 'Ala Moana shopping', amount: 52075, payer: me.id, shares: { [me.id]: 52075 } }),
  );
}

// S6 — Nara 1 ngày (endDate null), 10 ngày nữa, plan 2/4 (chưa gán giờ) + có
//      mục ở khu "Chưa xếp ngày" → Dashboard nhắc "Tới bước 3".
{
  const id = 'seed_t_nara';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const start = d(10);
  TRIPS.push(
    trip({
      id,
      name: 'Nara 1 ngày ngắm hươu',
      regions: [regionRef('seed_r_nara')],
      startDate: start,
      endDate: null,
      status: 'planning',
      travelers: [me],
      days: buildDays(id, start, [[place(`${id}_i1`, 'seed_p_nara_park'), place(`${id}_i2`, 'seed_p_todaiji'), place(`${id}_i3`, 'seed_p_kakinoha', null, { note: 'Mua mang về làm quà' })]]),
      unscheduledItems: [act(`${id}_u1`, 'Cà phê ở Naramachi', 'restaurant'), act(`${id}_u2`, 'Isuien Garden (nếu kịp)', 'attraction')],
    }),
  );
}

// S7 — Tên rất dài, 5 điểm đến (tên mặc định "+2"), 25 ngày nữa, plan 3/4
//      (đã gán giờ, CHƯA dự trù) → nhắc "Tới bước 4". Ngày 2 có 2 mục TRÙNG
//      GIỜ để test banner ở Bước 3; có memo dài đúng 100 ký tự.
{
  const id = 'seed_t_golden';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const a = tv(`${id}_a`, 'Phạm Quốc Anh');
  const b = tv(`${id}_b`, 'Lê Thị Bích Ngọc');
  const start = d(25);
  const longNote = 'Nhớ đặt bàn trước ít nhất 3 ngày, quán nhỏ chỉ có 8 chỗ, không nhận khách vãng lai sau 20 giờ tối!!';
  TRIPS.push(
    trip({
      id,
      name: 'Golden Route mùa thu: Tokyo – Kyoto – Osaka – Nara – Hiroshima (bản đầy đủ cho cả nhóm)',
      regions: ['r2', 'r1', 'r3', 'seed_r_nara', 'seed_r_hiroshima'].map(regionRef),
      startDate: start,
      endDate: d(31),
      status: 'planning',
      travelers: [me, a, b],
      days: buildDays(id, start, [
        [place(`${id}_i1`, 'seed_p_park_hyatt', ['15:00', '16:00']), place(`${id}_i2`, 'seed_p_ginza_six', ['17:00', '19:00'], { note: longNote.slice(0, 100) })],
        [place(`${id}_i3`, 'p1', ['09:00', '11:00']), place(`${id}_i4`, 'p8', ['10:30', '12:00'], { note: 'CỐ Ý trùng giờ với mục trước để test Bước 3' })],
        [act(`${id}_i5`, 'Shinkansen Tokyo → Kyoto', 'other', ['08:00', '10:15']), place(`${id}_i6`, 'seed_p_nishiki_inn', ['15:00', '16:00'])],
        [place(`${id}_i7`, 'p2', ['08:00', '10:00']), place(`${id}_i8`, 'p3', ['10:30', '12:30'])],
        [place(`${id}_i9`, 'seed_p_kuromon', ['10:00', '12:00']), place(`${id}_i10`, 'p12', ['14:00', '17:00'])],
        [place(`${id}_i11`, 'seed_p_todaiji', ['09:00', '11:00']), place(`${id}_i12`, 'seed_p_nara_park', ['11:00', '12:30'])],
        [place(`${id}_i13`, 'seed_p_peace_park', ['10:00', '12:00']), act(`${id}_i14`, 'Về Tokyo', 'other', ['16:00', '20:00'])],
      ]),
    }),
  );
}

// S8 — Ý tưởng xa (4 tháng nữa), bản nháp 1/4: chưa có mục nào, chưa dự trù.
{
  const id = 'seed_t_hokkaido_idea';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const start = d(120);
  TRIPS.push(
    trip({
      id,
      name: 'Ý tưởng: Hokkaido mùa hoa oải hương',
      regions: [regionRef('r4')],
      startDate: start,
      endDate: d(124),
      status: 'idea',
      travelers: [me],
      days: buildDays(id, start, [[], [], [], [], []]),
    }),
  );
}

// S9 — Status "đang đi" nhưng 14 ngày nữa mới đi → Dashboard gợi ý 確定.
{
  const id = 'seed_t_hakone';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const ken = tv(`${id}_ken`, 'Ken');
  const start = d(14);
  TRIPS.push(
    trip({
      id,
      name: '箱根 温泉ひとやすみ',
      regions: [regionRef('seed_r_hakone')],
      startDate: start,
      endDate: d(15),
      status: 'ongoing',
      travelers: [me, ken],
      budget: 150000,
      days: buildDays(id, start, [
        [place(`${id}_i1`, 'seed_p_owakudani', ['11:00', '12:30']), place(`${id}_i2`, 'seed_p_custom_public', ['14:00', '16:00']), place(`${id}_i3`, 'seed_p_gora_kadan', ['16:30', '17:00'])],
        [place(`${id}_i4`, 'seed_p_ropeway', ['09:00', '10:30']), place(`${id}_i5`, 'seed_p_soba_hakone', ['11:30', '12:30'])],
      ]),
      budgetPlan: [
        node({ id: 'seed_bn_hk_ryokan', category: 'lodging', title: 'Gora Kadan', lumpSum: 120000, linkedItemId: `${id}_i3`, linkedPlaceId: 'seed_p_gora_kadan' }),
        node({ id: 'seed_bn_hk_train', category: 'transport', title: 'Romancecar', pricingMode: 'perPerson', unitAdult: 2470, quantity: 2 }),
      ],
    }),
  );
}

// S10 — Năm 2025, đã xong và quyết toán hết (test bộ lọc năm).
{
  const id = 'seed_t_seoul_2025';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const jin = tv(`${id}_jin`, 'Jin');
  const sora = tv(`${id}_sora`, 'Sora');
  const all = [me.id, jin.id, sora.id];
  const start = `${TODAY.getFullYear() - 1}-11-20`;
  TRIPS.push(
    trip({
      id,
      name: 'Seoul mùa đông năm ngoái',
      regions: [regionRef('r7')],
      startDate: start,
      endDate: `${TODAY.getFullYear() - 1}-11-23`,
      status: 'done',
      travelers: [me, jin, sora],
      budget: 210000,
      treasurerId: jin.id,
      days: buildDays(id, start, [[place(`${id}_i1`, 'p25', ['10:00', '12:00'])], [place(`${id}_i2`, 'p26', ['13:00', '17:00'])], [place(`${id}_i3`, 'p27', ['09:00', '11:00'])], [act(`${id}_i4`, 'Bay về', 'other', ['14:00', '16:30'])]]),
      budgetPlan: [
        node({ id: 'seed_bn_sl_air', category: 'transport', title: 'Vé máy bay', pricingMode: 'perPerson', unitAdult: 35000 }),
        node({ id: 'seed_bn_sl_hotel', category: 'lodging', title: 'Khách sạn Myeongdong', lumpSum: 15000, quantity: 3 }),
        node({ id: 'seed_bn_sl_food', category: 'food', title: 'Ăn uống', pricingMode: 'perPerson', unitAdult: 5000, quantity: 4 }),
      ],
      updatedAt: `${TODAY.getFullYear() - 1}-11-25T10:00:00.000Z`,
    }),
  );
  // Jin trả 105.000, tôi trả 45.000, Sora trả 30.000 — chia đều 60.000/người.
  // → Tôi nợ 15.000, Sora nợ 30.000, Jin được nhận 45.000. Đã trả hết.
  EXPENSES.push(
    expense(id, { date: start, category: 'transport', budgetNodeId: 'seed_bn_sl_air', title: 'Vé máy bay', amount: 105000, payer: jin.id, shares: all }),
    expense(id, { date: start, category: 'lodging', budgetNodeId: 'seed_bn_sl_hotel', title: 'Khách sạn 3 đêm', amount: 45000, payer: me.id, shares: all }),
    expense(id, { date: start, category: 'food', title: 'BBQ Hàn', amount: 30000, payer: sora.id, shares: all }),
    expense(id, { kind: 'settlement', date: `${TODAY.getFullYear() - 1}-11-24`, category: 'other', title: 'settlement', amount: 15000, payer: me.id, shares: { [jin.id]: 15000 } }),
    expense(id, { kind: 'settlement', date: `${TODAY.getFullYear() - 1}-11-24`, category: 'other', title: 'settlement', amount: 30000, payer: sora.id, shares: { [jin.id]: 30000 } }),
  );
}

// S11 — Trip CỦA NGƯỜI KHÁC (thao2) nhưng tôi là thành viên đã gắn tài khoản
//       → tôi vẫn thấy (canViewTrip). Có chi tiêu, tôi còn nợ.
{
  const id = 'seed_t_shared_kyoto';
  const owner = tv(`${id}_owner`, 'Thao Nguyen', { userId: OTHER });
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const start = d(40);
  TRIPS.push(
    trip({
      id,
      ownerId: OTHER,
      name: 'Kyoto mùa lá đỏ (Thao Nguyen mời)',
      regions: [regionRef('r1')],
      startDate: start,
      endDate: d(42),
      status: 'confirmed',
      travelers: [owner, me],
      budget: 160000,
      days: buildDays(id, start, [[place(`${id}_i1`, 'p3', ['09:00', '11:00']), place(`${id}_i2`, 'seed_p_nishiki_inn', ['16:00', '17:00'])], [place(`${id}_i3`, 'p5', ['10:00', '12:00'])], [act(`${id}_i4`, 'Về', 'other', ['15:00', '17:30'])]]),
      budgetPlan: [node({ id: 'seed_bn_sk_inn', category: 'lodging', title: 'Machiya Inn 2 đêm', lumpSum: 32000, quantity: 2, linkedItemId: `${id}_i2`, linkedPlaceId: 'seed_p_nishiki_inn' })],
    }),
  );
  EXPENSES.push(
    expense(id, { date: d(-10), category: 'lodging', budgetNodeId: 'seed_bn_sk_inn', title: 'Đặt cọc Machiya Inn', amount: 64000, payer: owner.id, shares: [owner.id, me.id], createdBy: OTHER }),
  );
}

// S12 — Trip của Kenji, tôi KHÔNG phải thành viên → không được thấy khi đăng
//       nhập bằng thao@gmail.com (đăng nhập kenji@gmail.com để thấy).
{
  const id = 'seed_t_kenji_only';
  const boss = tv(`${id}_boss`, 'Kenji Tanaka', { userId: KENJI });
  const start = d(5);
  TRIPS.push(
    trip({
      id,
      ownerId: KENJI,
      name: 'Kenji – Tokyo business trip',
      regions: [regionRef('r2')],
      startDate: start,
      endDate: d(6),
      status: 'confirmed',
      travelers: [boss],
      budget: 80000,
      days: buildDays(id, start, [[place(`${id}_i1`, 'seed_p_park_hyatt', ['15:00', '16:00'])], [act(`${id}_i2`, 'Họp khách hàng', 'other', ['10:00', '12:00'])]]),
    }),
  );
}

// S13 — Các ca dữ liệu "lỗi" vẫn phải hiển thị được: mục trỏ tới place đã bị
//       xoá, khoản dự trù mất liên kết (badge "đã xoá khỏi lịch trình"), khu
//       "Chưa xếp ngày", và mục chưa có giờ trong ngày đã có giờ.
{
  const id = 'seed_t_okinawa_edge';
  const me = tv(`${id}_me`, 'Thao', { userId: ME });
  const k = tv(`${id}_k`, 'Kaito');
  const start = d(50);
  TRIPS.push(
    trip({
      id,
      name: 'Okinawa lặn biển (ca dữ liệu đặc biệt)',
      regions: [regionRef('r5')],
      startDate: start,
      endDate: d(52),
      status: 'planning',
      travelers: [me, k],
      days: buildDays(id, start, [
        [place(`${id}_i1`, 'p19', ['10:00', '12:00']), place(`${id}_i2`, 'seed_p_deleted_place', ['13:00', '14:00']), act(`${id}_i3`, 'Lặn ngắm san hô', 'attraction')],
        [place(`${id}_i4`, 'p20', ['09:00', '11:00'])],
        [place(`${id}_i5`, 'p21', ['10:00', '11:00'])],
      ]),
      unscheduledItems: [place(`${id}_u1`, 'p19'), act(`${id}_u2`, 'Thuê xe máy', 'other', null, { note: 'Cần bằng lái quốc tế' })],
      budgetPlan: [
        node({ id: 'seed_bn_ok_dive', category: 'sightseeing', title: 'Tour lặn 2 lượt', pricingMode: 'perPerson', unitAdult: 15000 }),
        // Mục lịch trình gắn với khoản này đã bị xoá → giữ tiền, hiện cảnh báo (B3.6)
        node({ id: 'seed_bn_ok_orphan', category: 'food', title: 'Bữa tối ở nhà hàng đã huỷ', lumpSum: 12000, linkedItemTitle: 'Nhà hàng Kaiyo (đã xoá)' }),
      ],
    }),
  );
}

db.trips.push(...TRIPS);
db.expenses.push(...EXPENSES);

// Lịch sử khoản chi (S10): mỗi khoản seed có một dòng "đã thêm"; vài khoản có
// thêm một lần sửa để màn 履歴 có ví dụ "trước → sau".
const userName = (id) => (db.users ?? []).find((user) => user.id === id)?.fullName ?? '';
const snapshot = ({ id, tripId, createdAt, createdBy, ...rest }) => rest;
const HISTORY = EXPENSES.map((expense) => ({
  id: `seed_hist_${expense.id}`,
  tripId: expense.tripId,
  expenseId: expense.id,
  action: 'create',
  at: expense.createdAt,
  userId: expense.createdBy,
  userName: userName(expense.createdBy),
  after: snapshot(expense),
}));
for (const expense of EXPENSES.filter((e) => e.kind === 'expense').filter((_, index) => index % 7 === 3).slice(0, 6)) {
  const before = { ...snapshot(expense), amount: Math.round(expense.amount * 0.9), title: expense.title };
  HISTORY.push({
    id: `seed_hist_${expense.id}_edit`,
    tripId: expense.tripId,
    expenseId: expense.id,
    action: 'update',
    at: new Date(new Date(expense.createdAt).getTime() + 2 * 3600 * 1000).toISOString(),
    userId: expense.createdBy,
    userName: userName(expense.createdBy),
    before,
    after: snapshot(expense),
  });
}
db.expenseHistory = [...(db.expenseHistory ?? []), ...HISTORY];

// `spent` là bản denormalize = tổng khoản chi thật (không tính giao dịch quyết toán).
for (const t of TRIPS) {
  t.spent = EXPENSES.filter((e) => e.tripId === t.id && e.kind === 'expense').reduce((sum, e) => sum + e.amount, 0);
}

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');

const CASES = [
  ['S1', '金沢・箱根 家族旅行', 'Sắp đi 2 ngày nữa, 4/4, trẻ em có người phụ trách, hạn mức/người, cây dự trù 3 mức, memo'],
  ['S2', 'Hiroshima – Miyajima', 'Đang đi hôm nay, chi tiêu ghi dở, khoản nhập riêng, số lẻ khi chia 3'],
  ['S3', 'Fukuoka ăn sập phố', 'Đã về 3 ngày mà status vẫn 旅行中 → gợi ý 精算待ち; người rời nhóm có chi tiêu; vượt dự trù'],
  ['S4', 'Busan cuối tuần', 'Đã xong, quyết toán hết (số dư = 0)'],
  ['S5', 'Honolulu honeymoon-ish', 'USD (cent), 完了 nhưng vượt dự trù và còn số dư → nhắc quyết toán'],
  ['S6', 'Nara 1 ngày ngắm hươu', 'Trip 1 ngày, plan 2/4 (chưa gán giờ), có khu "Chưa xếp ngày"'],
  ['S7', 'Golden Route mùa thu…', 'Tên rất dài, 5 điểm đến, 3/4 (chưa dự trù), 2 mục trùng giờ, memo 100 ký tự'],
  ['S8', 'Ý tưởng: Hokkaido…', 'Bản nháp 1/4, 4 tháng nữa'],
  ['S9', '箱根 温泉ひとやすみ', 'Status 旅行中 nhưng 14 ngày nữa mới đi → gợi ý 確定; place tự tạo công khai của người khác'],
  ['S10', 'Seoul mùa đông năm ngoái', 'Năm trước — test bộ lọc năm, đã quyết toán hết'],
  ['S11', 'Kyoto mùa lá đỏ (Thao Nguyen mời)', 'Chủ là thao2, tôi là thành viên → vẫn thấy; tôi đang nợ'],
  ['S12', 'Kenji – Tokyo business trip', 'Chỉ kenji@gmail.com thấy — thao@gmail.com KHÔNG được thấy'],
  ['S13', 'Okinawa lặn biển (ca dữ liệu đặc biệt)', 'Place đã bị xoá, khoản dự trù mất liên kết, "Chưa xếp ngày", mục chưa có giờ'],
];
console.log(
  `Đã seed: ${REGIONS.length} region, ${PLACES.length} place, ${TRIPS.length} trip, ${EXPENSES.length} khoản chi, ${7} place đã lưu.`,
);
console.table(CASES.map(([key, name, note]) => ({ ca: key, trip: name, 'kiểm tra': note })));
