// Một chuyến đi dùng đúng một đơn vị tiền cho cả dự trù lẫn chi thực tế
// (trip-budget.md D1). Không có tỉ giá, không quy đổi.
export type Currency = 'JPY' | 'VND' | 'USD';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface Place {
  id: string;
  title: string;
  coverUrl: string;
  price?: number;
  // Đơn vị của `price`. Toàn bộ catalog hiện có là JPY — migration gán mặc
  // định 'JPY'. Bước 4 chỉ dùng `price` làm placeholder khi trùng đơn vị của
  // chuyến đi (trip-budget.md B4).
  priceCurrency?: Currency;
  priceUnit?: 'perPerson' | 'perNight' | 'perGroup';
  rating?: number; // undefined = not yet rated (new custom places)
  address: string;
  lat?: number;
  lng?: number;
  region: string; // province/city, e.g. "Kyoto" — grouping + search
  country?: string;
  category?: string; // restaurant | hotel | attraction | ...
  description?: string;
  images?: string[]; // gallery for the detail carousel; falls back to [coverUrl] when absent
  aliases?: string[]; // alternate-language search terms, e.g. a Japanese name
  source: 'catalog' | 'custom';
  isPublic?: boolean; // only meaningful when source = 'custom'; default false
  createdBy?: string; // userId; only when source = 'custom'
  createdAt?: string; // ISO date; only when source = 'custom'
  savedCount: number; // default 0 — total times ever added to a saved list
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  addedAt: string;
}

export interface Region {
  id: string;
  name: string;
  country?: string;
  aliases?: string[]; // alternate-language names, e.g. a Japanese name
  source: 'catalog' | 'custom';
  createdBy?: string; // userId; only when source = 'custom'
}

export type TripStatus = 'idea' | 'planning' | 'confirmed' | 'ongoing' | 'settling' | 'done';

// Một mục trong lịch trình có thể là một Place trong catalog, hoặc một hoạt
// động tự do do người dùng tự nhập (di chuyển, nghỉ ngơi, ăn tối tuỳ chọn...).
export type ItineraryItemKind = 'place' | 'activity';

export interface Traveler {
  // Khoá ổn định của mọi tham chiếu chia tiền. KHÔNG dùng chỉ số mảng: xoá một
  // thành viên là toàn bộ lịch sử chi tiêu trỏ sai người (trip-budget.md §2.3).
  id: string;
  userId?: string; // có khi là thành viên có tài khoản
  fullName?: string;
  initials: string;
  colorClass: string;

  // Trẻ em có suất chi phí riêng (tính ra được bé nào hết bao nhiêu) nhưng
  // không tự trả: suất đó chuyển sang người lớn (trip-budget.md S2).
  isChild?: boolean;
  // Chỉ có nghĩa khi isChild. Người lớn đứng ra trả cho bé này.
  // undefined = chia đều cho các người lớn.
  guardianId?: string;

  // Đã rời nhóm: ẩn khỏi các ô chọn của khoản chi MỚI, nhưng giữ nguyên trong
  // lịch sử. Người đã có chi tiêu không được xoá — xoá là làm `payerId` và
  // `shares[]` trỏ vào người không tồn tại, và Σ số dư lệch âm thầm (S9).
  leftGroup?: boolean;
}

// Số người thực tế của chuyến đi — nguồn duy nhất cho phần dự trù chi phí.
// Tách hẳn khỏi `travelers` (danh sách thành viên cùng lên lịch trình).
export interface PartySize {
  adults: number; // >= 1
  children: number; // >= 0
}

// Điểm đến của trip. Denormalize `name`/`country` như Place.region để khỏi
// join khi render danh sách.
export interface TripRegion {
  id: string;
  name: string;
  country?: string;
}

export interface ItineraryItem {
  id: string;
  kind: ItineraryItemKind;

  placeId?: string; // bắt buộc khi kind = 'place'
  title?: string; // bắt buộc khi kind = 'activity'
  // Chỉ dùng cho kind = 'activity' — place lấy category từ chính Place.
  // Mặc định 'other'. Quyết định màu sắc và bộ lọc category.
  category?: string;

  note?: string;
  // Không có `estimatedCost` ở đây: chi phí dự trù nằm trong `Trip.budgetPlan`
  // và tra ngược về item bằng `nodeForItem()` (trip-budget.md D2).

