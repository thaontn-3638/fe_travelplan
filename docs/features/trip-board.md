# Itinerary (Trip Board) — Spec

> **Nguồn spec duy nhất** cho tính năng Lịch trình. Gộp từ spec cũ
> (`trip-board.md` v1) + bản revamp đã chốt ngày 2026-09-14.
> Doc viết bằng tiếng Việt vì đây là tài liệu yêu cầu để chốt với PO;
> định danh code / tên file giữ nguyên tiếng Anh.

Quản lý chuyến đi: danh sách, tạo mới theo wizard 4 bước, xem và sửa lịch
trình chi tiết. Dùng chung model `Trip` với Dashboard (xem `dashboard.md`).

---

## 1. File map

```
src/features/itinerary/
├── api/
│   └── tripApi.ts                  # getTrips, getTrip, createTrip, updateTrip, deleteTrip(id, userId),
│                                   # updateTripSharing, getSharedTrip
├── hooks/
│   ├── useTrips.ts                 # fetch-once Trip[] (Redux, dùng chung Dashboard)
│   ├── useTrip.ts                  # 1 trip + patch
│   └── useTripCovers.ts            # places-by-id lookup
├── utils/
│   ├── tripDefaults.ts             # tên mặc định, sinh days, cover photo
│   ├── itineraryRules.ts           # ★ R1–R6: thêm/xoá ngày, dịch ngày, auto-assign, overlap, isUsableDateRange
│   ├── tripMerge.ts                # R10b: lưu theo phần, phát hiện xung đột
│   ├── tripAccess.ts               # canViewTrip, canManageTrip (R14), travelerOfUser
│   ├── tripProgress.ts             # ★ tiến độ x/4 + cờ "Nháp"
│   ├── categoryColors.ts           # màu + thời lượng gợi ý theo category
│   └── placeFilters.ts             # ★ lọc panel địa điểm theo region / search / tab
├── dnd.ts                          # applyItineraryDrag — pure: DragEndEvent → days[]
└── components/
    ├── TripCard.tsx                # card dùng chung Dashboard + List
    ├── TripCardGrid.tsx
    ├── TripKanbanBoard.tsx         # ★ thay TripTimeline.tsx
    ├── TripProgressBar.tsx         # ★ 4 đoạn + nhãn "2/4"
    ├── TripWizardStepper.tsx       # ★ sơ đồ 4 bước, dùng cho create + edit
    ├── RegionMultiSelect.tsx       # ★ thay RegionCardPicker.tsx
    ├── PartySizeInput.tsx          # ★ người lớn / trẻ em
    ├── CategoryFilterChips.tsx
    ├── DayCard.tsx                 # 1 ngày: header + drop zone + item rows
    ├── ItineraryItemRow.tsx
    ├── AddActivityForm.tsx         # ★ form inline tạo item tự do
    ├── UnscheduledTray.tsx         # ★ khu "Chưa xếp ngày"
    ├── PlacePickerPanel.tsx        # ★ thay WishlistPanel.tsx — 2 tab + search + nút ＋
    ├── DayScheduleCalendar.tsx     # ★ Step 3 — wrap FullCalendar timeGrid
    ├── ItineraryPlaceDetailPane.tsx
    ├── SaveConflictDialog.tsx      # R10b — người khác sửa cùng phần
    ├── ShareTripDialog.tsx         # nút 共有 — trip-share.md
    ├── TripTimelineView.tsx        # tab Timeline màn xem (hover / bấm xem memo)
    └── MobileColumnTabs.tsx

src/pages/
├── ItineraryListPage.tsx           # /itinerary
├── ItineraryNewPage.tsx            # /itinerary/new — ★ chỉ Step 1
├── ItineraryEditPage.tsx           # /itinerary/:id/edit/:step — ★ wizard shell
├── ItineraryDetailPage.tsx         # /itinerary/:id — read-only
└── SharedTripPage.tsx              # /share/:token — xem công khai, không cần đăng nhập
```

★ = mới hoặc thay thế. **Bị xoá:** `draftTrip.ts`, `ItineraryPlanPage.tsx`,
`ItineraryNewStepOnePage.tsx`, `TripTimeline.tsx`, `RegionCardPicker.tsx`,
`WishlistPanel.tsx`, `utils/wishlist.ts`.

---

## 2. Data model

`src/types/index.ts`:

```ts
export type TripStatus = 'idea' | 'planning' | 'confirmed' | 'ongoing' | 'settling' | 'done';
export type ItineraryItemKind = 'place' | 'activity';

export interface ItineraryItem {
  id: string;
  kind: ItineraryItemKind;

  placeId?: string;          // bắt buộc khi kind = 'place'
  title?: string;            // bắt buộc khi kind = 'activity'

  note?: string;
  estimatedCost?: number;    // chuẩn bị cho Step 4, chưa hiển thị ở v1

  startTime: string | null;  // "HH:mm" — null = chưa gán giờ
  endTime: string | null;    // luôn cùng null hoặc cùng có giá trị với startTime

  order: number;             // thứ tự trong ngày
}

export interface ItineraryDay {
  id: string;
  date: string;              // ISO date, ví dụ "2026-08-14"
  items: ItineraryItem[];
}

export interface TripRegion {
  id: string;
  name: string;
  country?: string;
}

export interface Traveler {
  userId?: string;           // có khi là thành viên có tài khoản
  fullName?: string;
  initials: string;
  colorClass: string;
}

export interface PartySize {
  adults: number;            // >= 1
  children: number;          // >= 0
}

export interface Trip {
  id: string;
  name: string;

  regions: TripRegion[];             // >= 1
  startDate: string;
  endDate: string | null;            // null = trip 1 ngày

  status: TripStatus;
  travelers: Traveler[];             // thành viên cùng lên lịch trình
  party: PartySize;                  // số người thực tế — nguồn duy nhất cho chi phí

  budget: number | null;
  spent: number;

  days: ItineraryDay[];
  unscheduledItems: ItineraryItem[]; // khu "Chưa xếp ngày"

  updatedAt: string;
}
```

### 2.1 Khác biệt so với model cũ

| Cũ | Mới | Ghi chú |
|---|---|---|
| `regionId` + `regionName` + `country` | `regions: TripRegion[]` | multi-destination |
| `extraTravelers: number` | `party: PartySize` | `travelers[]` giữ nguyên ý nghĩa mới |
| `ItineraryItem.placeId` bắt buộc | `kind` + `placeId?` / `title?` | hoạt động tự do |
| `startTime/endTime: string` | `string \| null` | Step 2 không gán giờ |
| — | `ItineraryItem.note`, `estimatedCost` | |
| — | `Trip.unscheduledItems` | |

### 2.2 Không có trong model (đã cân nhắc và loại)

- **`endsNextDay` / item qua nửa đêm** — bỏ. Item phải nằm gọn trong một ngày.
  Muốn xếp hoạt động qua đêm thì tạo 2 item (`22:00–23:59` + `00:00–01:00`).
  Đổi lại: kiểm tra trùng giờ chỉ cần chạy trong phạm vi một ngày.
- **`day.lodgingPlaceId`** — bỏ. Khách sạn là item bình thường, user tự set
  giờ theo kiểu *"21:00–21:30 về khách sạn"*, không phải block 19 tiếng.
  Cùng một khách sạn xuất hiện làm item ở nhiều ngày là hợp lệ (xem R8).

---

## 3. API (json-server v1-beta)

| Method | Endpoint | Khi nào |
|---|---|---|
| `GET` | `/trips?_sort=-updatedAt` | màn List (`_sort`, không phải `sort`) |
| `GET` | `/trips/:id` | màn xem / edit |
| `POST` | `/trips` | **Lưu ở Step 1** — response `id` là nguồn chính thức |
| `PATCH` | `/trips/:id` | lưu từng bước, đổi tên, đổi status |
| `DELETE` | `/trips/:id` | xoá trip |

- Không có nested route `/trips/:id/days` ⇒ Step 2/3 PATCH **nguyên mảng
  `days`** (và `unscheduledItems`).
- `isTrip()` phải validate cả `regions[]`, `party`, `days[].items[]`
  (hiện chưa validate items nên `"NaN:NaN"` lọt xuống db được).
