# Chi phí — Bước 4 (Dự trù) & 計算 (Quyết toán) — Spec

> **Nguồn spec duy nhất** cho phần chi phí. Bổ sung cho
> `docs/features/trip-board.md` (Lịch trình) — doc đó dừng ở Bước 3 và để
> trống §5.7 Bước 4.
> Bản v2, đã chốt theo feedback PO ngày 2026-09-15. Kế hoạch thực thi nằm ở
> `docs/features/trip-budget-plan.md`.

Hai tính năng, hai thời điểm khác nhau trong vòng đời một chuyến đi:

| | Bước 4 — Dự trù chi phí | 計算 — Chi thực tế & Quyết toán |
|---|---|---|
| Khi nào | **Trước** chuyến đi | **Trong và sau** chuyến đi |
| Ai dùng | Người lên kế hoạch | Cả nhóm |
| Câu hỏi trả lời | *"Chuyến này tốn bao nhiêu một người?"* | *"Ai đã trả gì, giờ ai nợ ai?"* |
| Kết thúc | Có, bấm **Hoàn tất** | Không — ghi tiếp tới khi quyết toán xong |
| Đặt ở | Bước cuối của wizard | Màn riêng `/settlement` |
| Thiết bị chính | Desktop | **Mobile** (ghi ngay tại quầy thanh toán) |

Hai vế khác nhau ở mọi chiều nên **không dùng chung màn hình**, nhưng **dùng
chung 5 loại chi phí, một đơn vị tiền và một danh sách thành viên** — đó là
ba điều kiện để đối chiếu được.

---

## 0. Quyết định gốc (đã chốt)

| # | Quyết định | Lý do |
|---|---|---|
| D1 | **Một đơn vị tiền cho cả chuyến** (`trip.currency`), mặc định `JPY` | Không tỉ giá, không quy đổi, không sai số tích luỹ |
| D2 | **`trip.budgetPlan` là nguồn sự thật** của chi phí dự trù; **bỏ `ItineraryItem.estimatedCost`** | Cây 3 mức + tách NL/TE không nhét vừa một `number` trên item |
| D3 | **計算 là màn riêng** `/settlement`; trip detail chỉ tóm tắt + link | §7.1 |
| D4 | **Thành viên local không cần tài khoản** | Không chặn quyết toán chờ tính năng mời user |
| D5 | Chia tiền có đúng **hai** chế độ: **Chia đều** và **Nhập riêng từng người** | §8 S3 — bỏ chế độ "theo suất/trọng số" |
| D6 | **Trẻ em có suất chi phí riêng, tính ra được từng bé hết bao nhiêu**, nhưng **không tự trả** — suất đó gán cho một người lớn phụ trách, hoặc chia đều cho các người lớn | §8 S2 |
| D7 | Quyết toán **chỉ có phương án thủ quỹ** ở v1 | §8 S5 — bỏ toggle "tối ưu số giao dịch" |
| D8 | **v1 không có ảnh hoá đơn** | §14 Q2 — thêm field optional sau này không phải breaking change |

---

## 1. Khái niệm & từ vựng

Ba con số rất dễ bị gọi nhầm là "budget". Doc này phân biệt cứng:

| Thuật ngữ | Trường | Nghĩa |
|---|---|---|
| **Hạn mức** | `trip.budget: number \| null` | Số tiền user **muốn** không vượt quá. User tự nhập, có thể để trống |
| **Tổng dự trù** | *dẫn xuất* từ `trip.budgetPlan` | Tổng các khoản đã liệt kê ở Bước 4. **Không lưu trong DB** |
| **Đã chi** | `trip.spent: number` | Tổng `Expense` thực tế. Denormalize cho Dashboard / TripCard |

> `trip.budget` hiện đang được dùng mơ hồ. Bước 4 chốt nghĩa của nó là **hạn mức**.

**5 loại chi phí** — dùng chung cho cả dự trù và thực tế:

```ts
export type CostCategory =
  | 'transport'    // Di chuyển
  | 'lodging'      // Khách sạn
  | 'food'         // Ăn uống
  | 'sightseeing'  // Địa điểm (vé vào cửa, trải nghiệm)
  | 'other';       // Khác
```

Suy loại chi phí từ category của item lịch trình (`itemCategory()`,
`trip-board.md` §8) — **chỉ là giá trị mặc định, user đổi được**:

| Item category | → Loại chi phí |
|---|---|
| `hotel` | `lodging` |
| `restaurant` | `food` |
| `attraction` | `sightseeing` |
| `shopping` | `other` |
| `other` / không có | `other` |

Không có luật tự suy ra `transport` — di chuyển hiếm khi là một Place, nên gần
như luôn là khoản user tự tạo. Đây chính là lý do §4 B3 kết luận **không bắt
buộc gắn chi phí với item lịch trình**.

---

## 2. Data model

### 2.1 Bổ sung vào `Trip`

```ts
export type Currency = 'JPY' | 'VND' | 'USD';

export interface Trip {
  // ...giữ nguyên các trường hiện có
  currency: Currency;          // ★ mới — mặc định 'JPY'
  budget: number | null;       // = HẠN MỨC (§1)
  spent: number;               // = Σ Expense kind='expense'
  budgetPlan: BudgetNode[];    // ★ mới — cây chi phí dự trù, mảng phẳng
  treasurerId?: string;        // ★ mới — travelerId của thủ quỹ (S5).
                               // undefined = tự chọn người có số dư lớn nhất
}
```

### 2.2 `BudgetNode`

```ts
export type BudgetPricingMode = 'perPerson' | 'lumpSum';
export type LumpSumSplit = 'perHead' | 'adultsOnly';

export interface BudgetNode {
  id: string;
  parentId: string | null;   // null = mức 1
  category: CostCategory;    // node con luôn kế thừa của node cha
  title: string;             // bắt buộc, <= 80 ký tự
  note?: string;             // <= 100 ký tự (cùng luật với ItineraryItem.note)

  linkedItemId?: string;     // ★ trỏ tới ItineraryItem.id — TUỲ CHỌN
  linkedPlaceId?: string;    // denormalize để còn lấy được giá tham khảo
                             // khi item đã bị xoá khỏi lịch trình

  pricingMode: BudgetPricingMode;
  unitAdult?: number;        // 'perPerson' — đơn giá / người lớn
  unitChild?: number;        // 'perPerson' — đơn giá / trẻ em
  lumpSum?: number;          // 'lumpSum'   — trọn gói
  lumpSumSplit?: LumpSumSplit; // mặc định 'perHead'

  quantity: number;          // >= 1, mặc định 1 — số đêm / số vé / số lượt
  order: number;             // thứ tự trong cùng một parentId
}
```

**Vì sao mảng phẳng có `parentId` chứ không lồng nhau?** Cùng lý do `days[]`
đang phẳng: PATCH nguyên mảng là một thao tác, reorder không phải đi xuyên
cây, và ràng buộc "sâu tối đa 3 mức" là **quy tắc** (`budgetDepth()` validate)
chứ không phải kiểu dữ liệu — vi phạm thì báo lỗi rõ ràng thay vì không
compile được.

### 2.3 `Traveler` — thêm `id`, `isChild`, `guardianId`

```ts
export interface Traveler {
  id: string;             // ★ mới — BẮT BUỘC. Khoá của mọi tham chiếu chia tiền
  userId?: string;        // có khi là thành viên có tài khoản thật
  fullName?: string;
  initials: string;
  colorClass: string;

  isChild?: boolean;      // ★ mới — mặc định false
  guardianId?: string;    // ★ mới — CHỈ khi isChild. travelerId của người lớn
                          // đứng ra trả cho bé này.
                          // undefined = chia đều cho các người lớn (D6)
}
```

> `id` là thay đổi **bắt buộc phải làm trước** 計算. Không thể tham chiếu người
> chi tiền bằng chỉ số mảng: xoá một thành viên là toàn bộ lịch sử chi tiêu
> trỏ sai người, âm thầm và không thể phát hiện.

### 2.4 `Expense` — collection riêng, **không** nằm trong `Trip`

```ts
export type SplitMode = 'equal' | 'exact';     // D5 — đúng hai chế độ
export type ExpenseKind = 'expense' | 'settlement';

export interface ExpenseShare {
  travelerId: string;   // có thể là trẻ em — xem S2
  amount?: number;      // chỉ dùng khi splitMode = 'exact'
}

export interface Expense {
  id: string;
  tripId: string;
  kind: ExpenseKind;         // 'settlement' = một lần trả nợ, xem S6

  date: string;              // ISO date
  category: CostCategory;    // ★ BẮT BUỘC — điều kiện để đối chiếu dự trù
  budgetNodeId?: string;     // tuỳ chọn — đối chiếu tới đúng khoản dự trù
  title: string;
  note?: string;

  amount: number;            // > 0, theo trip.currency
  payerId: string;           // travelerId — ai đã ứng tiền ra

  splitMode: SplitMode;
  shares: ExpenseShare[];    // khoản này chi cho ai — >= 1 phần tử

  createdAt: string;
  createdBy: string;         // userId
}
```

**Vì sao tách khỏi `Trip`?** `trip-board.md` §11 ghi rõ: PATCH nguyên mảng
`days`, **last-write-wins, không có optimistic concurrency**. Chi tiêu là dữ
liệu *nhiều người ghi đồng thời, ngay tại chỗ, từ điện thoại* — đúng kịch bản
mà last-write-wins làm mất dữ liệu. Mỗi `Expense` là một bản ghi độc lập
(POST / PATCH / DELETE riêng) nên hai người ghi cùng lúc không đè nhau.
Đây cũng là lý do v1 **không cần realtime**: xung đột không tồn tại, chỉ cần
nút "Tải lại".

