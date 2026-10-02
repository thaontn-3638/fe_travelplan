// Migration một lần: chủ sở hữu trip + làm sạch dữ liệu thành viên cũ.
// Chạy: node scripts/migrate-ownership.mjs   (tắt json-server trước khi chạy)
//
// Idempotent: chạy nhiều lần cho cùng kết quả.
//
// 1. `ownerId` — trước đây trip không có chủ nên mọi tài khoản đều thấy mọi
//    trip. Chủ = thành viên đầu tiên đã gắn tài khoản; không có thì lấy người
//    tạo nhiều khoản chi nhất; không có nữa thì gán cho tài khoản mặc định.
// 2. Gắn tài khoản cho thành viên TRÙNG TÊN với chủ trip (bỏ dấu, không phân
//    biệt hoa thường) — CHỈ cho dữ liệu cũ, để thống kê "của bạn" ở màn Tính
//    toán có số. Trip tạo mới không tự gắn theo tên; người dùng bấm "Là tôi".
// 3. `party` phải khớp danh sách thành viên (Bước 1 giờ chặn lưu khi lệch).
//    Thiếu người thì thêm thành viên tạm tên "Thành viên N" / "Bé N" — giữ
//    nguyên `party` để không làm đổi số dự trù đã lập.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const DB = new URL('../db.json', import.meta.url);
const BACKUP = new URL('../db.before-ownership-migration.json', import.meta.url);

// Tài khoản đang dùng để test thật (thao@gmail.com) — nhận các trip seed cũ
// không xác định được chủ.
const DEFAULT_OWNER_ID = 'nb3fbQt2Mhk';
const AVATAR_COLORS = ['bg-ocean', 'bg-coral', 'bg-mint', 'bg-violet', 'bg-amber-dark', 'bg-navy'];

const db = JSON.parse(readFileSync(DB, 'utf8'));

if (!existsSync(BACKUP)) {
  writeFileSync(BACKUP, JSON.stringify(db, null, 2) + '\n');
  console.log('backup -> db.before-ownership-migration.json');
}

const normalize = (name) =>
  (name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();

const initialsOf = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
};

const usersById = new Map((db.users ?? []).map((user) => [user.id, user]));
const report = [];

db.trips = (db.trips ?? []).map((trip) => {
  const next = { ...trip, travelers: [...(trip.travelers ?? [])] };
  const notes = [];

  // --- 1. ownerId ---
  if (!next.ownerId) {
    const linked = next.travelers.find((traveler) => traveler.userId);
    let owner = linked?.userId;

    if (!owner) {
      const counts = new Map();
      for (const expense of db.expenses ?? []) {
        if (expense.tripId !== next.id) continue;
        counts.set(expense.createdBy, (counts.get(expense.createdBy) ?? 0) + 1);
      }
      owner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    }

    next.ownerId = owner && usersById.has(owner) ? owner : DEFAULT_OWNER_ID;
    notes.push(`owner=${next.ownerId}`);
  }

  // --- 2. gắn tài khoản theo tên (chỉ dữ liệu cũ) ---
  const ownerUser = usersById.get(next.ownerId);
  const ownerAlreadyLinked = next.travelers.some((traveler) => traveler.userId === next.ownerId);
  if (ownerUser && !ownerAlreadyLinked) {
    const index = next.travelers.findIndex(
      (traveler) => !traveler.userId && normalize(traveler.fullName) === normalize(ownerUser.fullName),
    );
    if (index !== -1) {
      next.travelers[index] = { ...next.travelers[index], userId: ownerUser.id };
      notes.push(`linked "${next.travelers[index].fullName}" -> ${ownerUser.email}`);
    }
  }

  // --- 3. party khớp danh sách thành viên ---
  const party = { adults: next.party?.adults ?? 1, children: next.party?.children ?? 0 };
  const namedAdults = () => next.travelers.filter((traveler) => !traveler.isChild).length;
  const namedChildren = () => next.travelers.filter((traveler) => traveler.isChild).length;

  const addPlaceholder = (isChild) => {
    const label = isChild ? `Bé ${namedChildren() + 1}` : `Thành viên ${namedAdults() + 1}`;
    next.travelers.push({
      id: `tv_${next.id}_${isChild ? 'c' : 'a'}${next.travelers.length + 1}`,
      fullName: label,
      initials: initialsOf(label),
      colorClass: AVATAR_COLORS[next.travelers.length % AVATAR_COLORS.length],
      ...(isChild ? { isChild: true } : {}),
    });
    notes.push(`+ ${label}`);
  };

  while (namedAdults() < party.adults) addPlaceholder(false);
  while (namedChildren() < party.children) addPlaceholder(true);

  // Danh sách đông hơn số người khai: số người theo danh sách.
  if (namedAdults() > party.adults || namedChildren() > party.children) {
    next.party = { adults: Math.max(1, namedAdults()), children: namedChildren() };
    notes.push(`party -> ${next.party.adults}+${next.party.children}`);
  }

  if (notes.length > 0) report.push(`${next.id} (${next.name}): ${notes.join(', ')}`);
  return next;
});

writeFileSync(DB, JSON.stringify(db, null, 2) + '\n');
console.log(report.length > 0 ? report.join('\n') : 'nothing to migrate');