- Mọi `PATCH` tự bump `updatedAt`.
- Chưa có optimistic-concurrency — last-write-wins (xem §11).

---

## 4. Điều hướng

| URL | Màn |
|---|---|
| `/itinerary` | List — tab `Lưới thẻ` / `Kanban` |
| `/itinerary/new` | Step 1, trip **chưa tồn tại** |
| `/itinerary/:id` | Xem chi tiết (read-only) |
| `/itinerary/:id/edit/1` … `/4` | Wizard edit |

```
/itinerary/new ──[Lưu]──► POST /trips ──► /itinerary/:id/edit/2
                                                  │
                    ┌─────────────────────────────┼──────────────┐
                    ▼                             ▼              ▼
             [Lưu & tiếp tục]                 [Hoàn tất]      [Huỷ]
          /itinerary/:id/edit/3             /itinerary/:id  /itinerary/:id
```

Trip tồn tại thật ngay sau Step 1 ⇒ không còn draft trong router state,
refresh / mở lại URL / gửi link đều an toàn, và **luồng create ≡ luồng edit**
từ Step 2 trở đi (một bộ component duy nhất).

---

## 5. Màn hình

### 5.1 Header

Ô search của `DashboardLayout` **chỉ hiện ở `/discover`** (hiện
`uiSlice.searchQuery` là global nhưng chỉ Discover dùng). Bắt buộc ẩn trong
wizard vì Step 2 đã có ô search riêng.

### 5.2 `TripWizardStepper`

Đặt ngay dưới header, hiển thị đủ **4 bước**:

`1 Thông tin — 2 Sắp xếp — 3 Thời gian — 4 Chi phí`

- Step 4 luôn `disabled`, badge **"Sắp có"** (xem §5.7).
- **Create**: tuyến tính, Step 2–4 disabled cho tới khi Step 1 được lưu.
- **Edit**: click nhảy tự do. Nếu bước hiện tại dirty → confirm trước khi nhảy.

### 5.3 Step 1 — Thông tin chung

| Trường | Control | Validate |
|---|---|---|
| Điểm đến | `RegionMultiSelect` (MUI Autocomplete multiple + chip) | ≥ 1 |
| Tên chuyến đi | text | bắt buộc, ≤ 80 ký tự |
| Người lớn / Trẻ em | `PartySizeInput` (stepper số) | `adults ≥ 1`, `children ≥ 0` |
| Thành viên | `TravelerManager` (thành viên local chỉ cần tên; "これは私" gắn tài khoản) | khớp `party` (B7); xoá: chỉ chủ trip (R14) |
| Ngày đi | date | bắt buộc |
| Ngày về | date | `null` hoặc `≥ ngày đi`; tổng ≤ 30 ngày |
| Trạng thái | select `TripStatus` | **chỉ hiện ở chế độ edit** |

- **Tên mặc định**: `regions.map(r => r.name).join(' - ')`, quá 3 điểm thì cắt
  còn 3 + ` +N`. State giữ cờ `nameTouched`: user đã tự sửa tên thì đổi điểm
  đến **không** ghi đè.
- Ngày quá khứ: chỉ cảnh báo, không chặn.
- Mỗi ô có nhãn thật (`aria-labelledby` trỏ vào tiêu đề mục). Ô bắt buộc để
  trống **sau khi đã chạm vào** thì hiện lý do ngay dưới ô (旅行名を入力してください /
  行き先を1つ以上選んでください) — trước đây nút Lưu bị khoá mà không ai biết vì sao.
- Màn tạo mới cũng có `useUnsavedChangesGuard`: đã nhập gì đó mà bấm キャンセル /
  rời trang thì hỏi *Lưu và rời / Rời không lưu / Ở lại* như màn sửa.
- **Lưu** (create) → `POST /trips`:
  `status: 'idea'`, `days = buildDraftDays(...)`, `unscheduledItems: []`,
  `budget: null`, `spent: 0`, `travelers: [người tạo]`.

### 5.4 Step 2 — Sắp xếp *(không có giờ)*

Bố cục 2 cột.

**Cột trái — danh sách ngày**

- `DayCard`: header `Ngày N · T3, 20/09` + badge số item + menu `⋯` → **Xoá ngày**.
- Item row: ảnh/icon + tên + vùng + chấm màu category. **Không hiển thị giờ.**
- Kéo thả tự do trong ngày, giữa các ngày, và sang/từ khu "Chưa xếp ngày" —
  chỉ đổi `order` và ngày chứa nó. Tay nắm kéo chỉ hiện từ `sm` trở lên.
- Mỗi item có nút **`⋮` → "移動先"** liệt kê các ngày khác + "Chưa xếp ngày":
  chọn là chuyển item xuống **cuối** ngăn đó (`moveItemToDay(…, null)`; sang
  ngày khác thì giờ bị xoá như kéo thả). Đây là đường thay thế kéo thả cho
  điện thoại và bàn phím — trước đây item đã rơi vào "Chưa xếp ngày" thì trên
  mobile chỉ còn cách xoá rồi thêm lại.
- Nút `×` (xoá) và `⋮` có `aria-label` kèm tên mục, vùng chạm 36×36. Màn hẹp:
  ẩn ảnh thumbnail, hai nút xếp dọc, tên mục xuống tối đa 2 dòng thay vì cắt.
- Cuối mỗi day card: **`＋ Thêm hoạt động`** → `AddActivityForm` inline
  (tên, ghi chú, chi phí dự trù) → tạo item `kind: 'activity'`, `startTime: null`.
- Cuối danh sách: **`＋ Thêm ngày`**.
- `UnscheduledTray` — khu **"Chưa xếp ngày"** cố định ở cuối, luôn hiển thị khi
  `unscheduledItems.length > 0`. Chứa item mồ côi do xoá ngày / rút ngắn chuyến.
  Không chặn Lưu.

**Cột phải — `PlacePickerPanel`**

- Ô search + 2 tab: **`Wishlist`** (mặc định) | **`Tất cả địa điểm`**.
- Tab `Tất cả địa điểm` **mặc định lọc theo `trip.regions`** — so khớp
  `place.region` với `region.name` (có xét `Place.aliases` / `Region.aliases`),
  kèm checkbox *"Bỏ lọc khu vực"*. Có phân trang / infinite scroll (hiện
  `fetchPlaceCatalog` nạp toàn bộ rồi lọc client-side).
- Mỗi row có **2 đường thêm**:
  1. Kéo thả vào day card (desktop).
  2. Nút **`＋`** → popover chọn ngày (`Ngày 1 · 20/09` … `Chưa xếp ngày`) →
     thêm vào cuối ngày đó. **Đây là đường duy nhất dùng được trên mobile.**
- Place đã có trong lịch trình **không biến mất** — tụt xuống cuối, làm mờ,
  badge `Đã thêm ×2`. Vẫn thêm lại được.

**Footer cố định**: `Huỷ` · `Lưu` · `Lưu & tiếp tục →`

### 5.5 Step 3 — Thời gian

`DayScheduleCalendar` — lưới trục dọc, mỗi ngày một cột
(mobile: 1 ngày + nút chuyển ngày).

- **Thư viện**: `@fullcalendar/react` + `@fullcalendar/timegrid` +
  `@fullcalendar/interaction` (MIT, không cần plugin trả phí). Lý do:
  - `slotDuration` / `snapDuration` 15 phút, `eventResizableFromStart`,
    render event chồng nhau thành cột cạnh nhau — đều có sẵn.
  - `eventOverlap` để **`true`** (mặc định): cho kéo/resize tự do, việc chặn
    trùng giờ do ta tự validate (xem R6).
  - MUI X Scheduler thuộc bản Pro có phí — đã loại.

#### Hiển thị mặc định

- Trục giờ **06:00 – 24:00**, cuộn được, mở màn ở khoảng 07:30.
- Mỗi item là một block màu theo category, cao tỉ lệ với thời lượng, hiển thị
  giờ + tên. Item `kind: 'activity'` dùng màu `other`.
- **Mọi item trong một ngày đều có giờ khi vào Step 3** — item chưa có giờ
  được xếp tự động theo R5 ngay lúc mở màn. Không có nút "tự động xếp giờ".