### 2.5b `ExpenseHistoryEntry` — collection `expenseHistory` (S10)

```ts
export type ExpenseHistoryAction = 'create' | 'update' | 'delete';
export type ExpenseSnapshot = Pick<Expense,
  'kind' | 'date' | 'category' | 'title' | 'note' | 'budgetNodeId' | 'amount' | 'payerId' | 'splitMode' | 'shares'>;

export interface ExpenseHistoryEntry {
  id: string;
  tripId: string;
  expenseId: string;          // vẫn giữ sau khi khoản chi bị xoá
  action: ExpenseHistoryAction;
  at: string;                 // ISO datetime
  userId: string;
  userName: string;           // chụp lại lúc ghi
  before?: ExpenseSnapshot;   // update / delete
  after?: ExpenseSnapshot;    // create / update
}
```

Chỉ ghi thêm (append-only), không sửa / xoá dòng lịch sử.

### 2.5 Số tiền & làm tròn

| Currency | Đơn vị nhỏ nhất | Lưu | Nhập |
|---|---|---|---|
| `JPY` | 1 | số nguyên | không có phần thập phân |
| `VND` | 1 | số nguyên | không có phần thập phân, gợi ý bước 1.000 |
| `USD` | 0.01 | **số nguyên cents** | 2 chữ số thập phân |

Mọi phép tính nội bộ chạy trên **số nguyên đơn vị nhỏ nhất**, chỉ format lúc
render. Đây là điều kiện để các bất biến ở §8 luôn đúng.

---

# PHẦN A — BƯỚC 4: DỰ TRÙ CHI PHÍ

## 3. Công thức tính

### 3.1 Node lá

| `pricingMode` | Tổng | Suất / người lớn | Suất / trẻ em |
|---|---|---|---|
| `perPerson` | `qty × (unitAdult × A + unitChild × C)` | `qty × unitAdult` | `qty × unitChild` |
| `lumpSum` + `perHead` | `qty × lumpSum` | `tổng / (A + C)` | `tổng / (A + C)` |
| `lumpSum` + `adultsOnly` | `qty × lumpSum` | `tổng / A` | `0` |

`A = party.adults`, `C = party.children`.

**Bất biến (phải có test):** `suấtNL × A + suấtTE × C === tổng` với cả ba dòng.

⚠ **Suất đầu người là số dẫn xuất và KHÔNG được làm tròn khi tính.** Một khoản
trọn gói ¥1.000 chia 3 người là 333,33 mỗi người — làm tròn ngay ở đây thì
`333 × 3 = 999` và bất biến trên vỡ. Không có cặp số nguyên nào thoả
`a × A + c × C = tổng` cho mọi trường hợp, nên `nodePerHead` / `planPerHead`
trả về số thực chính xác, và **UI làm tròn đúng một lần ở con số cuối cùng**
(hiện `≈` khi có phần lẻ). Tiền thật được dự trù — `nodeTotal` — vẫn luôn là
số nguyên. *(Phát hiện lúc làm Đợt 6.)*

**Vì sao cần hai chế độ giá?** Rất nhiều khoản không chia theo đầu người:
thuê ô tô 3 ngày, một phòng khách sạn 4 người ở, taxi cả nhóm. Chỉ có
`perPerson` thì user buộc phải tự chia nhẩm rồi nhập — sai số và mất dấu số
gốc. `lumpSumSplit: 'adultsOnly'` cho khoản trẻ em không dùng (rượu bia, vé
người lớn).

**`quantity` dùng cho gì:** số đêm khách sạn, số vé, số bữa. Cho nhập
`¥8,000 × 3 đêm` thay vì nhẩm ra `¥24,000` — đổi lịch từ 3 lên 4 đêm chỉ phải
sửa một số.

### 3.2 Node cha

```
total(cha) = Σ total(con)
```

Node có ≥ 1 con: **mọi ô nhập giá bị khoá** (read-only, nền xám), thay bằng
dòng tổng + chú thích *"= tổng của N mục con"*. Không có ngoại lệ — cho phép
nhập thêm ở cha thì tổng của cha không còn là một sự thật duy nhất.

### 3.3 Tổng toàn chuyến

```
tổngDựTrù = Σ total(node mức 1)
tổng/NL   = Σ suấtNL(node LÁ)
tổng/TE   = Σ suấtTE(node LÁ)
```

Chỉ cộng **node lá** khi tính suất đầu người — cộng cả cha lẫn con là đếm
trùng gấp đôi.

---

## 4. Quy tắc nghiệp vụ Bước 4

### B1 — Độ sâu và cấu trúc
- Tối đa **3 mức** (mức 1 = nhóm lớn, mức 3 = chi tiết nhất).
- `Thêm mục con` **disabled ở mức 3**, tooltip *"Đã đạt độ sâu tối đa"*.
- `category` chỉ đổi được ở **mức 1**; con luôn kế thừa của cha. Đổi category
  node mức 1 thì cả nhánh chuyển nhóm cùng lúc.
- Xoá node = xoá **cả nhánh**, confirm ghi rõ số mục con và tổng tiền sẽ mất.

### B2 — Chuyển lá ↔ cha (không được làm mất tiền của user)
- **Lá đang có tiền → thêm con đầu tiên**: tự sinh node con đầu tiên mang tên
  của node cha và **giữ nguyên số tiền cũ**. Cha lập tức đúng `= tổng con`.
- **Xoá con cuối cùng**: cha trở lại là lá ở chế độ `lumpSum` **với giá trị 0**,
  ô nhập trống sẵn sàng gõ.

> **Sửa so với bản đầu** *(phát hiện lúc làm Đợt 6)*: bản đầu ghi cha "giữ
> nguyên tổng cuối cùng của các con" kèm toast *"giữ ¥24.000"*. Cách đó mâu
> thuẫn với chính B1 — hộp thoại vừa báo *"N mục con, tổng ¥24.000 sẽ bị xoá"*
> mà xoá xong số tiền vẫn nằm nguyên ở dòng cha thì đó là tiền tự mọc lại.
> Chỉ có một cách hiểu đứng vững: **xoá một khoản là xoá số tiền của khoản đó**.
> Hệ quả: thêm con rồi xoá con **không** phải phép đối xứng — xoá mục con mang
> tiền thì mất tiền đó, đúng như user vừa xác nhận.

### B3 — Quan hệ với lịch trình: **mềm, một chiều, không bắt buộc**

Lý do nghiệp vụ: những khoản đắt nhất — vé máy bay, JR Pass, bảo hiểm, sim,
hành lý, quà — **không phải là điểm đến** và không bao giờ nằm trong lịch
trình. Bắt buộc gắn item là làm cho phần đắt nhất không nhập được.

1. Mở Bước 4, mọi item của lịch trình (cả `days[]` lẫn `unscheduledItems`)
   hiện dưới dạng **gợi ý** — hàng mờ ở cuối nhóm tương ứng, header *"Từ lịch
   trình — chưa dự trù (3)"*. **Gợi ý chưa phải `BudgetNode`**: không có trong
   DB, không tính vào tổng.
2. Nhập số vào ô inline của hàng gợi ý (hoặc bấm `＋`) → sinh `BudgetNode` thật
   với `linkedItemId`, `category` suy theo bảng §1.
3. Nút **`Thêm tất cả mục của lịch trình`** để tạo hàng loạt một lần.
4. User tạo node **không gắn item** thoải mái — đây là đường chính, không phải
   ngoại lệ.
5. **Một item ↔ tối đa một node.** Muốn tách nhỏ thì tạo node con dưới nó.
6. Item bị **xoá khỏi lịch trình**: node **giữ nguyên**, `linkedItemId` bị xoá,
   hàng hiện badge *"Mục đã bị xoá khỏi lịch trình"* + nút gỡ.
   **Không bao giờ tự xoá tiền của user.**
7. Item **thêm mới** ở Bước 2 sau khi đã làm Bước 4 → lần sau vào Bước 4 nó lại
   xuất hiện ở dạng gợi ý. Quy tắc **idempotent** giống R5.

### B4 — Giá tham khảo (placeholder)
- Nguồn: `Place.price`. **`Place` thêm hai trường**:
  `priceCurrency?: Currency` (**mặc định `'JPY'`** cho toàn bộ catalog hiện có)
  và `priceUnit?: 'perPerson' | 'perNight' | 'perGroup'`.
- Chỉ hiện làm **placeholder trong ô nhập** khi `priceCurrency === trip.currency`.
  Khác đơn vị → chú thích nhỏ dưới tên *"Tham khảo: ¥2,000/người"*, không chạm
  vào ô nhập.
- **Placeholder không tự điền.** Có nút nhỏ `Dùng giá này`.
  Lý do UX: tự điền thì user không còn phân biệt được số nào mình đã duyệt và
  số nào máy đoán — mà đây là màn tiền.

### B5 — Đổi đơn vị tiền
- Đổi `trip.currency` **không quy đổi tỉ giá** (D1), nhưng **bắt buộc quy đổi
  đơn vị nhỏ nhất**: USD lưu theo cent, JPY/VND không. Một khoản lưu `123500`
  đang là `$1.235,00`; giữ nguyên con số khi sang JPY sẽ thành `¥123.500` — sai
  đúng 100 lần. `rescalePlan()` xử lý cả cây, `budget` và `budgetPerPerson`.
  *(Lỗi này lọt qua tới lúc rà soát ngày 2026-09-15.)*