  // Bước 2 (sắp xếp) không gán giờ — giờ chỉ xuất hiện từ Bước 3 trở đi.
  // Hai trường luôn cùng null hoặc cùng có giá trị. Format "HH:mm".
  startTime: string | null;
  endTime: string | null;

  order: number; // thứ tự trong ngày, 0..n-1
}

export interface ItineraryDay {
  id: string;
  date: string; // ISO date, e.g. "2026-08-14"
  items: ItineraryItem[];
}

// 5 loại chi phí, dùng chung cho cả dự trù (BudgetNode) lẫn chi thực tế
// (Expense) — đây là điều kiện để đối chiếu được (trip-budget.md §1).
export type CostCategory = 'transport' | 'lodging' | 'food' | 'sightseeing' | 'other';

export const COST_CATEGORIES: CostCategory[] = [
  'transport',
  'lodging',
  'food',
  'sightseeing',
  'other',
];

// perPerson: nhập đơn giá theo đầu người. lumpSum: nhập trọn gói (thuê xe,
// một phòng nhiều người ở...) — bắt user tự chia nhẩm là nguồn sai số.
export type BudgetPricingMode = 'perPerson' | 'lumpSum';
// Khoản trọn gói chia cho ai khi quy ra suất đầu người.
export type LumpSumSplit = 'perHead' | 'adultsOnly';

// Cây chi phí dự trù, lưu dạng MẢNG PHẲNG có parentId (không lồng nhau): PATCH
// nguyên mảng là một thao tác, và ràng buộc "sâu tối đa 3 mức" là quy tắc
// (budgetDepth) chứ không phải kiểu dữ liệu — vi phạm thì báo lỗi rõ ràng.
export interface BudgetNode {
  id: string;
  parentId: string | null; // null = mức 1
  category: CostCategory; // node con luôn kế thừa của node cha
  title: string; // <= 80 ký tự
  note?: string; // <= 100 ký tự, cùng luật với ItineraryItem.note

  // Gắn với một mục trong lịch trình là TUỲ CHỌN: vé máy bay, bảo hiểm, sim...
  // không bao giờ là một Place (trip-budget.md B3).
  linkedItemId?: string;
  // Denormalize để còn lấy được giá tham khảo khi item đã bị xoá khỏi lịch trình.
  linkedPlaceId?: string;
  // Tên của mục lịch trình lúc gắn. Cần cho hoạt động tự do (`kind: 'activity'`)
  // vì chúng không có `placeId` — thiếu nó thì sau khi mục bị xoá, node không
  // còn dấu vết nào để hiện cảnh báo (B3.6).
  linkedItemTitle?: string;

  pricingMode: BudgetPricingMode;
  unitAdult?: number; // pricingMode = 'perPerson'
  unitChild?: number; // pricingMode = 'perPerson'
  lumpSum?: number; // pricingMode = 'lumpSum'
  lumpSumSplit?: LumpSumSplit; // mặc định 'perHead'

  quantity: number; // >= 1 — số đêm / số vé / số lượt
  order: number; // thứ tự trong cùng một parentId
}

export interface ShareScope {
  plan: boolean;
  actual: boolean;
}

export interface Trip {
  id: string;
  name: string;
  // userId của người tạo. Trip hiện với một tài khoản khi tài khoản đó là chủ,
  // HOẶC là một thành viên đã gắn tài khoản (`travelers[].userId`) — xem
  // canViewTrip(). Optional chỉ để đọc được dữ liệu cũ chưa chạy migration
  // (scripts/migrate-ownership.mjs); trip tạo mới luôn có.
  ownerId?: string;

  regions: TripRegion[]; // >= 1 — chuyến đi có thể qua nhiều thành phố
  startDate: string; // ISO date
  endDate: string | null; // null = 1-day trip

  status: TripStatus;
  travelers: Traveler[];
  party: PartySize;

  currency: Currency;
  // HẠN MỨC user tự đặt — khác với "tổng dự trù" (dẫn xuất từ budgetPlan) và
  // "đã chi" (spent). Xem trip-budget.md §1.
  //
  // Hai cách đặt hạn mức, và ĐÚNG MỘT trong hai khác null:
  //   budget           — hạn mức cho cả chuyến (đi gia đình, gộp một túi tiền)
  //   budgetPerPerson  — hạn mức mỗi người (đi bạn bè, mỗi người tự lo phần mình)
  // Lưu đúng con số người dùng gõ, con số còn lại là DẪN XUẤT (`budgetTotal()`).
  // Nếu lưu cả hai thì chia rồi nhân lại sẽ sinh sai số và hai số sẽ lệch nhau.
  budget: number | null;
  budgetPerPerson: number | null;
  spent: number; // = tổng Expense kind='expense'