- Dải **"Chưa gán giờ"** trên đầu cột chỉ xuất hiện ở đúng một trường hợp:
  ngày đó không còn chỗ trước 23:00 (xem R5 bước 5). Kéo từ dải vào lưới để
  gán giờ.
- Cột của ngày không có item nào thì để trống.

#### Behavior

| Thao tác | Kết quả |
|---|---|
| Kéo block lên / xuống | Đổi giờ, **giữ nguyên thời lượng**, snap 15'. |
| Kéo block sang cột ngày khác | Item đổi ngày luôn (tương đương move giữa `days[]`), snap 15'. Đây là đường thứ hai để đổi ngày, ngoài Step 2. |
| Resize mép trên / mép dưới | Đổi thời lượng, snap 15', tối thiểu 15'. |
| Thả vào chỗ đè lên item khác | **Cho phép.** Hai block render cạnh nhau, viền đỏ gạch chéo; banner cảnh báo bật lên; nút `Lưu`/`Hoàn tất` bị khoá cho tới khi hết trùng (xem R6). |
| Kéo vượt quá 23:59 | Bị chặn — không có item qua nửa đêm. |
| Click block | Chọn item; panel phải mở form: giờ bắt đầu / kết thúc, ghi chú, chi phí dự trù. Sửa giờ trong form cũng chịu cùng validate, báo lỗi inline và **không ghi** giá trị sai. |
| Bỏ giờ / kéo item ra khỏi lưới | **Không hỗ trợ.** Muốn gỡ item khỏi ngày thì quay lại Step 2. Step 3 chỉ làm một việc: xếp giờ. |

#### Xử lý trùng giờ

Kéo/resize **không bị chặn** — user cần được tự do kéo dài một mục mà không
phải dọn chỗ từ dưới lên trước. Thay vào đó:

- Hai block trùng nhau render **cạnh nhau, viền đỏ gạch chéo**.
- Banner cố định đầu màn: **`⚠ 2 mục đang trùng giờ`** + link *"Xem"* nhảy tới
  cặp đầu tiên. Banner cập nhật **realtime theo từng thao tác kéo**, không đợi
  tới lúc bấm Lưu.
- Nút `Lưu` và `Hoàn tất` **disabled**, tooltip ghi rõ lý do.
- Banner có nút **`Dồn xuống`**: đẩy tuần tự các mục bị trùng xuống dưới cho
  tới khi hết chồng lấn (dùng lại primitive xếp tuần tự của R5, giữ nguyên
  thời lượng từng mục). Nếu dồn mà vượt 23:00 thì báo lỗi và không đổi gì.

Nhờ vậy trạng thái trùng giờ là **tạm thời và luôn thoát ra được bằng một
click**, không phải ngõ cụt.

#### Khi lưu / rời Step 3

- `order` của từng ngày được ghi lại **theo đúng thứ tự thời gian** (R4).
- Item còn ở dải "Chưa gán giờ" giữ `startTime: null`, xếp cuối, **không chặn
  lưu**.

#### Khi quay lại Step 3 lần sau

- Item đã có giờ **giữ nguyên**, không bị xếp lại.
- Item mới thêm ở Step 2 (luôn `startTime: null`) được xếp nối tiếp sau item
  cuối cùng có giờ của ngày đó.

**Footer**: `Huỷ` · `← Quay lại` · `Lưu` · `Hoàn tất`

### 5.6 Màn xem chi tiết `/itinerary/:id`

Read-only, **ba tab**:

| Tab | Nội dung |
|---|---|
| `Danh sách` | Day card, giờ hiển thị kiểu trục (`timeVariant: 'axis'`), scroll-spy sang panel bên phải. Panel hiện **ghi chú** của mục đang xem; mục `kind: 'activity'` (không có Place) có panel riêng |
| `Trục giờ` | `TripTimelineView` — chính `DayScheduleCalendar` của Bước 3 ở chế độ `readOnly`. Mục có ghi chú được đánh dấu chấm nhỏ. Máy có chuột: **rê chuột vào là hiện popup** (giờ, ngày, memo, nút 詳細を見る; trễ 120 ms khi mở / 160 ms khi đóng để kịp đưa chuột vào popup). Bấm / chạm thì ghim popup (Popover có nút đóng) — đường duy nhất trên điện thoại |
| `Chi phí` | Tổng dự trù + bình quân đầu người, kèm ghi chú phần chi tiết thuộc Bước 4 |


- Header: tên (sửa inline), **chip trạng thái là dropdown đổi được tại chỗ**,
  khoảng ngày, số người (`2 người lớn · 1 trẻ em`), `TravelerAvatars`,
  nút **`共有`** (mở `ShareTripDialog`, xem `trip-share.md`; đang chia sẻ thì
  nút đổi thành chip xanh `共有中`), `Sửa`, menu `⋯` → **Xoá chuyến đi**
  (chỉ chủ trip — người khác thấy mục bị mờ kèm dòng "旅行の作成者だけが操作できます").
- Đổi tên: bấm tiêu đề **hoặc** nút bút chì cạnh tiêu đề (cho bàn phím / màn
  cảm ứng). Enter để lưu — Enter dùng để chốt chữ khi gõ IME (Nhật/Việt) bị bỏ
  qua (`isSubmitEnter`).
- Thân: từng ngày → từng item kèm giờ, thời lượng, ghi chú, chi phí dự trù;
  tổng chi phí/ngày và tổng toàn chuyến ở cuối.
- Item chưa gán giờ xếp cuối ngày, nhãn `Chưa gán giờ`.
- `unscheduledItems` hiển thị thành một khối riêng ở cuối.
- Panel phải: `ItineraryPlaceDetailPane` của item đang active, scroll-spy bằng
  `IntersectionObserver` (`rootMargin: '0px 0px -70% 0px'`) trên container
  cuộn của cột trái. Click item cũng set `activeItemId` — scroll và click dùng
  chung một state.
- Trip **Nháp** (0 item): empty state + CTA `Tiếp tục lên lịch trình` →
  `/itinerary/:id/edit/2`.
- **Bỏ `daysSeeded` ref** — state phải reset theo `tripId`.
- Có state lỗi (404 / network) thay cho `return null` màn trắng.

### 5.7 Step 4 — Dự trù chi phí

**Đã triển khai (Đợt 7).** Spec đầy đủ nằm ở **`docs/features/trip-budget.md`**
— doc đó là nguồn sự thật cho toàn bộ phần chi phí, gồm cả tính năng 計算
(chi thực tế & quyết toán) ở màn riêng `/settlement`.

Lưu ý model: **`ItineraryItem.estimatedCost` đã bị bỏ**. Chi phí dự trù nằm ở
`Trip.budgetPlan` (cây 3 mức) và tra ngược về item bằng `nodeForItem()`.

### 5.8 Màn List `/itinerary`

Hai tab: **`Lưới thẻ`** (mặc định) và **`Kanban`**.
*(Tab `Mốc thời gian` cũ bị bỏ — `TripTimeline.tsx` xoá.)*

- **Kanban**: 6 cột theo `TripStatus`, bảng cao bằng phần còn lại của màn hình
  và **cuộn trong từng cột** (không đẩy cả trang). Badge đếm dùng màu tint/text
  của chính trạng thái đó. Trong mỗi cột, trip cập nhật gần nhất xếp trên đầu.
  Kéo card sang cột khác → `PATCH /trips/:id { status }`, optimistic + rollback
  khi lỗi; cột đang được kéo tới sáng lên bằng **màu pastel của trạng thái đó**.
  Dùng lại `@dnd-kit/core`.
- `TripCard` (dùng chung Dashboard, Grid, Kanban) bổ sung:
  - `TripProgressBar` — 4 đoạn + nhãn `2/4` (xem R11).
  - Badge **`Nháp`** khi trip chưa có item nào.
  - Số người lấy từ `party.adults + party.children`.
- Lựa chọn tab không lưu giữa các lần vào màn.

---

## 6. Quy tắc nghiệp vụ

### R1 — Ngày và khoảng ngày
- `endDate === null` ⇔ trip 1 ngày ⇔ `days.length === 1`.
- Người dùng **được phép** chọn ngày về trùng ngày đi; khi lưu thì
  `normalizeEndDate()` đưa về `null` để chỉ tồn tại một dạng dữ liệu. Ngày về
  không bắt buộc — trip 1 ngày là case thật.