- Cùng số chữ số thập phân → dialog: *"Các số tiền đã nhập giữ nguyên giá trị,
  chỉ đổi ký hiệu."*
- Trip đã có `Expense` → **chặn** đổi đơn vị; lịch sử đã ghi theo đơn vị cũ.
  Tooltip ghi rõ lý do.
- Đổi từ `USD` (2 số lẻ) sang `JPY`/`VND` (0) → làm tròn, cảnh báo trước số mục
  bị ảnh hưởng.

### B6 — Hạn mức: cả chuyến hoặc mỗi người

Hai cách đặt, và **đúng một trong hai trường khác `null`**:

| Trường | Nghĩa | Dùng khi |
|---|---|---|
| `budget` | hạn mức cho **cả chuyến** | đi gia đình, gộp chung một túi tiền |
| `budgetPerPerson` | hạn mức **mỗi người** | đi bạn bè, ai lo phần nấy |

`budgetTotal(trip)` là **nguồn duy nhất** để so sánh với tổng dự trù và đã chi;
không chỗ nào được đọc thẳng `trip.budget`. Khi đặt theo đầu người, tổng =
`budgetPerPerson × (adults + children)` và UI in thẳng phép nhân ra
(*"× 5 người = ¥350.000"*) để user không phải tự nhẩm.

**Vì sao lưu đúng con số user gõ chứ không lưu cả hai:** ¥100.000 chia 3 người
là 33.333,33; lưu cả hai rồi chia-nhân qua lại sẽ trôi số. `switchBudgetBasis`
làm tròn **đúng một lần** lúc đổi cách nhập, và đổi qua đổi lại không trôi thêm.
Số người đổi ở Bước 1 thì tổng tự đổi theo — đó chính là lý do lưu đơn giá.

- Không bắt buộc. Có hạn mức → thanh tiến trình: `≤ 80%` `mint`, `80–100%`
  `amber`, `> 100%` đỏ, kèm số vượt. `budgetTotal === 0` là trạng thái vừa bấm
  "Đặt hạn mức", chưa gõ số — **không** coi là vượt.
- Có nút **Bỏ hạn mức** để quay lại trạng thái chưa đặt.
- **Vượt hạn mức không chặn lưu.** Đây là số liệu, không phải validation.
- Bước 4 **không** là điều kiện để `status` lên `confirmed` (đã chốt, §14 Q6).

### B7 — `party` phải khớp `travelers` (sửa 2026-10-02)
`party` = số suất để chia tiền dự trù; `travelers[]` = người thật có tên.
Trước đây được phép lệch và chỉ cảnh báo mềm ở Bước 4. Giờ **chặn lưu ở Bước 1**
(cả màn tạo mới lẫn màn sửa) khi:

- `travelers.filter(t => !t.isChild).length !== party.adults`, hoặc
- `travelers.filter(t => t.isChild).length !== party.children`.

Thành viên đã rời nhóm (`leftGroup`) **vẫn được tính** — họ vẫn là một suất của
chuyến đi. Khi lệch: lỗi ngay dưới ô số người kèm nút sửa nhanh *"Cập nhật theo
danh sách thành viên"*. Thêm/xoá thành viên lúc số đang khớp thì `party` tự đi
theo. Cảnh báo lệch ở Bước 4 đã bỏ. Dữ liệu cũ đang lệch được sửa bằng
`scripts/migrate-ownership.mjs` (thêm thành viên tạm, giữ nguyên `party` để
không đổi số dự trù).

### B8 — Lưu / dirty
Theo R10 của `trip-board.md`: footer `Huỷ` / `Lưu tạm` / **`Hoàn thành`**
(Bước 4 là bước cuối). PATCH gửi `{ currency, budget, budgetPlan }`.

### B9 — Tiến độ (sửa R11 của `trip-board.md`)
```ts
// Step 4 — thay điều kiện cũ dựa trên estimatedCost
if (trip.budget !== null || trip.budgetPlan.length > 0) done++;
```
Đoạn thứ 4 của `TripProgressBar` **thôi vẽ mờ**.

---

## 5. Màn hình Bước 4

Route `/itinerary/:tripId/edit/4`. Bố cục 2 cột, giữ đúng ngôn ngữ của Bước 2.

### 5.1 Thanh tổng (sticky, trên cùng)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Đơn vị: [¥ JPY ▾]   Hạn mức: [ 300,000 ]                             │
│                                                                      │
│   Tổng dự trù        / người lớn        / trẻ em                     │
│   ¥284,000           ¥96,000            ¥46,000                      │
│   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░  95% hạn mức · còn ¥16,000                   │
└──────────────────────────────────────────────────────────────────────┘
```

Ví dụ trên ứng với `party = 2 NL + 2 TE`, thoả bất biến §3.1:
`96,000 × 2 + 46,000 × 2 = 284,000`.

- Cột **/ trẻ em ẩn hoàn toàn** khi `party.children === 0` — ẩn cả ô nhập
  `unitChild` ở mọi hàng, không chỉ ẩn cột tổng.
- Không có hạn mức → thay thanh bằng link *`＋ Đặt hạn mức`*.

### 5.2 Cột trái — cây chi phí

`CategoryFilterChips` dùng lại của Bước 2 nhưng render **5 loại chi phí**:
`Tất cả · Di chuyển · Khách sạn · Ăn uống · Địa điểm · Khác`, mỗi chip kèm
tổng tiền của nhóm — chip vừa là bộ lọc vừa là bảng tổng, không tốn thêm chỗ.

Ví dụ dưới đây: `party = 2 người lớn + 2 trẻ em`.

```
▾ 🏨 Khách sạn                                              ¥97,200
  ▾ Hotel Granvia Kyoto    [Ngày 1]   = tổng của 2 mục con  ¥73,200
      ├ Phòng twin       trọn gói  ¥24,000        × 3 đêm   ¥72,000
      └ Thuế lưu trú     /người    ¥200 NL  ¥0 TE × 3 đêm    ¥1,200
  └ Khách sạn Osaka      /người    ¥8,000 NL  ¥4,000 TE × 1 ¥24,000

  ＋ Thêm khoản chi phí

  Từ lịch trình — chưa dự trù (1)
  ○ Dormy Inn Namba        [Ngày 4]      [ ¥_____ ]   ⓘ ¥6,500/đêm
```

Kiểm chứng ba công thức §3 trên chính ví dụ này: `Phòng twin` trọn gói
`24,000 × 3 = 72,000`; `Thuế lưu trú` theo đầu người `3 × (200×2 + 0×2) = 1,200`;
cha `Hotel Granvia = 72,000 + 1,200 = 73,200`;
`Khách sạn Osaka = 1 × (8,000×2 + 4,000×2) = 24,000`; nhóm `= 97,200`.

Mỗi hàng, trái sang phải:
`[chevron] [tên] [chip ngày nếu có link] … [cách tính] [số tiền] [giá TE] [SL] [= tổng] [⋯]`

**Sửa khi dựng Đợt 7:** bản đầu tách `pricingMode` và `lumpSumSplit` thành hai ô
riêng, và ô "chia cho" rơi đúng vào cột **Trẻ em** — tiêu đề cột ghi "Trẻ em"
mà bên dưới là một select ghi "Cả nhóm". Giờ gộp thành **một** ô "cách tính"
với ba lựa chọn — `Trọn gói` · `Trọn gói (chỉ NL)` · `Theo người` — nên cột Trẻ
em luôn chỉ có một nghĩa: giá của trẻ em (khoản trọn gói hiện `—`).

Menu `⋯`: `Thêm mục con` · `Nhân bản` · `Đổi loại chi phí` (chỉ mức 1) · `Xoá`.

- Hàng gợi ý (`○`) nền mờ, nhập số là thành node thật ngay.
- `ⓘ` = giá tham khảo từ `Place.price`, hover hiện nguồn.
- Bấm chip ngày → mở panel phải ở chi tiết item đó (`ItineraryPlaceDetailPane`).

### 5.3 Cột phải — panel phân tích

- **Thanh xếp chồng ngang + danh sách gán nhãn trực tiếp** cho tỉ trọng 5 loại.

  *Đổi so với bản đầu (viết là "biểu đồ tròn"), lý do từ skill `dataviz`:* dữ
  liệu phần-trên-tổng với tên nhóm dài, nằm trong cột hẹp 340px → thanh ngang
  đọc nhanh hơn và không cần chú giải tách rời; biểu đồ tròn ở bề ngang này chỉ
  còn là 5 lát nhỏ cộng một chú giải bên cạnh.

  **Màu 5 loại không dùng lại bộ category của Discover** — bộ đó trượt validator
  (`ocean ↔ mint` ΔE 13,3, dưới ngưỡng 15 nên cả người nhìn màu bình thường cũng
  khó phân biệt; `idea` gần như không có sắc độ). Bộ đã kiểm: `transport`
  violet-dark, `lodging` mint-dark, `food` coral-dark, `sightseeing` ocean,
  `other` idea-dark — CVD ΔE 9,2 · normal-vision ΔE 17,0 · tương phản nền ≥ 3:1.
  `other` cố ý để xám: đó là nhóm hứng phần đuôi.
- **Bảng theo ngày**: tổng dự trù mỗi ngày (chỉ tính node có `linkedItemId`
  trỏ tới item của ngày đó) + dòng *"Không gắn ngày cụ thể: ¥X"*.
- **Cảnh báo**: *"4 mục trong lịch trình chưa được dự trù"* + link cuộn tới.

### 5.4 Mobile
Dùng lại `MobileColumnTabs` của Bước 2. Cây rút gọn: ẩn cột SL và chế độ giá
vào một sheet khi bấm vào hàng; giữ lại tên + tổng. Không có kéo thả — thứ tự
ở đây không mang nghĩa nghiệp vụ.

---

# PHẦN B — 計算: CHI THỰC TẾ & QUYẾT TOÁN

## 6. Vấn đề nghiệp vụ

Sau chuyến đi, nhóm 5 người có ~40 khoản chi do 4 người khác nhau trả. Câu hỏi
duy nhất cần trả lời: **ai chuyển cho ai bao nhiêu, và không ai phải tin vào
trí nhớ của ai.**

Bốn thứ phải có:
1. **Sổ chi tiêu** — ghi nhanh, tại chỗ, trên điện thoại.
2. **Chia tiền linh hoạt** — một người trả cho cả nhóm nhưng mỗi người ăn một
   món giá khác nhau (§8 S3).
3. **Đối chiếu dự trù** — tiêu hụt hay lố, ở khoản nào.
4. **Quyết toán qua thủ quỹ** — danh sách chuyển tiền, sao chép được vào chat.

## 7. Kiến trúc màn hình

### 7.1 Vì sao là màn riêng, và vì sao vẫn có lối vào từ trip detail

**Nhét toàn bộ vào trip detail: nặng.** Màn `/itinerary/:id` đã là màn nặng
nhất app: 3 tab, một tab là FullCalendar, cộng panel chi tiết địa điểm với
scroll-spy. Thêm form ghi chi tiêu + bảng đối chiếu + bảng quyết toán vào đó là
trộn hai mục đích — *lập kế hoạch* (đọc, ngắm, desktop) và *ghi chép kế toán*
(nhập nhanh, lặp lại, làm khi đang đứng ngoài đường).

**Tách ra bị lặp: chỉ khi dựng hai UI.** Ở đây là **một workspace, hai cửa vào**:

```
/settlement                 ← nav item đã có sẵn (nav.settlement)
   Hub: TỔNG KẾT CỦA BẠN cộng dồn mọi chuyến
   + danh sách TẤT CẢ chuyến đi, có bộ lọc
   + FAB "＋ Ghi chi tiêu" chọn chuyến ngay tại đây
        │
        ├── /settlement/:tripId   ← workspace 1 chuyến (3 tab)
        │         ▲