  // Cây chi phí dự trù — nguồn sự thật duy nhất của Bước 4.
  budgetPlan: BudgetNode[];
  // travelerId của thủ quỹ. undefined = tự chọn người có số dư lớn nhất (S5).
  treasurerId?: string;

  // Link xem công khai, chỉ đọc (trip-share.md). Có token = đang chia sẻ;
  // null/undefined = không chia sẻ. Tạo lại token là vô hiệu hoá link cũ.
  // Chỉ chủ trip bật/tắt được.
  shareToken?: string | null;
  sharedAt?: string;
  // Hai mức bật riêng: `plan` = lịch trình + dự trù; `actual` = chi tiêu thực
  // tế + quyết toán. Thiếu field (dữ liệu trước 2026-10-02) = chỉ `plan`.
  shareScope?: ShareScope;

  days: ItineraryDay[];
  // Khu "Chưa xếp ngày": item mồ côi khi xoá ngày hoặc rút ngắn chuyến —
  // giữ lại thay vì xoá dữ liệu của người dùng.
  unscheduledItems: ItineraryItem[];

  updatedAt: string; // ISO datetime
}

// ---------------------------------------------------------------------------
// Chi thực tế & quyết toán — docs/features/trip-budget.md §2.4
// ---------------------------------------------------------------------------

// Đúng hai chế độ chia tiền (D5): chia đều, hoặc nhập riêng từng người khi mỗi
// người ăn một món giá khác nhau.
export type SplitMode = 'equal' | 'exact';

// 'settlement' = một lần trả nợ giữa hai người. Ghi thành bản ghi thay vì một
// cờ `isPaid` trên dòng quyết toán: dòng đó là DẪN XUẤT, chỉ cần ai ghi thêm
// một bữa ăn là cả bảng tính lại và cờ cũ trỏ vào dòng không còn tồn tại (S6).
export type ExpenseKind = 'expense' | 'settlement';

export interface ExpenseShare {
  travelerId: string; // có thể là trẻ em — suất của bé được chuyển sang người lớn (S2)
  amount?: number; // chỉ dùng khi splitMode = 'exact'
}

export interface Expense {
  id: string;
  tripId: string;
  kind: ExpenseKind;

  date: string; // ISO date
  category: CostCategory; // BẮT BUỘC — không có nó thì không đối chiếu được dự trù
  budgetNodeId?: string; // tuỳ chọn — đối chiếu tới đúng khoản dự trù
  title: string;
  note?: string;

  amount: number; // > 0, theo trip.currency, đơn vị nhỏ nhất
  payerId: string; // travelerId — ai đã ứng tiền ra

  splitMode: SplitMode;
  shares: ExpenseShare[]; // khoản này chi cho ai — >= 1 phần tử

  createdAt: string;
  createdBy: string; // userId
}

// Lịch sử thêm / sửa / xoá khoản chi (trip-budget.md §S10). Chỉ ghi thêm,
// không bao giờ sửa hay xoá dòng lịch sử. `before`/`after` là ảnh chụp các
// trường tiền của khoản chi tại thời điểm đó — đọc được kể cả khi khoản chi đã
// bị xoá hay thành viên đã bị đổi tên.
export type ExpenseHistoryAction = 'create' | 'update' | 'delete';

export type ExpenseSnapshot = Pick<
  Expense,
  'kind' | 'date' | 'category' | 'title' | 'note' | 'budgetNodeId' | 'amount' | 'payerId' | 'splitMode' | 'shares'
>;

export interface ExpenseHistoryEntry {
  id: string;
  tripId: string;
  expenseId: string;
  action: ExpenseHistoryAction;
  at: string; // ISO datetime
  userId: string;
  userName: string; // chụp lại lúc ghi — tài khoản có đổi tên vẫn đọc được
  before?: ExpenseSnapshot; // update / delete
  after?: ExpenseSnapshot; // create / update
}