- Sau **mọi** thao tác phải chuẩn hoá: `days.length === 1` ⇒ `endDate = null`.
- `days` luôn liên tục, không đứt quãng, tăng dần theo `date`.
- Tối đa 30 ngày.

### R2 — Thêm / xoá ngày
- **Thêm ngày**: append `lastDate + 1`, **`endDate` tự cập nhật theo**.
- **Xoá ngày**: chỉ khi `days.length > 1`.
  - Nếu ngày có item → confirm: *"Xoá Ngày N? M mục sẽ chuyển sang
    Chưa xếp ngày."*
  - Item của ngày bị xoá → **chuyển vào `unscheduledItems`**, `startTime` và
    `endTime` bị set về `null`.
  - Các ngày sau **dồn lên** (`date` −1 ngày, giữ nguyên item), `endDate` −1.
- **Đổi plan hai ngày** (`swapDays`): ngày giữ nguyên `date`, toàn bộ item của
  hai ngày hoán vị. Giờ nằm trong phạm vi một ngày nên hoán đổi không sinh trùng.
- Nút "Thêm ngày" nằm ngay dưới day card cuối cùng, trên khu "Chưa xếp ngày".

### R3 — Đổi ngày ở Step 1 (chế độ edit)
- **Kéo dài chuyến** → thêm ngày rỗng ở cuối.
- **Rút ngắn chuyến** → confirm; item của các ngày bị cắt chuyển vào
  `unscheduledItems` với giờ bị xoá. **Không xoá dữ liệu.**
- **Đổi `startDate`** → toàn bộ `days[].date` dịch theo cùng một offset,
  item giữ nguyên.
- **Đang gõ dở** (ô ngày trống, ngày về tạm thời trước ngày đi): chỉ ghi giá
  trị vào form, **không** dựng lại `days` (`isUsableDateRange`). Trước đây mỗi
  phím gõ đều áp R3 → hộp thoại "rút ngắn" bật lên giữa chừng, xác nhận là dồn
  hết item vào "Chưa xếp ngày".

### R3b — Giờ ở Bước 3
- Mục chưa có giờ mà chỉ nhập **một** đầu (bắt đầu hoặc kết thúc) → tự điền
  đầu còn lại ±60 phút. `startTime` có mà `endTime` null là bản ghi hỏng
  (`isItineraryItem` loại) — trip đó sẽ không tải lại được.

### R4 — Thứ tự và thời gian
- Step 2 là nguồn sự thật của `order`; Step 3 là nguồn sự thật của giờ.
- **Ưu tiên: thời gian > `order`.** Khi **Lưu Step 3**, ghi lại `order` theo
  đúng thứ tự thời gian; item chưa gán giờ giữ nguyên thứ tự tương đối và
  xếp sau cùng.
- Hiển thị: Step 2 theo `order`; Step 3 và màn xem theo giờ, item chưa gán
  giờ xếp cuối.
- Item thêm mới sau khi đã set giờ luôn có `startTime: null`.

**Hệ quả cho kéo thả ở Step 2** (tránh thao tác bị nuốt mà user không biết):

| Thao tác ở Step 2 | Cho phép? | Ghi chú |
|---|---|---|
| Kéo item sang ngày khác | ✅ luôn | **Xoá giờ** của item (`startTime/endTime = null`) vì giờ cũ có thể trùng ở ngày mới |
| Kéo item trong ngày **chưa** có giờ | ✅ | Đổi `order` — đây chính là thứ tự R5 dùng để xếp giờ |
| Kéo item trong ngày **đã** có giờ | ❌ khoá | Grip mờ + hint *"Đổi thứ tự ở Bước 3"*. Ngày đó hiển thị theo giờ, mỗi row hiện nhãn giờ (read-only) |
| Kéo ra / vào "Chưa xếp ngày" | ✅ luôn | Vào khu này thì giờ bị xoá |


### R5 — Gán giờ tự động
Chạy **mỗi lần vào Step 3**, chỉ áp dụng cho item có `startTime === null`,
trong phạm vi **một ngày**:

1. Duyệt item chưa có giờ theo `order`.
2. Con trỏ khởi tạo `max(08:00, endTime lớn nhất trong các item đã có giờ của
   ngày đó)`.
3. Thời lượng: `suggestedDurationMinutes(category)` với `kind: 'place'`
   (đã có trong `categoryColors.ts`); **60 phút** với `kind: 'activity'` và
   với place không có category.
4. Các item nối tiếp nhau, không chèn khoảng nghỉ ⇒ **không bao giờ tự sinh
   trùng giờ**.
5. Nếu `end > 23:00` → dừng; item còn lại giữ `startTime: null` và hiện ở dải
   "Chưa gán giờ" của cột ngày đó.

Không có cờ phụ và không có nút bấm: item đã có giờ thì R5 không đụng tới, nên
chạy lại bao nhiêu lần cũng cho cùng kết quả (idempotent).

Item còn ở dải "Chưa gán giờ" **không chặn Lưu / Hoàn tất**.

### R6 — Trùng giờ
- Hai item trong **cùng một ngày** trùng khi
  `aStart < bEnd && bStart < aEnd` (đơn vị: phút từ 00:00).
- Chạm biên **không** tính là trùng: `10:00–11:00` và `11:00–12:00` hợp lệ.
- `endTime` phải **sau** `startTime`. Không có item qua nửa đêm
  (`endTime ≤ 23:59`) — ràng buộc này chặn cứng ngay lúc kéo.
- **Trùng giờ KHÔNG bị chặn lúc kéo/resize.** Lý do: khi các item xếp sát
  nhau, chặn cứng sẽ buộc user phải dọn chỗ từ dưới lên trước khi kéo dài một
  mục ở trên — thao tác ngược và phản trực giác.
- Trùng giờ bị chặn ở **điều kiện lưu**: còn cặp trùng thì `Lưu tạm` / `Tiếp tục`
  disabled. Nút "Dồn xuống" tự **disable kèm lý do** khi
  `canResolveConflictsByPushingDown()` trả false — trạng thái này tính lại từ dữ
  liệu ở mỗi lần render nên không có lý do cũ dính lại sau khi người dùng đã sửa. Trạng thái trùng hiển thị realtime (banner + viền đỏ), kèm nút
  `Dồn xuống` để tự giải quyết — xem §5.5.
- `unscheduledItems` và item `startTime === null` không tham gia kiểm tra.

### R7 — Item
- `kind: 'place'` bắt buộc có `placeId`; `kind: 'activity'` bắt buộc có `title`
  và có `category` riêng (mặc định `other`) — place lấy category từ chính Place.
  `itemCategory()` là nguồn duy nhất quyết định màu sắc và bộ lọc cho cả hai loại.
- Ghi chú (`note`) tối đa **100 ký tự**; vượt thì ô báo đỏ, có bộ đếm ký tự và
  **chặn lưu ở mức trip** (`findItemsWithLongNote`) — không chỉ ở ô đang gõ.
- Chi phí dự trù (`estimatedCost`) **chỉ nhập ở Bước 4**; Bước 2 và Bước 3 không
  có ô nhập để tránh cùng một số liệu nằm ở ba chỗ.
- Không hỗ trợ đổi `kind` sau khi tạo.
- Place không còn tồn tại (bị xoá / private của user khác) → **vẫn render một
  row fallback** *"Địa điểm không còn khả dụng"* kèm nút xoá.
  *(Hiện `ItineraryItemRow.tsx:47` `return null` làm item vô hình mà vẫn được
  đếm trong badge — phải bỏ.)*
- `startTime` và `endTime` luôn cùng `null` hoặc cùng có giá trị.

### R8 — Panel địa điểm
- Place đã có trong lịch trình vẫn hiện, tụt cuối + badge số lần đã thêm.
  Bỏ hoàn toàn cơ chế lọc bỏ của `selectVisibleWishlist` cũ.
- Thêm trùng là hợp lệ (khách sạn nhiều đêm, quán ăn quay lại).
- Tab `Tất cả địa điểm` mặc định lọc theo `trip.regions`.