/itinerary/:id ── tab "Chi phí" ──┘
   chỉ hiển thị: tóm tắt dự trù (đã có) + 3 số thực tế + "Mở sổ chi tiêu →"
```

- `/itinerary/:id` tab Chi phí **không dựng lại gì**: render
  `<TripCostSummary trip expenses />` — đúng một component dùng chung với hub.
  Ba số: *Đã chi · So với dự trù · Số dư của bạn*. Rồi một nút điều hướng.
- `/settlement` (hub) làm thứ trip detail không bao giờ làm được: **cộng dồn số
  dư của bạn qua nhiều chuyến**.

### 7.2 Route

| URL | Màn |
|---|---|
| `/settlement` | Hub — tổng kết của bạn + danh sách chuyến (có lọc) |
| `/settlement/:tripId` | Workspace 1 chuyến — 4 tab |
| `/settlement/:tripId/new` | Form ghi chi tiêu (full-screen mobile / dialog desktop) |

Nav item `nav.settlement` hiện disabled + "Sắp có" → bật lên.

### 7.3 Bốn tab của workspace

| Tab | Nội dung | Thiết bị chính |
|---|---|---|
| **Nhật ký chi** | Danh sách chi tiêu theo ngày, filter, FAB thêm | Mobile |
| **Đối chiếu** | Dự trù vs thực tế theo 5 loại | Desktop |
| **Quyết toán** | Chi phí từng người + số dư + ai trả thủ quỹ | Cả hai |
| **履歴** | Lịch sử thêm / sửa / xoá khoản chi (S10) | Cả hai |

Thao tác tiền thất bại (xoá khoản chi, "đã trả", đổi thủ quỹ) hiện snackbar lỗi
`settlement.actionError` — không im lặng.

---

## 8. Quy tắc nghiệp vụ 計算

### S1 — Ghi một khoản chi
Bắt buộc: `amount`, `category`, `payerId`, `shares` (≥ 1 người), `date`.
Tuỳ chọn: `title` (mặc định = tên loại chi phí), `budgetNodeId`, `note`.

> **`category` bắt buộc** — không có nó thì tab Đối chiếu không tồn tại, và đó
> là nửa giá trị của tính năng.

`budgetNodeId` **không** bắt buộc: lúc đang trả tiền không ai muốn đi tìm đúng
dòng trong cây dự trù. Loại chi phí là đủ để đối chiếu ở mức nhóm; gắn node cụ
thể là tuỳ chọn để đối chiếu mức 2.

### S2 — Trẻ em: **có suất riêng, không tự trả** (D6)

Ba luật, theo đúng thứ tự:

1. **Trẻ em nằm trong `travelers[]`** với `isChild: true` và **có tên**. Đây là
   điều kiện để trả lời *"bé nào hết bao nhiêu tiền"*.
2. Trẻ em **xuất hiện trong danh sách "chia cho ai"** của một khoản chi và
   **được phân bổ một suất thật** (giai đoạn 1 của S3). Suất này hiện ở bảng
   *"Chi phí theo từng người"* — đây là con số PO cần.
3. Suất đó **không đi vào số dư của bé**, mà được **chuyển sang người lớn**
   (giai đoạn 2 của S3):
   - có `guardianId` hợp lệ → **cộng nguyên vào người lớn đó**;
   - không có → **chia đều cho các người lớn có mặt trong `shares` của chính
     khoản đó**; nếu khoản đó không có người lớn nào (ví dụ "vé vào cửa trẻ
     em") → chia đều cho **tất cả người lớn của chuyến**.

Sau bước 3, `balance` của mọi trẻ em **luôn bằng 0** — bé không bao giờ xuất
hiện trong bảng "ai chuyển cho ai". Lý do: trẻ em không có tài khoản ngân hàng;
một dòng "Bi chuyển cho Minh ¥12,000" là dòng không ai thực hiện được.

`guardianId` đặt ở **Traveler** (mặc định cho mọi khoản), không đặt ở từng
`Expense` — chọn lại người phụ trách ở mỗi lần ghi chi tiêu là thao tác thừa
lặp 40 lần một chuyến.

### S3 — Chia tiền: **Chia đều** hoặc **Nhập riêng từng người** (D5)

> Đúng tình huống PO nêu: một người trả cho cả nhóm nhưng tiền ăn mỗi người
> một khác.

Thuật toán chạy **hai giai đoạn**, tách bạch vì chúng trả lời hai câu hỏi khác
nhau:

**Giai đoạn 1 — `allocateExpense()`: khoản này chi cho ai, mỗi người bao nhiêu**
(kể cả trẻ em)

| `splitMode` | Cách chia |
|---|---|
| `equal` | `amount / số người được chọn`, chia đều tuyệt đối |
| `exact` | dùng đúng số user nhập cho từng người; **Σ phải === `amount`** |

**Quy tắc phần dư** (bắt buộc — `¥1,000 / 3` không chia hết): chia phần nguyên
trước, phần dư `r` đơn vị nhỏ nhất phát **1 đơn vị cho mỗi người theo thứ tự
`travelerId` tăng dần** tới hết `r`.

```
¥1,000 chia 3 người  →  334 + 333 + 333 = 1,000  ✓
```

**Giai đoạn 2 — `toPayableShares()`: ai thật sự phải trả tiền**
Chuyển suất của trẻ em sang người lớn theo S2.3. Phần dư khi chia lại dùng
đúng quy tắc trên.

**Hai bất biến, phải có property test:**
- `Σ allocateExpense() === amount`
- `Σ toPayableShares() === amount`, **và mọi trẻ em = 0**

**UI chuyển giữa hai chế độ** — chỗ này quyết định tính năng có dùng được không:

```
Chia cho     ● Chia đều     ○ Nhập riêng
   ✓ Bạn                              ¥1,050
   ✓ Minh                             ¥1,050
   ✓ Lan                              ¥1,050
   ✓ Bi  👶 → Lan chi trả             ¥1,050
                                      ───────
                                      ¥4,200 ✓
```

- Bấm **Nhập riêng** → các ô **điền sẵn bằng số của chế độ chia đều**, user chỉ
  sửa những người khác đi. Không bắt gõ lại từ đầu 4 con số.
- Ở chế độ Nhập riêng luôn hiện dòng *"Còn ¥X chưa phân bổ"* + nút
  **`Dồn phần còn lại vào ▾`**. **Chặn lưu khi `Σ ≠ amount`**, hiện rõ chênh lệch.
- Bỏ chọn một người ở chế độ Chia đều → tính lại ngay cho những người còn lại.
- Trẻ em hiện badge 👶 kèm *"→ <tên người lớn> chi trả"* hoặc *"→ chia đều cho
  người lớn"*, để user thấy hệ quả ngay lúc ghi chứ không phải đợi tới lúc
  quyết toán.

> **Đã bỏ chế độ "theo suất/trọng số"** (`shares: number`) có trong bản v1 của
> doc này. `exact` biểu diễn được mọi thứ nó biểu diễn được, còn ba lựa chọn ở
> một màn nhập nhanh trên điện thoại là một lựa chọn thừa.

### S4 — Số dư (balance)

```
balance(p) = Σ amount các Expense do p ứng ra  −  Σ payableShare của p
```

- `balance > 0` → p đã ứng ra, **được nhận lại**.
- `balance < 0` → p **còn nợ**.
- **Bất biến: `Σ balance(p) = 0`**, và `balance(trẻ em) = 0`.

### S5 — Quyết toán qua **thủ quỹ** (D7)

1. Thủ quỹ mặc định = người có `balance` **lớn nhất** (ứng ra nhiều nhất).
   Đổi được bằng dropdown; lựa chọn lưu ở **`trip.treasurerId`** để cả nhóm
   nhìn thấy cùng một người, không phải state cục bộ của từng máy.
2. Mọi người `balance < 0` chuyển cho thủ quỹ đúng `|balance|`.
3. Thủ quỹ chuyển cho mọi người `balance > 0` (trừ chính mình) đúng `balance`.

Số giao dịch = số người có `balance ≠ 0`, trừ thủ quỹ.

Ưu điểm không nằm ở toán mà ở **xã hội**: một người đứng ra gom, ai cũng chỉ
phải nhớ một số tài khoản, và không có cảnh *"tôi phải chuyển tiền cho một
người tôi chưa từng ăn chung"*.

**Bất biến:** áp dụng hết danh sách chuyển tiền ⇒ mọi `balance = 0`.

> Thuật toán "tối ưu số giao dịch" (greedy ghép người nợ nhiều nhất với người
> nhận nhiều nhất) **không làm ở v1**. Ghi lại ở đây để không phải nghĩ lại:
> nó cho ít giao dịch hơn nhưng sinh chuỗi A→B→C khó theo dõi trong nhóm chat.

### S6 — "Đã trả" ghi thành `Expense`, **không phải cờ trạng thái**

Mỗi dòng quyết toán có nút `Đã trả` → tạo một `Expense` mới với
`kind: 'settlement'`, `payerId` = người trả, `shares` = `[{ người nhận, amount }]`,
`splitMode: 'exact'`. Số dư hai bên tự về 0.

**Vì sao không lưu cờ `isPaid` trên từng dòng?** Dòng quyết toán là *dẫn xuất*:
chỉ cần ai đó ghi thêm một bữa ăn là cả bảng tính lại và cờ cũ trỏ vào một dòng
không còn tồn tại. Ghi thành giao dịch thì lịch sử là sự thật duy nhất, không
bao giờ lệch, và hoàn tác bằng cách xoá bản ghi đó.

`kind: 'settlement'` **không tính** vào `trip.spent`, không vào tab Đối chiếu,
không vào bảng "chi phí theo từng người" — nó là chuyển tiền nội bộ, không phải
chi tiêu mới.

Mọi `balance === 0` → banner *"Đã quyết toán xong"* + gợi ý đổi `trip.status`
sang `done`. (Trạng thái `settling` có sẵn trong `TripStatus` chính là chỗ dành
cho giai đoạn này — trước nay chưa có gì dùng tới.)

### S7 — Đối chiếu dự trù vs thực tế

Mức 1 — theo 5 loại chi phí:

| Loại | Dự trù | Thực tế | Chênh lệch | |
|---|---|---|---|---|
| Di chuyển | ¥40,000 | ¥46,500 | **+¥6,500 (+16%)** | ▓▓▓▓▓▓▓▓▓░ |
| Khách sạn | ¥97,200 | ¥97,200 | ±0 | ▓▓▓▓▓▓▓▓░░ |
| Ăn uống | ¥60,000 | ¥38,200 | −¥21,800 (−36%) | ▓▓▓▓░░░░░░ |

- Mở rộng một loại → đối chiếu tới từng `BudgetNode` qua `budgetNodeId`; chi
  tiêu không gắn node gom vào dòng *"Khác trong nhóm này"*.
- Cảnh báo khi một loại **vượt > 20%**.
- Dòng cuối: tổng · so với hạn mức · **thực chi / người** (chia theo `party`,
  để so thẳng với con số dự trù/người ở Bước 4).
- `planned = 0` ⇒ `diffRatio = null`, hiện `—`, **không chia cho 0**.

### S8 — `trip.spent`
Mỗi lần POST/PUT/DELETE một `Expense` (`kind='expense'`) thì PATCH lại
`trip.spent` = tính lại từ đầu trên danh sách hiện tại. Dashboard và `TripCard`
đọc số này mà không phải tải toàn bộ chi tiêu.
- **Best-effort**: khoản chi đã lưu rồi thì lỗi ở bước này chỉ ghi console, không
  ném ra — nếu ném, form tưởng lưu thất bại, người dùng bấm lại → nhân đôi khoản
  chi. Lần ghi kế tiếp tự khớp lại.
- Các thao tác ghi dựng danh sách kế tiếp từ bản mới nhất (`ref`), không từ
  mảng đã chụp trong closure — hai thao tác chồng nhau không làm mất dòng.
- Sửa khoản chi dùng **PUT** (ghi đè cả bản ghi, giữ `createdAt`): bỏ trống ghi
  chú / bỏ gắn khoản dự trù thì field đó thật sự mất. PATCH của json-server chỉ
  trộn thêm.

### S9 — Thành viên local (D4)
- Thêm người vào `travelers[]` chỉ bằng **tên** (`id` sinh mới, `userId`
  undefined, `initials` + `colorClass` tự suy). Có checkbox **"Là trẻ em"** và,
  khi tích, ô chọn **"Người chi trả"** (`guardianId`, để trống = chia đều).
- Có tài khoản thật sau này → chỉ gắn `userId` vào bản ghi đã có, lịch sử chi
  tiêu giữ nguyên.
- **Không cho xoá** traveler đã xuất hiện trong bất kỳ `Expense` nào — chỉ cho
  đánh dấu *"Đã rời nhóm"* (ẩn khỏi danh sách chọn mới, giữ nguyên lịch sử).
  Xoá là làm hỏng dữ liệu quá khứ một cách âm thầm.
- Xoá một người lớn đang là `guardianId` của trẻ nào đó → trẻ đó về mặc định
  "chia đều cho các người lớn", có toast báo.
- Thành viên đã có trong khoản chi cũng **không đổi được người lớn ⇄ trẻ em**
  (trẻ không ứng tiền: đổi một người trả tiền thành trẻ là chuyển số dư của họ
  sang người giám hộ và khoản chi đó không sửa được nữa).
- Chỉ **chủ trip** xoá được thành viên (`trip-board.md` R14).

### S10 — Lịch sử khoản chi (`expenseHistory`)
- Mỗi lần thêm / sửa / xoá một `Expense` (kể cả giao dịch quyết toán "đã trả")
  ghi một `ExpenseHistoryEntry`: ai (`userId` + tên chụp lại), lúc nào, ảnh chụp
  trước / sau. Sửa mà không đổi gì (bấm Lưu suông) thì không ghi.
- Best-effort như S8: không ghi được lịch sử thì khoản chi vẫn được lưu, chỉ
  cảnh báo console. Không có collection trên server (chưa chạy migration) → tab
  履歴 báo lỗi kèm nút thử lại, các tab khác vẫn chạy.
- Tab **履歴**: nhóm theo ngày (giờ địa phương), mới nhất trước. Mỗi dòng: icon
  thêm / sửa / xoá, "<người> が支出を変更 · <tên> <số tiền>", giờ. Dòng sửa liệt
  kê từng trường đổi `cũ → mới`: 金額, 支出名, 費目, 日付, 支払った人, 分担 (chế độ +
  người, kèm số nếu nhập riêng), メモ, 予算項目. Đổi thứ tự người chia không tính
  là sửa. Thành viên đã bị xoá hiện "（削除されたメンバー）".
- Giao dịch quyết toán lưu `title: 'settlement'` — đó là mã nội bộ, **không bao
  giờ** in ra UI. Lịch sử (và hộp thoại xoá) hiện "người trả → người nhận"
  (`settlement.history.settlementTitle`) theo ngôn ngữ đang chọn.
- Người thực hiện = tài khoản đang đăng nhập lúc ghi (`userId` + `fullName`).
  Dữ liệu cũ có `createdBy` là tài khoản không xem được trip (sinh từ seed /
  migrate trước khi có R14) → `node scripts/fix-expense-creators.mjs` gán lại cho
  chủ trip, cả trên `expenses` lẫn `expenseHistory`. `dbSeed.test.ts` khoá luật
  "người ghi khoản chi luôn xem được trip đó".
- Hàm thuần: `changedExpenseFields(before, after)` (`settlement/utils/expenseHistory.ts`).

---

## 9. Màn hình 計算

### 9.1 Hub `/settlement`

Hub liệt kê **tất cả chuyến đi**, không chỉ chuyến đã có chi tiêu — user phải
vào được nhanh để *bắt đầu* ghi chi phí thực tế cho một chuyến còn trắng.
Thứ tự và bộ lọc lo phần "đừng để trip cũ che mất trip đang đi".

```
┌─ TỔNG KẾT CỦA BẠN ──────────────────────────────────────────┐
│  Bạn còn nợ            Bạn được nhận         Số dư           │
│  ¥3,200                ¥9,820                +¥6,620         │
│  → Minh ¥3,200 (Hokkaido)   ← Minh ¥9,820 (Kyoto)            │
└─────────────────────────────────────────────────────────────┘