### R9 — Bộ lọc category
Áp cho **cả hai cột** ở Bước 2 và cho màn xem chi tiết: cột trái lọc mục đã đặt
trong từng ngày (và khu "Chưa xếp ngày"), cột phải lọc panel địa điểm. Item
`kind: 'activity'` xếp vào nhóm `other`.

- Badge đếm của mỗi ngày hiển thị **số mục khớp bộ lọc** — đọc cùng với chip
  đang chọn thì nhất quán ("2 nhà hàng trong ngày này").
- **Kéo thả vẫn đúng khi đang lọc**: `insertAt` xác định vị trí chèn theo *id*
  của mục được thả lên, không theo chỉ số trong mảng đã lọc. Thả lên mục X =
  chèn ngay sau X; thả vào thân day card = xuống cuối ngày. Hạn chế duy nhất là
  không chèn được vào giữa hai mục đang bị ẩn.
- Ngày có mục nhưng không mục nào khớp bộ lọc **không** hiển thị empty state
  "chưa có địa điểm" — phải nói rõ *"Ngày này có N mục, nhưng không mục nào khớp
  bộ lọc"*. Ngày còn mục bị ẩn thì hiện thêm dòng *"N mục khác bị ẩn bởi bộ lọc"*.
- **Bước 3 lọc bằng cách làm mờ, không ẩn**: block không khớp bộ lọc giảm
  opacity (đậm lại khi hover) thay vì biến mất — ẩn sẽ giấu mất chỗ trùng giờ
  mà banner vẫn đang đếm.

### R10 — Lưu / Huỷ / dirty
- Mỗi bước có state `dirty` riêng. `Lưu` → `PATCH /trips/:id` phần dữ liệu của
  bước đó. `Huỷ` → revert về snapshot lần lưu gần nhất (confirm nếu dirty).
- Chặn rời route khi dirty bằng `useBlocker` (react-router 7) +
  `beforeunload` cho reload / đóng tab. Dialog có **ba** lựa chọn: *Lưu và rời* /
  *Rời không lưu* / *Ở lại*; nút Lưu bị khoá khi bước đang không hợp lệ.
- Footer wizard có 3 nút: **Huỷ**, **Lưu tạm** (lưu rồi về màn xem) và
  **Tiếp tục** (lưu rồi sang bước sau; ở bước cuối đổi thành **Hoàn thành**).
  Chỉ Huỷ / reload / bấm icon bước khác mới bật dialog hỏi — Tiếp tục thì lưu
  luôn, không hỏi. Sau khi lưu xong mà tự điều hướng thì phải gọi
  `guard.bypassOnce()`: state `trip` cập nhật bất đồng bộ nên `isDirty` còn true
  ở thời điểm navigate và blocker sẽ bật modal ngay sau một thao tác lưu thành công.
- Gán giờ tự động khi vào Bước 3 **không** tính là thay đổi của người dùng: nó
  dời luôn mốc so sánh dirty (`baseline`), nếu không thì chỉ mở Bước 3 rồi bấm
  Huỷ đã bị hỏi.
- PATCH của Bước 2/3 phải gửi kèm `startDate`/`endDate`, vì `addDay`/`removeDay`
  có đổi khoảng ngày. Thiếu chúng thì DB giữ `endDate` cũ và lần sau vào Bước 1
  sẽ tự cắt mất ngày dư cùng toàn bộ item trong đó.
- `Lưu tạm` disabled khi không dirty; có trạng thái `Đang lưu…`; có thông báo lỗi
  khi PATCH fail *(hiện `handleSave` không có `catch`)*.
- **Bỏ toàn bộ autosave debounce 500ms** trong `ItineraryDetailPage`.

- **R10b — Lưu khi người khác cũng đang sửa** (`utils/tripMerge.ts`). Trip chia
  thành 4 phần độc lập:

  | Phần | Field |
  |---|---|
  | `basics` | `name`, `regions`, `status`, `party` |
  | `travelers` | `travelers` |
  | `itinerary` | `startDate`, `endDate`, `days`, `unscheduledItems` |
  | `budget` | `currency`, `budget`, `budgetPerPerson`, `budgetPlan` |

  Bấm Lưu: tải bản mới nhất trên server, so 3 bản *original* (lúc mở) / *draft* /
  *latest*. Phần mình đổi mà người khác không đổi → `PATCH` **chỉ các field của
  phần đó** (json-server trộn vào, phần người kia sửa còn nguyên) — không hỏi gì.
  Cả hai cùng đổi một phần → `SaveConflictDialog` liệt kê các phần trùng, ba lựa
  chọn: *自分の内容で上書き* (ghi mọi phần mình sửa) / *最新の内容を読み込む* (phần
  trùng lấy theo server, các phần mình sửa mà không ai đụng vẫn được lưu, ở lại
  bước hiện tại) / *キャンセル*. `spent`, `treasurerId`, `shareToken` không thuộc
  phần nào nên không bao giờ gây xung đột. So sánh không phụ thuộc thứ tự key.
  Trước đây: PATCH nguyên các mảng → last-write-wins, mất thay đổi của người kia.

### R11 — Tiến độ và "Nháp"
```ts
// utils/tripProgress.ts
export function tripProgress(trip: Trip): number {
  let done = 1;                                   // Step 1 luôn xong — trip đã tồn tại
  const items = trip.days.flatMap((d) => d.items);
  if (items.length > 0) done++;                                        // Step 2
  if (items.some((i) => i.startTime !== null)) done++;                 // Step 3
  if (trip.budget !== null                                             // Step 4
      || items.some((i) => typeof i.estimatedCost === 'number')) done++;
  return done;                                    // 1..4
}

export const isDraftTrip = (trip: Trip): boolean => tripProgress(trip) === 1;
```
- Hiển thị `TripProgressBar` (4 đoạn) + nhãn `2/4` trên `TripCard`.
- `unscheduledItems` **không** tính vào Step 2 (chưa xếp vào ngày nào).
- Step 4 chưa làm nên chưa trip nào đạt `4/4` — đoạn thứ 4 vẽ mờ.

### R12 — Trạng thái trip
- Tạo mới → **`'idea'`** *(hiện đang hardcode `'planning'`)*.
- Đổi được ở 3 chỗ: dropdown trên header màn xem, Step 1 khi edit, kéo thả ở
  Kanban.
- Không tự suy ra từ ngày ở v1.

### R13 — Xoá trip
Menu `⋯` trên header màn xem → dialog confirm → `DELETE /trips/:id` →
về `/itinerary` + toast. `deleteTrip(id, userId)` kiểm lại ngay trước khi xoá:
trip đã có khoản chi → `TripHasExpensesError`; người gọi không phải chủ trip →
`TripNotOwnerError`.

### R14 — Quyền chủ trip (`canManageTrip`)
- **Chỉ chủ trip** (`trip.ownerId`): xoá trip, **xoá thành viên** (xoá người đã
  gắn tài khoản là thu hồi quyền xem của họ), bật/tắt/tạo lại link chia sẻ.
- Thành viên đã gắn tài khoản: xem và sửa lịch trình, dự trù, ghi chi tiêu,
  đổi trạng thái, thêm / đổi tên thành viên, đánh dấu "rời nhóm".
- Bước 1 của người không phải chủ: nút xoá thành viên thay bằng icon khoá +
  tooltip.
- Trip cũ chưa có `ownerId` (trước migrate) → ai xem được thì quản lý được.
- Thành viên đã xuất hiện trong khoản chi: không xoá được (S9), **không đổi
  người lớn ⇄ trẻ em được**. Danh sách chi tiêu chưa tải xong / tải lỗi thì coi
  như mọi thành viên đều đã có chi tiêu (khoá hết) và khoá đổi tiền tệ.

---

## 7. Drag & drop (`@dnd-kit/core`)

Ba `DndContext` độc lập:

| Màn | Nguồn kéo | Đích thả | Kết quả |
|---|---|---|---|
| Step 2 | `{ type: 'place', placeId }` — row ở panel | `{ type: 'day', dayId }` / `{ type: 'item', dayId, itemId }` / `{ type: 'unscheduled' }` | tạo item mới (`startTime: null`) |
| Step 2 | `{ type: 'item', dayId \| null, itemId }` | như trên | di chuyển + reindex |
| Kanban | `{ type: 'trip', tripId }` | `{ type: 'status', status }` | `PATCH { status }` |

- Thả lên **day card** = append cuối ngày; thả lên **item row** = chèn ngay sau
  item đó.
- `applyItineraryDrag(days, unscheduled, event)` là hàm thuần, trả về state kế
  tiếp hoặc `null` nếu đích không hợp lệ. **Không còn tính giờ** — bỏ
  `nextDefaultTimeRange` khỏi luồng này.
- Mọi ngày bị ảnh hưởng đều reindex `order: 0..n-1` sau insert / move / remove.
- Bước 2 có `DragOverlay` (thẻ xem trước bám con trỏ) và vạch chỉ vị trí chèn ở
  mép dưới hàng đang được thả lên — nếu không, ngữ nghĩa "chèn ngay sau hàng này"
  là vô hình.
- Step 3 dùng cơ chế kéo thả của FullCalendar, không dùng dnd-kit.
- Sensor: `PointerSensor` (kích hoạt sau 6px) + `KeyboardSensor` (Space/Enter
  trên tay nắm để nhấc, mũi tên để di chuyển, Space để thả) ở cả Bước 2 và
  Kanban. Tay nắm có `touch-none` và `aria-label`.
- Card Kanban là `role="button"` (Enter / Space mở trip).

---

## 7b. Quy ước ghi ngày

`src/utils/dateFormat.ts` là **nguồn duy nhất** cho mọi chỗ in ngày — không
component nào được tự gọi `format(date, ...)`.

| Ngôn ngữ | Một ngày | Khoảng ngày |
|---|---|---|
| `en`, `vi` | `Th 3, 20/09/2026` | `20/09/2026 – 22/09/2026` |
| `ja` | `火, 2026/09/20` | `2026/09/20 – 2026/09/22` |

- Thứ lấy từ `common.weekdaysShort` nên đổi theo ngôn ngữ đang chọn.
- Khoảng ngày **bỏ thứ** ở hai đầu (hai thứ trong một chuỗi là nhiễu), nhưng giữ
  đúng thứ tự ngày/tháng/năm của từng ngôn ngữ.
- `endDate` null **hoặc** trùng `startDate` ⇒ in một ngày kèm thứ (R1).
- Tiêu đề cột ngày của lưới giờ dùng `dayHeaderContent` để đi qua chính formatter
  này, thay vì `dayHeaderFormat` của FullCalendar.

---

## 8. Category & màu

`CategoryFilterChips` render "Tất cả" + một chip cho mỗi `CATEGORY_KEYS`
(`attraction | restaurant | hotel | shopping | other`, từ
`features/places/utils.ts`, dùng chung với Discover).

`categoryColors.ts` map mỗi category sang một bộ class (dot / text / tint /
border) cho chip và chấm màu ở item row — chỉ dùng trong feature Itinerary.

`suggestedDurationMinutes(category)` (attraction 120', restaurant 90',
shopping 90', other 60', hotel `null`) dùng cho **hai** việc: hộp
"Thời gian nên dành" ở panel chi tiết, và thời lượng mặc định của R5.

---

## 9. Responsive

Dưới breakpoint `lg`, Step 2 và màn xem gộp 2 cột thành `MobileColumnTabs`.
Cả hai cột vẫn render trong DOM (cột không active nhận `hidden`) nên state
(vị trí cuộn, lựa chọn trong panel) sống sót khi đổi tab.

- Kéo thả **không dùng** dưới `lg` — dnd-kit cần cả nguồn lẫn đích cùng hiện
  diện. Thay vào đó: nút **`＋`** ở `PlacePickerPanel` để thêm, và menu **`⋮` →
  移動先** trên từng item để chuyển ngày.
- Step 3 trên mobile: hiển thị 1 ngày + nút chuyển ngày.

---

## 10. Migration `db.json`

Script một lần cho 9 trip hiện có:

```
regionId + regionName + country  →  regions: [{ id, name, country }]
extraTravelers: N                →  party: { adults: travelers.length + N, children: 0 }
days[].items[]                   →  thêm kind: 'place'
                                    startTime/endTime giữ nguyên (đã có giá trị)
Trip                             →  thêm unscheduledItems: []
travelers[]                      →  giữ nguyên (userId/fullName optional)
```

`status` của trip cũ giữ nguyên; chỉ trip tạo mới mới mặc định `'idea'`.

---

## 11. Hợp đồng hàm

### `utils/itineraryRules.ts`

```ts
// ---- thời gian ----
export function toMinutes(time: string): number;              // "09:30" -> 570
export function toTimeString(minutes: number): string;         // 570 -> "09:30"; clamp [0, 1439]

export const DAY_START_MINUTES = 8 * 60;   // 08:00 — mốc bắt đầu auto-assign
export const DAY_LIMIT_MINUTES = 23 * 60;  // 23:00 — không auto-assign quá mốc này
export const MAX_TRIP_DAYS = 30;
export const SNAP_MINUTES = 15;

// ---- R1: chuẩn hoá ----
export function normalizeTripDates(trip: Trip): Trip;          // days.length === 1 => endDate = null
export function countTripDays(startDate: string, endDate: string | null): number;
export function buildDays(startDate: string, endDate: string | null): ItineraryDay[];

// ---- R2: thêm / xoá ngày ----
export function addDay(trip: Trip): Trip;                      // append lastDate+1, nới endDate
export function removeDay(trip: Trip, dayId: string): Trip;    // item -> unscheduled (giờ = null),
                                                               // ngày sau dồn lên, endDate -1
                                                               // no-op khi days.length === 1

// ---- R3: đổi khoảng ngày ở Step 1 ----
export function applyDateRange(trip: Trip, startDate: string, endDate: string | null): Trip;
export function itemsLostByDateRange(                          // để dựng confirm dialog
  trip: Trip, startDate: string, endDate: string | null,
): { removedDays: number; movedItems: number };

// ---- R4: đồng bộ order theo giờ ----
export function reorderByTime(days: ItineraryDay[]): ItineraryDay[];

// ---- R5: gán giờ tự động (idempotent) ----
export function autoAssignTimes(
  day: ItineraryDay, durationOf: (item: ItineraryItem) => number,
): ItineraryDay;
export function autoAssignAllDays(
  days: ItineraryDay[], durationOf: (item: ItineraryItem) => number,
): ItineraryDay[];

// ---- R6: trùng giờ ----
export interface TimeConflict { dayId: string; aId: string; bId: string; }
export function findConflicts(days: ItineraryDay[]): TimeConflict[];
export function hasConflicts(days: ItineraryDay[]): boolean;
export function isValidRange(startTime: string, endTime: string): boolean; // end > start, end <= 23:59

// "Dồn xuống": đẩy tuần tự các item bị trùng xuống, giữ nguyên thời lượng.
// Trả về null khi phải vượt quá 23:59 (caller báo lỗi, không đổi gì).
export function resolveConflictsByPushingDown(day: ItineraryDay): ItineraryDay | null;

// ---- di chuyển item ----
export function moveItemToDay(                                 // giữa days và unscheduled
  trip: Trip, itemId: string, fromDayId: string | null,
  toDayId: string | null, insertAfterItemId: string | null,
): Trip;                                                       // đổi ngày => giờ bị xoá
export function removeItem(trip: Trip, itemId: string): Trip;
export function reindex(items: ItineraryItem[]): ItineraryItem[];  // order: 0..n-1
```

Mọi hàm đều **thuần** (không mutate tham số, không gọi API, không đụng
`crypto.randomUUID` ngoài chỗ tạo item mới) để test được trực tiếp.

### `utils/tripProgress.ts`

```ts
export const TRIP_STEP_COUNT = 4;
export function tripProgress(trip: Trip): number;   // 1..4 — xem R11
export function isDraftTrip(trip: Trip): boolean;   // tripProgress === 1
```

---

## 12. Tiêu chí nghiệm thu

### Unit test bắt buộc (`itineraryRules.test.ts`)