[ Tất cả ] [ Đang đi ] [ Chưa quyết toán xong ] [ Đã xong ]   2026 ▾  🔍
                                                   ＋ Ghi chi tiêu

┌───────────────────────────────────────────────────────────────┐
│ ● Kyoto - Osaka  14–18/09  ¥182,400 / ¥284,000  [Đang quyết toán] │
│                     ▓▓▓▓▓▓░░░░ 64%     Bạn được nhận ¥9,820   │
├───────────────────────────────────────────────────────────────┤
│ ○ Hokkaido mùa đông  02–06/12   Chưa có chi tiêu              │
│                      Dự trù ¥210,000      [ Bắt đầu ghi chi ] │
└───────────────────────────────────────────────────────────────┘
```

- **Sắp xếp mặc định**: chuyến `ongoing` → `settling` → sắp khởi hành →
  đã xong. Chuyến đang đi luôn ở trên cùng, vì đó là chuyến đang phát sinh chi.
- **Bộ lọc tiền tệ** (2026-10-02): tab JPY / USD / VND ở thống kê "あなたの支出"
  cũng là bộ lọc danh sách trip bên dưới, giống select năm. Mở màn: chưa lọc
  (danh sách đủ mọi trip, thống kê hiện loại tiền đầu tiên có dữ liệu). Bấm một
  tab → danh sách chỉ còn trip dùng tiền đó + chip "USDの旅行のみ ✕" cạnh các chip
  trạng thái để bỏ lọc (thống kê giữ nguyên tab đang chọn).
- **Bộ lọc** (đã chốt): chip trạng thái quyết toán + select **năm** + ô search
  theo tên chuyến. Trip chưa có chi tiêu hiện nhạt hơn kèm nút
  `Bắt đầu ghi chi` — thấy được nhưng không cạnh tranh chú ý với trip đang đi.
- **FAB `＋ Ghi chi tiêu` ở cấp hub**: mở thẳng form, ô đầu tiên là chọn chuyến,
  **mặc định chọn chuyến đang `ongoing`** (hoặc chuyến gần ngày hôm nay nhất).
  Đây là đường nhanh nhất — hai chạm từ nav item tới bàn phím số, không phải
  vào trip rồi mới tìm nút.

### 9.2 Tab Nhật ký chi — **mobile-first, đây là ưu tiên số 1**

Thao tác này xảy ra khi đang **đứng ở quầy thanh toán**. Mục tiêu: ghi xong một
khoản trong **dưới 10 giây**.

```
   ¥ [  4,200  ]          ← ô lớn nhất, autofocus, bàn phím số

   Loại     [🚃 Di chuyển] [🏨] [🍜] [🎫] [⋯]     ← chip, một chạm
   Ai trả   [ Tôi ▾ ]                            ← mặc định người đang đăng nhập
   Chia cho  ● Chia đều    ○ Nhập riêng
              ✓ Bạn                      ¥1,050
              ✓ Minh                     ¥1,050
              ✓ Lan                      ¥1,050
              ✓ Bi 👶 → Lan chi trả      ¥1,050
                                        ─────────
                                        ¥4,200 ✓
   Tên      [ Ăn tối izakaya ]                   ← tuỳ chọn

   [ Lưu ]   [ Lưu & ghi tiếp ]
```

- Ngày mặc định **hôm nay**, gấp lại, chỉ mở khi cần sửa.
- `Lưu & ghi tiếp` giữ nguyên loại + người trả — chi tiêu hay đi theo chùm.
- Chuyển sang **Nhập riêng** thì các ô điền sẵn số của chế độ chia đều (S3).
- **v1 không có ảnh hoá đơn** (D8).

Danh sách: nhóm theo ngày, mỗi hàng
`[icon loại] Tên · người ứng · chia N người … ¥4,200`, vuốt trái để xoá.
Filter: loại chi phí, người ứng, khoảng ngày.
Dòng `kind: 'settlement'` hiện ở một nhóm riêng cuối danh sách, icon ↔, **không
tính vào tổng đã chi**.

### 9.3 Tab Quyết toán

Hai bảng, theo đúng thứ tự user cần đọc.

**Bảng 1 — Chi phí theo từng người** *(trả lời "bé nào hết bao nhiêu")*

```
Người        Suất của mình   Gánh cho trẻ   Tổng gánh    Đã ứng      Số dư
Minh              ¥37,180             —      ¥37,180    ¥97,200    +¥60,020
Hùng              ¥36,680             —      ¥36,680    ¥46,500     +¥9,820
Bạn               ¥35,680             —      ¥35,680    ¥12,000    −¥23,680
Lan               ¥36,180       ¥36,680      ¥72,860    ¥26,700    −¥46,160
  └ Bi 👶         ¥36,680   → Lan chi trả          —          —           —
                 ─────────                                          ────────
                  ¥182,400                                                ±0
```

Trẻ em nằm **thụt vào dưới người lớn phụ trách**, có suất riêng nhưng ba cột
cuối để trống — thể hiện đúng luật S2: có chi phí, không có nghĩa vụ trả.
Trẻ chưa gán `guardianId` hiện ở một nhóm riêng *"Chia đều cho người lớn"*.

**Bảng 2 — Cần chuyển cho thủ quỹ**

```
Thủ quỹ:  [ Minh ▾ ]        (người ứng ra nhiều nhất)

   Bạn   →  Minh    ¥23,680                      [ Đã trả ]
   Lan   →  Minh    ¥46,160                      [ Đã trả ]
   Minh  →  Hùng     ¥9,820                      [ Đã trả ]

   [ 📋 Sao chép tóm tắt ]
```

`Sao chép tóm tắt` sinh text thuần dán thẳng vào LINE / Slack — nhóm sẽ chốt
tiền ở đó chứ không phải trong app này. Tính năng nhỏ nhưng quyết định tính
năng có được dùng thật hay không.

> Bộ số trong hai bảng trên là **một ví dụ đã kiểm chứng bằng script**: 5 khoản
> chi tổng ¥182,400, 4 người lớn + 1 trẻ, trong đó một khoản dùng `exact` và một
> khoản chỉ chia cho trẻ em. Σ suất = Σ tổng gánh = ¥182,400, mọi trẻ em có số
> dư 0, Σ số dư = 0, và sau 3 lần chuyển thì mọi số dư về 0. Dùng chính bộ số
> này làm fixture cho test.

---

## 10. Hợp đồng hàm

### `features/budget/utils/budgetRules.ts`

```ts
// ---- tính toán (§3) ----
export function nodeTotal(node: BudgetNode, plan: BudgetNode[], party: PartySize): number;
export function nodePerHead(node: BudgetNode, plan: BudgetNode[], party: PartySize):
  { adult: number; child: number };
export function planTotal(plan: BudgetNode[], party: PartySize): number;
export function planPerHead(plan: BudgetNode[], party: PartySize):
  { adult: number; child: number };
export function totalsByCategory(plan: BudgetNode[], party: PartySize):
  Record<CostCategory, number>;
export function totalsByDay(trip: Trip):
  { byDay: Record<string, number>; unassigned: number };
  // Chỉ cộng node "được gắn cao nhất": cha và con cùng trỏ vào một ngày thì
  // cộng cả hai là đếm trùng. `unassigned` = khoản không gắn ngày nào
  // (vé máy bay, bảo hiểm...).
export function costCategoryForItem(
  item: ItineraryItem, placesById: Map<string, Place>,
): CostCategory;  // bảng map ở §1

// ---- cấu trúc (B1, B2) ----
export const MAX_BUDGET_DEPTH = 3;
export function budgetDepth(plan: BudgetNode[], nodeId: string): number;  // vòng lặp => MAX
export function canAddChild(plan: BudgetNode[], nodeId: string): boolean;
export function rootsOf(plan: BudgetNode[]): BudgetNode[];      // gồm cả node mồ côi
export function childrenOf(plan: BudgetNode[], nodeId: string | null): BudgetNode[];
export function branchOf(plan: BudgetNode[], nodeId: string): BudgetNode[];
export function isLeaf(plan: BudgetNode[], nodeId: string): boolean;
export function createNode(plan: BudgetNode[], input: NewNodeInput, id: string): BudgetNode;
export function addChildNode(
  plan: BudgetNode[], parentId: string, makeId: () => string, input?: Partial<NewNodeInput>,
): BudgetNode[];
  // B2: cha đang là lá có tiền => tự sinh con đầu tiên mang số tiền cũ.
  // `makeId` truyền từ ngoài để hàm vẫn thuần và test được tất định.
export function removeNode(plan: BudgetNode[], nodeId: string): BudgetNode[];
  // xoá cả nhánh; con cuối bị xoá => cha thành lá lumpSum = 0

// ---- liên kết lịch trình (B3) ----
export interface BudgetSuggestion { item: ItineraryItem; dayId: string | null; }
export function budgetSuggestions(trip: Trip): BudgetSuggestion[];  // item chưa có node
export function nodeForItem(plan: BudgetNode[], itemId: string): BudgetNode | undefined;
export function unlinkDeletedItems(trip: Trip): BudgetNode[];       // B3.6
```

### `features/settlement/utils/settlementRules.ts`

```ts
// ---- chia tiền, hai giai đoạn (S3) ----
export function spreadEvenly(total: number, travelerIds: string[]): Record<string, number>;
  // dùng chung cho mọi phép chia đều — quy tắc phần dư nằm ở ĐÚNG MỘT chỗ

export function allocateExpense(e: Expense): Record<string, number>;
  // giai đoạn 1 — kể cả trẻ em.  BẤT BIẾN: Σ === e.amount