| Rule | Case |
|---|---|
| R1 | `days.length === 1` ⇒ `endDate === null`; `buildDays` với `endDate` null ra đúng 1 ngày; quá 30 ngày bị chặn |
| R2 | Thêm ngày nới `endDate`; xoá ngày giữa thì các ngày sau dồn lên và `endDate` −1; item rơi vào `unscheduled` với giờ `null`; xoá khi còn 1 ngày là no-op |
| R3 | Rút ngắn chuyến đẩy item vào `unscheduled`; kéo dài thêm ngày rỗng; đổi `startDate` dịch toàn bộ `days[].date` |
| R4 | `reorderByTime` ghi `order` theo giờ, item `null` xếp cuối và giữ thứ tự tương đối |
| R5 | Ngày rỗng ⇒ item đầu 08:00; item đã có giờ không bị đụng; chạy 2 lần cho cùng kết quả; tràn 23:00 thì để `null` |
| R6 | `10:00–11:00` + `11:00–12:00` **không** trùng; `10:00–11:00` + `10:30–11:30` trùng; `endTime <= startTime` invalid; `resolveConflictsByPushingDown` giữ nguyên thời lượng và trả `null` khi vượt 23:59 |
| R11 | Trip 0 item ⇒ `1/4` + `isDraftTrip`; có item ⇒ `2/4`; có giờ ⇒ `3/4`; `unscheduledItems` không tính vào Step 2 |

### Smoke test tay cuối Đợt 1

- [ ] `npx tsc -b` sạch
- [ ] `npm run lint` sạch
- [ ] `npm run test` xanh
- [ ] `npm run mock` + `GET /trips` trả đúng model mới, `isTrip()` không loại bản ghi nào
- [ ] Dashboard, màn List, màn Detail render không lỗi console
- [ ] `POST` / `PATCH` / `DELETE /trips/:id` chạy đúng

---

## 13. Tiến độ triển khai

| Đợt | Nội dung | Trạng thái |
|---|---|---|
| 1 | Model, migration, `itineraryRules` + `tripProgress` + test, gỡ nợ autosave | ✅ xong 2026-09-14 |
| 2 | Step 1 & Step 2 mới, `PlacePickerPanel`, `UnscheduledTray`, route wizard | ✅ xong 2026-09-14 |
| 3 | Step 3 calendar (FullCalendar), R5/R6, banner trùng giờ + `Dồn xuống` | ✅ xong 2026-09-14 |
| 4 | Màn xem dạng List, xoá trip, đổi status, Kanban, `TripProgressBar` | ✅ xong 2026-09-14 |
| 5 | Xử lý feedback sau test: lỗi Step 1, nút wizard, UI Bước 2/3, 3 tab màn xem, Kanban | ✅ xong 2026-09-14 |
| 6 | Model chi phí, migration, `budgetRules` + test | ✅ xong 2026-09-15 |
| 7 | Step 4 — UI dự trù chi phí | ✅ xong 2026-09-15 |
| 8 | Thành viên local, `Expense`, sổ chi tiêu | ✅ xong 2026-09-15 |
| 9 | Đối chiếu, quyết toán, hub `/settlement` | ✅ xong 2026-09-15 |

**Đã sửa ở Đợt 5 (theo feedback test)**

| Vấn đề | Nguyên nhân / cách sửa |
|---|---|
| Search vùng bằng tiếng Nhật không ra kết quả | `searchRegions` khớp alias đúng, nhưng `filterOptions` mặc định của MUI Autocomplete lọc lại theo tên latin và loại sạch kết quả → `filterOptions={(o) => o}` |
| Hiện nguyên chuỗi `itinerary.stepOne.hintBothDates` | Key lưu dạng `_other` nhưng chỗ gọi truyền `{days, nights}` không có `count`; i18next chỉ tìm hậu tố số nhiều khi có `count` → đổi về key thường. Có test chống hồi quy |
| Chip vùng đã chọn bị chìm | Đổi sang nền `oceanTint` + viền `ocean` + chữ đậm; dropdown hiện thêm alias |
| Chọn được ngày về trùng ngày đi | `normalizeEndDate()` khi lưu; `formatTripDateRange` cũng phòng dữ liệu cũ |
| Thiếu dấu bắt buộc | `Label required` thêm dấu `*` đỏ |
| Mô tả trip rỗng xuống dòng giữa chừng | Bỏ `max-w-sm` |
| Nút "Dồn xuống" báo lý do cũ sau khi đã sửa được | Lý do từng là state; giờ tính lại từ dữ liệu ở mỗi lần render bằng `canResolveConflictsByPushingDown()`, nút tự disable kèm giải thích |
| Chọn ngày qua nút ＋ xong panel nhảy sang chi tiết địa điểm | MUI Menu ở portal vẫn bubble theo cây React → `stopPropagation` trong `AddToDayPopover` |
| Kéo thả khó nhìn | Thêm `DragOverlay` + vạch chỉ vị trí chèn |
| Stepper lệch độ rộng giữa các bước | `max-w-[760px]` trên chính stepper; bước done nền `mint-tint` |

**Đã có sau Đợt 1**

- `src/types/index.ts` — model mới đầy đủ.
- `scripts/migrate-trips.mjs` — migration một lần; backup ở
  `db.before-itinerary-migration.json`.
- `utils/itineraryRules.ts` (R1–R6 + di chuyển item) và `utils/tripProgress.ts`
  (R11) — hàm thuần, 32 unit test.
- `__tests__/dbSeed.test.ts` — khoá dữ liệu seed phải qua được `isTrip()`.
- `tripApi.ts` — `deleteTrip()`, guard validate tới từng item.
- `dnd.ts` — Trip-based, **không còn tự gán giờ**, hỗ trợ "Chưa xếp ngày".
- `ItineraryItemRow` — hỗ trợ `kind`, render fallback cho place đã mất.
- `ItineraryDetailPage` — bỏ autosave, có Lưu/Huỷ + dirty guard + state lỗi.
- Router chuyển sang `createBrowserRouter` (data router) để `useBlocker` chạy được.

**Đã có sau Đợt 2**

- `ItineraryNewPage` (Bước 1) — multi-region, tên tự sinh + `nameTouched`,
  người lớn/trẻ em, validate ngày; **Lưu là POST /trips ngay**, rồi chuyển
  thẳng sang `/itinerary/:id/edit/2`.
- `ItineraryEditPage` — shell wizard cho `/itinerary/:id/edit/:step`, stepper
  nhảy tự do, footer `Huỷ` / `Lưu` / `Lưu & tiếp tục`, dirty guard.
- Bước 2: thêm/xoá ngày, `UnscheduledTray`, `AddActivityForm`, khoá kéo trong
  ngày đã có giờ (R4), **không hiển thị giờ**.
- `PlacePickerPanel` — 2 tab Wishlist / Tất cả địa điểm, ô search, lọc theo
  `trip.regions` (có checkbox bỏ lọc), phân trang, và nút `＋` mở popover chọn
  ngày — đường dùng được trên mobile.
- Màn chi tiết thành **chỉ đọc**; nút "Sửa" đưa vào wizard. Trip 0 item hiện
  badge "Nháp" + CTA tiếp tục lên lịch trình.
- Router chuyển sang data router; `useUnsavedChangesGuard` + `useBlocker`.
- Ô search ở header chỉ còn hiện ở `/discover`.
- Đã xoá: `draftTrip.ts`, `ItineraryPlanPage`, `ItineraryNewStepOnePage`,
  `RegionCardPicker`, `WishlistPanel`, `TripTimeline`.
- `vite.config.ts` bật `globals: true` để testing-library tự cleanup DOM.

**Đã có sau Đợt 3**

- Dependency mới: `@fullcalendar/react` + `core` + `timegrid` + `daygrid` +
  `interaction` (6.1.19, MIT). **Cần chạy `npm install` sau khi pull.**
- `DayScheduleCalendar` — lưới trục dọc **đủ 24 tiếng (00:00–24:00)**, đường kẻ
  mỗi 1 tiếng (bỏ vạch phụ 30 phút) nhưng vẫn **snap 15 phút** khi kéo/resize;
  kéo sang cột ngày khác; `eventOverlap` bật (cho phép chồng lúc kéo).