export function toPayableShares(
  alloc: Record<string, number>, e: Expense, travelers: Traveler[],
): Record<string, number>;
  // giai đoạn 2 — chuyển suất trẻ em sang người lớn (S2.3)
  // BẤT BIẾN: Σ === e.amount, và mọi trẻ em === 0

export function validateExactShares(e: Expense):
  { ok: true } | { ok: false; diff: number };   // Σ shares vs amount

// ---- báo cáo theo người (bảng 1, §9.3) ----
export interface PersonCost {
  travelerId: string;
  ownShare: number;      // suất của chính mình (trẻ em có số này)
  childBurden: number;   // gánh thêm cho trẻ
  payable: number;       // ownShare + childBurden; trẻ em = 0
  paid: number;          // đã ứng ra
  balance: number;       // paid - payable
}
export function personCosts(expenses: Expense[], travelers: Traveler[]): PersonCost[];

// ---- số dư & quyết toán (S4, S5) ----
export function balances(expenses: Expense[], travelers: Traveler[]): Record<string, number>;
  // BẤT BIẾN: Σ === 0
export function pickTreasurer(balances: Record<string, number>): string;
export interface Transfer { fromId: string; toId: string; amount: number; }
export function settleViaTreasurer(
  balances: Record<string, number>, treasurerId: string,
): Transfer[];
export function buildSettlementExpense(t: Transfer, tripId: string): Omit<Expense, 'id'>;  // S6
export function settlementText(
  transfers: Transfer[], travelers: Traveler[], currency: Currency,
): string;

// ---- đối chiếu (S7) ----
export interface VarianceRow {
  category: CostCategory; planned: number; actual: number;
  diff: number; diffRatio: number | null;      // null khi planned = 0
}
export function varianceByCategory(
  plan: BudgetNode[], expenses: Expense[], party: PartySize,
): VarianceRow[];