- Mở màn cuộn tới khung giờ của **mục sớm nhất đang hiển thị** (lùi 30 phút cho
  thoáng), không phải một mốc cố định — trục 24 tiếng nên mốc cố định dễ rơi vào
  vùng trống. Calendar có chiều cao cố định để vùng cuộn nội bộ hoạt động.
- Màu block theo category: **nền pastel (tint) + viền đậm (base) + chữ đậm**,
  lấy thẳng từ `palette.ts`. Mục đang chọn **dày viền lên 3px + quầng cùng tông
  chữ** (`currentColor`), không dùng màu đen.
- Ngôn ngữ của lịch theo `i18n.language` (vi/ja/en) — nhãn giờ, tên thứ, tên
  tháng đều đổi theo.
- Dải "Chưa gán giờ" dùng `Draggable` của FullCalendar để kéo vào lưới.
- `ScheduleStep` — auto-assign R5 chạy khi vào bước (idempotent), cửa sổ 4 ngày
  (desktop) / 1 ngày (mobile) kèm nút chuyển, panel phải sửa giờ/ghi chú/chi phí.
- `ScheduleConflictBanner` — đếm mục trùng realtime, nút "Xem" nhảy tới cặp đầu
  tiên, nút "Dồn xuống" giải quyết bằng một click.
- Nút `Lưu`/`Hoàn tất` bị khoá khi còn trùng giờ; lưu Bước 3 ghi lại `order`
  theo giờ (R4).
- CSS lưới giờ + kiểu gạch chéo đỏ cho mục trùng nằm trong `src/index.css`.

**Đã có sau Đợt 4**

- `TripProgressBar` — 4 đoạn + nhãn `x/4` (R11), đoạn Bước 4 vẽ mờ. Hiện trên
  `TripCard`, card Kanban và header màn xem. Badge **Nháp** cho trip 0 item.
- `TripKanbanBoard` — 6 cột theo `TripStatus`, scroll ngang, kéo card đổi trạng
  thái với optimistic update + rollback khi PATCH lỗi. Thay tab "Mốc thời gian".
- `TripStatusSelect` — chip trạng thái ở header màn xem thành dropdown đổi ngay
  tại chỗ (R12), không phải đi vòng qua wizard.
- `DeleteTripDialog` + `useTrips().remove()` — xoá trip có confirm, xoá xong về
  màn List (R13). `tripsSlice` thêm action `removeTrip`.
- `utils/tripCosts.ts` — tổng chi phí dự trù theo ngày (hiện trên header mỗi
  `DayCard`), tổng toàn chuyến và bình quân đầu người theo `party` ở cuối màn xem.

**Còn nợ**

- Step 4 — Dự trù chi phí: `estimatedCost`/`budget` đã có trong model và đã được
  tổng hợp ở màn xem, nhưng chưa có bước nhập liệu riêng.
- Chưa có UI mời thành viên (`travelers[]` mới chỉ có người tạo).

---

## 14. Known gaps / chưa làm

- **Thành viên**: Step 1 thêm được thành viên **local** (chỉ cần tên, không cần
  tài khoản) và đánh dấu trẻ em + người chi trả. Search / mời user theo email
  vẫn chưa làm.
- **Chia sẻ**: đã có link xem công khai (`trip-share.md`). Chưa có mời thành
  viên qua link / email.
- **Không có sync realtime** — người khác sửa thì chỉ biết lúc bấm Lưu (R10b);
  trong lúc sửa không thấy thay đổi của họ.
- **Kéo thả không chạy trên mobile** (đã có nút `＋` và menu `⋮ → 移動先` thay thế).
- Đổi ngày đi muộn hơn: các ngày dịch theo vị trí (giữ đúng thứ tự ngày 1, 2, …),
  ngày bị cắt ở cuối rơi vào "Chưa xếp ngày" — giữ nguyên theo quyết định 2026-10-02.
- Chưa có test component cho các màn itinerary. Bắt buộc có unit test cho
  `itineraryRules.ts` (R2, R3, R5, R6) và `tripProgress.ts` (R11).
- `suggestedDurationMinutes` là con số tĩnh theo category, `Place` không có
  trường thời lượng thật.

---

## 15. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-09-14 | Wizard 4 bước; trip lưu ngay sau Step 1 |
| 2026-09-14 | Step 2 bỏ gán giờ; tách Step 3 calendar |
| 2026-09-14 | `kind: place \| activity` — item không bắt buộc gắn Place |
| 2026-09-14 | Cấm trùng giờ, chặn ở mức tương tác; **bỏ** item qua nửa đêm |
| 2026-09-14 | Khách sạn là item thường, **không** tách `lodgingPlaceId` |
| 2026-09-14 | Chỉ có khu "Chưa xếp ngày"; "chưa gán giờ" chỉ là cách hiển thị |
| 2026-09-14 | Xoá ngày → item rơi vào "Chưa xếp ngày", các ngày sau dồn lên |
| 2026-09-14 | `party` là số người chính xác; `TravelerAvatars` chỉ vẽ `travelers[]` |
| 2026-09-14 | Kanban **thay thế** tab "Mốc thời gian" |
| 2026-09-14 | Trip 0 item = "Nháp", status vẫn `idea`; tiến độ x/4 trên card |
| 2026-09-14 | Bỏ autosave → Cancel/Save + dirty guard |
| 2026-09-14 | Step 3: R5 chạy mỗi lần vào, idempotent; bỏ nút "Tự động xếp giờ"; không hỗ trợ bỏ giờ |
| 2026-10-02 | Quyền chủ trip (R14): xoá trip, xoá thành viên, chia sẻ chỉ chủ trip làm được |
| 2026-10-02 | Lưu theo phần (R10b): khác phần thì tự gộp, trùng phần mới hỏi |
| 2026-10-02 | Đổi ngày đi: vẫn dịch theo vị trí, phần lệch rơi vào "Chưa xếp ngày" (không đổi R3) |
| 2026-10-02 | Menu `⋮ → 移動先` trên item thay cho kéo thả ở mobile / bàn phím |
| 2026-10-02 | Timeline màn xem: hover hiện memo (máy có chuột), bấm/chạm để ghim |
| 2026-10-02 | Nút `共有` = link xem công khai chỉ đọc, 2 mức bật riêng: kế hoạch / chi tiêu thực tế (`trip-share.md`) |
| 2026-09-14 | Step 2: khoá kéo-trong-ngày khi ngày đã có giờ; kéo sang ngày khác thì xoá giờ |
| 2026-09-14 | Trùng giờ: cho phép lúc kéo, chặn ở điều kiện lưu + nút "Dồn xuống" (thay cho `eventOverlap: false`) |
| 2026-09-14 | R9 sửa lại: lọc category áp cho cả hai cột ở Bước 2 (bản trước ẩn nhầm) |
| 2026-09-14 | Ngày về trùng ngày đi được chuẩn hoá về null khi lưu |
| 2026-09-14 | Footer wizard: Huỷ / Lưu tạm / Tiếp tục; dialog rời bước có 3 lựa chọn |
| 2026-09-14 | Hoạt động tự do có `category` riêng; chi phí chỉ nhập ở Bước 4 |
| 2026-09-14 | Thêm `swapDays` — đổi plan hai ngày cho nhau |
| 2026-09-14 | Màn chi tiết chuyển thành 3 tab: Danh sách / Trục giờ / Chi phí |
| 2026-09-14 | Ghi chú tối đa 100 ký tự, có bộ đếm, chặn lưu ở mức trip |
| 2026-09-14 | Bước 2/3 phải PATCH kèm startDate/endDate (sửa lỗi mất ngày) |
| 2026-09-14 | Auto-assign dời mốc dirty; điều hướng sau khi lưu bỏ qua blocker |
| 2026-09-14 | Màn List: phân trang 12 trip/trang cho dạng lưới |
| 2026-09-14 | Quy ước ghi ngày tập trung ở `utils/dateFormat.ts` (en/vi DD/MM/YYYY, ja YYYY/MM/DD, có thứ) |
| 2026-09-14 | Ghi chú hiển thị ở panel phải (tab Danh sách) và tooltip (tab Trục giờ) |
| 2026-09-14 | Bố cục thống nhất: bộ lọc bên trái, tab chuyển chế độ xem bên phải |