// ---- tiền tệ ----
export function minorUnits(c: Currency): 0 | 2;
export function formatMoney(amount: number, c: Currency, locale: string): string;
```

Mọi hàm **thuần**: không gọi API, không `Date.now()`, không `randomUUID` — cùng
ràng buộc với `itineraryRules.ts` để test trực tiếp được.

> `spreadEvenly` là hàm quan trọng nhất trong hai file này. Quy tắc phần dư phải
> nằm ở **đúng một chỗ**: nó được dùng lại ở chia đều (S3 gđ1), chia lại suất
> trẻ em (S3 gđ2) và `lumpSum + perHead` (§3.1). Ba chỗ mà ba cách làm tròn là
> ba cách để Σ ≠ tổng.

---

## 11. API

| Method | Endpoint | Khi nào |
|---|---|---|
| `PATCH` | `/trips/:id` `{ currency, budget, budgetPlan }` | Lưu Bước 4 |
| `PATCH` | `/trips/:id` `{ travelers }` | Thêm / sửa thành viên |
| `PATCH` | `/trips/:id` `{ treasurerId }` | Đổi thủ quỹ |
| `GET` | `/expenses?tripId=:id&_sort=-date` | Mở workspace |
| `POST` | `/expenses` | Ghi một khoản / một lần trả nợ |
| `PUT` / `DELETE` | `/expenses/:id` | Sửa (ghi đè cả bản ghi) / xoá |
| `GET` | `/expenseHistory?tripId=:id&_sort=-at` | Tab 履歴 |
| `POST` | `/expenseHistory` | Sau mỗi thêm / sửa / xoá khoản chi (S10) |
| `PATCH` | `/trips/:id` `{ spent }` | Sau mỗi thay đổi Expense (S8) |
| `GET` | `/expenses?_sort=-date` | Hub — tổng kết nhiều chuyến |

`db.json` có collection `expenses: []` và `expenseHistory: []` (json-server v1
**không** tự tạo collection khi POST — thiếu thì 404; chạy
`node scripts/migrate-expense-history.mjs [--backfill]` khi server đang tắt).
Cần `isExpense()` guard như `isTrip()`, validate tới từng phần tử `shares[]`.
Danh sách (`requestList`) bỏ qua bản ghi không hợp lệ và cảnh báo console thay
vì làm hỏng cả màn hình.

---

## 12. Tiêu chí nghiệm thu

### `budgetRules.test.ts`

| Rule | Case |
|---|---|
| §3.1 | Ba chế độ giá: `suấtNL × A + suấtTE × C === tổng` |
| §3.1 | `quantity` nhân đúng; `quantity < 1` bị chặn |
| §3.2 | Cha = Σ con; cha có 2 mức con = Σ toàn bộ lá dưới nhánh |
| §3.3 | `planPerHead` **chỉ cộng lá** — cây 3 mức không bị đếm gấp đôi |
| B1 | `budgetDepth` trả đúng 1/2/3; thêm con ở mức 3 bị chặn |
| B2 | Lá có tiền + thêm con ⇒ **tổng không đổi**; xoá con cuối ⇒ tổng không đổi; thêm rồi xoá về đúng trạng thái đầu |
| B3 | `budgetSuggestions` bỏ item đã có node; item mới ở Bước 2 xuất hiện lại; chạy 2 lần cùng kết quả (idempotent) |
| B3.6 | Xoá item khỏi lịch trình ⇒ node còn nguyên, `linkedItemId` bị clear |
| B9 | `tripProgress` = 4 khi có `budget` **hoặc** `budgetPlan.length > 0` |

### `settlementRules.test.ts`

| Rule | Case |
|---|---|
| S3 | `spreadEvenly(1000, 3)` ⇒ `334+333+333`; **Σ === total** với mọi total 1..10,000 (property test) |
| S3 | `allocateExpense` chế độ `exact`: Σ === amount; lệch ⇒ `validateExactShares` trả đúng `diff` |
| S3 | `toPayableShares`: Σ === amount **và mọi trẻ em = 0** (property test) |
| S2.3 | Trẻ có `guardianId` ⇒ **toàn bộ** suất vào đúng người lớn đó |
| S2.3 | Trẻ không guardian ⇒ chia đều cho **người lớn có trong `shares`** |
| S2.3 | Khoản chỉ chia cho trẻ, trẻ không guardian ⇒ chia đều cho **tất cả người lớn của trip** |
| S2.3 | `guardianId` trỏ tới người đã rời nhóm / tới một trẻ khác ⇒ coi như không có guardian, không crash |
| S4 | **Σ balance === 0** với tập expense ngẫu nhiên (property test) |
| S5 | `settleViaTreasurer`: áp dụng hết transfer ⇒ mọi balance = 0 |
| S5 | Một người trả hết ⇒ đúng `n−1` giao dịch |
| S5 | Mọi balance đã = 0 ⇒ trả về mảng rỗng, không sinh giao dịch ¥0 |
| S6 | Ghi `Expense` kind `settlement` ⇒ balance hai bên về 0; **không** đổi `spent`; **không** vào `personCosts` |
| S7 | `varianceByCategory`: `planned = 0` ⇒ `diffRatio = null`, không chia cho 0 |
| §2.5 | `USD` lưu cents: `12.35` ⇒ `1235`, format lại đúng |
| §9.3 | **Fixture chốt**: bộ 5 khoản chi ¥182,400 / 4 NL + 1 TE ở §9.3 cho ra đúng bảng số dư và đúng 3 giao dịch |

### Smoke test tay

- [ ] `npx tsc -b` · `npm run lint` · `npm run test` sạch
- [ ] Bước 4: tạo cây 3 mức, cha tự cộng đúng; ẩn cột trẻ em khi `children = 0`
- [ ] Đổi `party.adults` ở Bước 1 ⇒ tổng Bước 4 đổi theo ngay
- [ ] Xoá item ở Bước 2 ⇒ node chi phí còn nguyên, có badge cảnh báo
- [ ] Ghi 10 khoản chi, 4 người + 1 trẻ ⇒ Σ số dư = 0 tuyệt đối, trẻ = 0
- [ ] Đổi `guardianId` của trẻ ⇒ bảng số dư đổi ngay, Σ vẫn = 0
- [ ] Bấm `Đã trả` hết ⇒ banner quyết toán xong, gợi ý đổi status `done`
- [ ] Đổi đơn vị tiền khi đã có Expense ⇒ bị chặn kèm lý do
- [ ] Hub: lọc theo năm / trạng thái chạy đúng; FAB ghi chi tiêu chọn đúng trip mặc định

---

## 13. Ảnh hưởng tới `trip-board.md` — sửa khi chốt

| Mục | Sửa gì |
|---|---|
| §5.2 stepper | ✅ đã làm ở Đợt 7 |
| §5.6 tab Chi phí | ✅ đã làm ở Đợt 9 — `TripCostSummary` + nút `Mở sổ chi tiêu →` |
| §2 model | **Bỏ** `ItineraryItem.estimatedCost`; `Trip` thêm `currency`, `budgetPlan`, `treasurerId`; `Traveler` thêm `id`, `isChild`, `guardianId` |
| §5.2 stepper | Bước 4 thôi `disabled`, bỏ badge "Sắp có"; nút `Hoàn tất` chuyển từ Bước 3 sang Bước 4 |
| §5.3 Step 1 | Khối Thành viên cho **thêm người local + đánh dấu trẻ em + chọn người chi trả** |
| §5.6 tab Chi phí | Thay ghi chú "thuộc Bước 4" bằng `TripCostSummary` + nút `Mở sổ chi tiêu →` |
| §5.7 | Thay toàn bộ bằng link tới doc này |
| R7 | Bỏ câu *"`estimatedCost` chỉ nhập ở Bước 4"* — trường không còn; thay bằng *"chi phí của item nằm ở `budgetPlan`, tra bằng `nodeForItem()`"* |
| R11 | Điều kiện Bước 4 đổi theo B9; đoạn thứ 4 thôi vẽ mờ |
| §13 | Thêm Đợt 6–9 |
| §14 | Bỏ "Step 4 chưa triển khai"; cập nhật mục thành viên |

---

## 14. Câu hỏi đã chốt

| # | Câu hỏi | Kết luận |
|---|---|---|
| Q1 | Đơn vị tiền của `Place.price` | Thêm `priceCurrency`, **mặc định `'JPY'`** cho toàn catalog + `priceUnit` |
| Q2 | Ảnh hoá đơn | **Bỏ ở v1**, phát triển sau. Không để field nửa vời trong model |
| Q3 | Trẻ em | **Có suất riêng, tính ra được từng bé**, nhưng không tự trả — gán `guardianId` hoặc chia đều cho người lớn (D6, S2) |
| Q4 | Hub có lọc không | **Có** — chip trạng thái + năm + search, và liệt kê **tất cả** chuyến |
| Q5 | Realtime | **Không cần.** `Expense` tách collection nên không đè nhau; chỉ cần nút "Tải lại" |
| Q6 | Bước 4 có bắt buộc để lên `confirmed` | **Không** |
| Q7 | Chia đều hay tính riêng | **Cả hai**, đúng hai chế độ `equal` / `exact` (D5, S3) |
| Q8 | Thuật toán quyết toán | **Chỉ thủ quỹ** ở v1 (D7) |

### Còn mở (không chặn v1)

- Đổi `guardianId` **theo từng khoản chi** (giờ là thuộc tính của người).
- Ảnh hoá đơn — cần chỗ lưu file thật, `json-server` không có.
- Tối ưu số giao dịch quyết toán.
- Chia tiền theo suất/trọng số (`shares: number`).
- Đa tiền tệ + tỉ giá.

---

## 15. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-09-14 | Một đơn vị tiền cho cả chuyến, không tỉ giá (D1) |
| 2026-09-14 | `budgetPlan` là nguồn sự thật, **bỏ** `ItineraryItem.estimatedCost` (D2) |
| 2026-09-14 | 計算 là màn riêng `/settlement`; trip detail chỉ tóm tắt + link (D3) |
| 2026-09-14 | Thành viên local không cần tài khoản (D4) |
| 2026-09-14 | Chi phí **không bắt buộc** gắn item lịch trình; item chỉ là gợi ý (B3) |
| 2026-09-14 | Hai chế độ giá `perPerson` / `lumpSum` + `quantity` |
| 2026-09-14 | Cây tối đa 3 mức; cha có con thì ô nhập khoá cứng |
| 2026-09-14 | Lá → cha tự sinh con đầu tiên giữ nguyên số tiền (B2) |
| 2026-09-14 | Giá tham khảo chỉ làm placeholder, **không tự điền** |
| 2026-09-14 | `Expense` là collection riêng, không nằm trong `Trip` |
| 2026-09-14 | `Traveler` bắt buộc có `id` ổn định |
| 2026-09-14 | "Đã trả" ghi thành `Expense` kind `settlement`, không dùng cờ state |
| **2026-09-15** | Chia tiền có **đúng hai** chế độ: Chia đều / Nhập riêng từng người (D5) |
| **2026-09-15** | **Bỏ** chế độ chia theo suất/trọng số — `exact` đã bao trùm |
| **2026-09-15** | Trẻ em **có suất chi phí riêng**, gán `guardianId` hoặc chia đều cho người lớn; số dư của trẻ luôn 0 (D6) |
| **2026-09-15** | Quyết toán **chỉ có phương án thủ quỹ** ở v1; `treasurerId` lưu trên trip (D7) |
| **2026-09-15** | **Bỏ ảnh hoá đơn** khỏi v1 (D8) |
| **2026-09-15** | Hub liệt kê **tất cả** chuyến + bộ lọc + FAB ghi chi tiêu ở cấp hub |
| **2026-09-15** | `Place.priceCurrency` mặc định `'JPY'` |
| **2026-09-15** | Bước 4 **không** là điều kiện để trip lên `confirmed` |

| **2026-09-15** | Gộp `pricingMode` + `lumpSumSplit` thành một ô "cách tính" ba lựa chọn (Đợt 7) |
| **2026-09-15** | Panel phân tích dùng thanh xếp chồng ngang, **không** dùng biểu đồ tròn |
| **2026-09-15** | Bộ màu riêng cho 5 loại chi phí, đã qua validator mù màu |

| **2026-09-15** | Bảng *Chi phí theo từng người* và *Đối chiếu* đổi sang bố cục thẻ dưới `lg` (Đợt 9) |
| **2026-09-15** | `personCosts` tách cột **Đã trả bù**: cột "gánh" tính theo `kind='expense'`, số dư tính cả `settlement` |
| **2026-09-15** | `spreadEvenly` chỉ dùng cho chia tiền thực tế; suất đầu người của dự trù là phân số nên không dùng chung |
| **2026-09-15** | Hạn mức đặt được theo **cả chuyến** hoặc **mỗi người**; lưu đúng con số user gõ, `budgetTotal()` là nguồn duy nhất để so sánh (B6) |
| **2026-09-15** | Đổi đơn vị tiền phải quy đổi đơn vị nhỏ nhất, kèm đếm số khoản bị làm tròn (B5) |
| **2026-09-15** | `Traveler.leftGroup` thay cho xoá khi thành viên đã có chi tiêu; xoá người lớn thì gỡ `guardianId` của trẻ kèm thông báo (S9) |
| **2026-09-15** | `BudgetNode.linkedItemTitle` để cảnh báo "mục đã bị xoá" chạy được cả với hoạt động tự do (B3.6) |
| **2026-09-15** | Đổi nhãn "gánh" thành "phải trả"; thêm dòng giải thích trên bảng chi phí từng người |
| **2026-09-15** | "Đã trả" có hộp thoại xác nhận — một click ghi thẳng một giao dịch tiền là quá nhẹ tay |
| **2026-10-02** | Chia tiền chính xác tới **0,01** (JPY/VND tính theo 1/100 yên/đồng, USD vẫn theo cent); phần dư xoay vòng theo từng khoản (`remainderOffset`) thay vì luôn rơi vào id nhỏ nhất — nguồn gốc lệch ~1 yên cộng dồn. Số nhập vẫn là số nguyên; số dẫn xuất hiển thị bằng `formatPrecise` |
| **2026-10-02** | B7 đổi từ cảnh báo mềm sang **chặn lưu** ở Bước 1, có nút sửa nhanh |
| **2026-10-02** | `Trip.ownerId` + `canViewTrip()`: chỉ chủ trip và thành viên đã gắn tài khoản mới thấy trip |
| **2026-10-02** | Trip đã có khoản chi thì **không xoá được** (kiểm tra lại ngay trước khi DELETE) |
| **2026-10-02** | Hub bỏ "あなたの合計" (số dư ròng qua nhiều trip, gần như luôn ¥0), thay bằng thống kê chi tiêu **của riêng bạn** (`userSpendingStats`) |
| **2026-10-02** | Thống kê "あなたの支出" luôn có đủ 3 tab **JPY / USD / VND**; tab chưa có số liệu hiện trạng thái trống riêng cho loại tiền đó |
| **2026-10-02** | Sửa khoản chi dùng **PUT** (ghi đè cả bản ghi) thay vì PATCH — xoá ghi chú / bỏ gắn khoản dự trù giờ mới thật sự mất |
| **2026-10-02** | Form chi tiêu: bắt buộc có ngày; lưu lỗi thì báo và giữ nguyên số đã nhập; "保存して続けて記録" hiện dòng "記録しました：…"; hàng nút ghim ở chân modal |
| **2026-10-02** | Cập nhật `trip.spent` sau khi ghi là best-effort — lỗi bước này không còn làm form tưởng lưu thất bại (gây nhân đôi khoản chi) |
| **2026-10-02** | Màn trip: xoá khoản chi / đánh dấu đã trả / đổi thủ quỹ thất bại thì hiện snackbar lỗi thay vì im lặng |
| **2026-10-02** | Bước 1: khi chưa tải xong (hoặc tải lỗi) danh sách chi tiêu thì khoá xoá thành viên, khoá đổi tiền tệ; thành viên đã có chi tiêu không đổi được người lớn ⇄ trẻ em |
| **2026-10-02** | Lịch sử thêm / sửa / xoá khoản chi (S10, collection `expenseHistory`, tab 履歴) — chỉ cho chi tiêu thực tế, không cho dự trù |
| **2026-10-02** | Chỉ chủ trip xoá được thành viên và bật/tắt chia sẻ (`trip-board.md` R14); trang chia sẻ công khai (`trip-share.md`) |
| **2026-10-02** | Lịch sử: giao dịch quyết toán hiện "A → B" thay cho mã `settlement`; dữ liệu khoản chi gán nhầm người tạo được sửa bằng `scripts/fix-expense-creators.mjs` |
| **2026-10-02** | Hub: tab tiền tệ ở thống kê lọc luôn danh sách trip, có chip bỏ lọc |
| **2026-10-02** | Trang chia sẻ có 2 mức; mức 2 hiện chi tiêu thực tế + quyết toán ở chế độ chỉ đọc (`trip-share.md`) |
