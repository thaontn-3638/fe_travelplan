# Kế hoạch thực thi — Bước 4 & 計算

> Spec: `docs/features/trip-budget.md` (v2, chốt 2026-09-15).
> Doc này chỉ nói **làm gì, theo thứ tự nào, xong là thế nào**.

## Nguyên tắc

1. **Mỗi đợt merge được độc lập** — kết thúc đợt nào thì app vẫn chạy, `tsc -b`
   và `npm run test` vẫn xanh. Không có đợt nào để lại màn hình vỡ.
2. **Hàm thuần + test trước, UI sau.** Cả hai file `budgetRules.ts` và
   `settlementRules.ts` phải xong và xanh test trước khi dựng màn dùng nó. Đây
   là màn tiền — sai một phép làm tròn là mất niềm tin của cả nhóm.
3. **Không viết i18n tiếng Việt cứng trong component.** Repo đã có
   `i18nKeys.test.ts` khoá parity giữa `vi` / `ja` / `en`; thêm key phải thêm
   đủ ba file, nếu không test đỏ.
4. Mọi hàm tính tiền chạy trên **số nguyên đơn vị nhỏ nhất** (spec §2.5).

---

## Đợt 6 — Nền tảng dữ liệu & `budgetRules` ✅ xong 2026-09-15

*Không có UI mới. Kết thúc đợt: app chạy y như cũ, nhưng model và toán đã sẵn.*

**Kết quả:** `npx tsc -b` sạch · `npx eslint src` sạch · `npm run test`
**159/159 xanh** (25 test mới cho `budgetRules`) · `GET /trips` trả model mới,
`GET /expenses` trả `[]` · `dbSeed.test.ts` không loại bản ghi nào.
Migration chạy hai lần cho cùng kết quả (idempotent): 16 `traveler.id`,
10 `currency`, 10 `budgetPlan`, 1 khoản chuyển từ `estimatedCost`,
4 trip reset `spent: 0`, 28 place gán `priceCurrency`.

**Hai chỗ spec bị sửa trong lúc làm** (đã cập nhật vào `trip-budget.md`):
suất đầu người không được làm tròn khi tính (§3.1), và xoá mục con cuối cùng
thì cha về 0 chứ không giữ tổng (B2).

| # | Việc | File |
|---|---|---|
| 6.1 | Thêm `Currency`, `CostCategory`, `BudgetPricingMode`, `LumpSumSplit`, `BudgetNode`; `Trip` thêm `currency` / `budgetPlan` / `treasurerId`; `Traveler` thêm `id` / `isChild` / `guardianId`; `Place` thêm `priceCurrency` / `priceUnit`; **xoá `ItineraryItem.estimatedCost`** | `src/types/index.ts` |
| 6.2 | Migration một lần: sinh `traveler.id`, `currency: 'JPY'`, `budgetPlan: []`, `place.priceCurrency: 'JPY'`, **`spent: 0`** (xem ⚠ bên dưới), chuyển 1 item đang có `estimatedCost: 100` thành một `BudgetNode` | `scripts/migrate-budget.mjs` |
| 6.3 | Backup `db.before-budget-migration.json`; thêm collection `expenses: []` | `db.json` |
| 6.4 | `budgetRules.ts` đầy đủ theo hợp đồng spec §10 | `src/features/budget/utils/budgetRules.ts` |
| 6.5 | Test theo bảng spec §12 | `src/features/budget/__tests__/budgetRules.test.ts` |
| 6.6 | `tripCosts.ts` đọc từ `budgetPlan` thay vì `estimatedCost`; giữ nguyên chữ ký hàm để `DayCard` / màn xem không phải sửa | `src/features/itinerary/utils/tripCosts.ts` |
| 6.7 | `tripProgress` đổi điều kiện Bước 4 theo B9 | `utils/tripProgress.ts` |
| 6.8 | `isTrip()` validate `budgetPlan[]`, `traveler.id`, `currency` | `api/tripApi.ts` |

> ⚠ **`spent` trong `db.json` hiện có số (86400, 41200…) nhưng chưa có
> `Expense` nào.** Theo S8 thì `spent = Σ expenses`, nên để nguyên là dữ liệu
> mâu thuẫn ngay từ ngày đầu. Chọn một: **(a)** migration set `spent: 0`, hoặc
> **(b)** seed `expenses` khớp với số đó cho 2 trip demo. Khuyến nghị (a) cho
> sạch, (b) nếu cần dữ liệu đẹp để demo.

**Xong khi:** `npx tsc -b` sạch · `npm run test` xanh · `npm run mock` +
`GET /trips` trả model mới · `dbSeed.test.ts` không loại bản ghi nào ·
Dashboard / List / Detail render không lỗi console.

---

## Đợt 7 — UI Bước 4 ✅ xong 2026-09-15

*Kết thúc đợt: wizard đủ 4 bước, `TripProgressBar` đạt được 4/4.*

**Kết quả:** `npx tsc -b` sạch · `npx eslint src` sạch · `npm run test`
**173/173 xanh** (14 test mới: `money`, `BudgetStep`) · `vite build` ra đủ cả hai
bộ lưới động của bảng chi phí.

**Ba lỗi chỉ lộ ra khi chụp ảnh giao diện thật** (test không bắt được):
badge "mục đã bị xoá" đẩy ô nhập tên co về 0 → đổi thành icon-only có tooltip;
ô "chia cho" chiếm đúng cột Trẻ em khiến tiêu đề cột nói dối → gộp vào ô "cách
tính"; các ô trên mobile xếp chồng không nhãn, nhìn không ra ô nào là gì → thêm
nhãn `lg:hidden` cho từng ô.

| # | Việc | File |
|---|---|---|
| 7.1 | `BudgetStep.tsx` — shell 2 cột + `MobileColumnTabs` | `features/budget/components/` |
| 7.2 | `BudgetTotalsBar` — đơn vị tiền, hạn mức, 3 số tổng, thanh % (spec §5.1). Ẩn cột trẻ em khi `children === 0` | ↑ |
| 7.3 | `BudgetCategoryChips` — 5 loại + tổng tiền mỗi chip | ↑ |
| 7.4 | `BudgetTree` + `BudgetNodeRow` — cây 3 mức, khoá ô nhập ở node cha, menu `⋯` (B1, B2) | ↑ |
| 7.5 | `BudgetSuggestionRow` — hàng gợi ý từ lịch trình + `Thêm tất cả` (B3) | ↑ |
| 7.6 | `BudgetAnalysisPanel` — biểu đồ tròn + bảng theo ngày + cảnh báo (§5.3). **Đọc skill `dataviz` trước khi viết dòng code biểu đồ đầu tiên** | ↑ |
| 7.7 | `CurrencySelect` — dialog xác nhận, chặn đổi khi trip đã có Expense (B5) | ↑ |
| 7.8 | `useBudgetPlan` — state cục bộ + dirty + PATCH `{ currency, budget, budgetPlan }` | `features/budget/hooks/` |
| 7.9 | Nối vào wizard: bỏ `disabled` + badge "Sắp có" ở Bước 4, chuyển `Hoàn tất` từ Bước 3 sang Bước 4 | `TripWizardStepper.tsx`, `ItineraryEditPage.tsx`, `wizardSteps.ts` |
| 7.10 | Cảnh báo mềm `party` ↔ `travelers` (B7) | `BudgetTotalsBar` |
| 7.11 | i18n `vi` / `ja` / `en` | `src/i18n/locales/*.json` |

**Xong khi:** tạo được cây 3 mức, cha cộng đúng · đổi `party.adults` ở Bước 1
thì tổng Bước 4 đổi theo · xoá item ở Bước 2 thì node chi phí còn nguyên kèm
badge · dirty guard hoạt động như R10.

---

## Đợt 8 — Thành viên & Sổ chi tiêu ✅ xong 2026-09-15

*Kết thúc đợt: ghi được chi tiêu thật. Chưa có quyết toán.*

| # | Việc | File |
|---|---|---|
| 8.1 | `Expense`, `ExpenseShare`, `SplitMode`, `ExpenseKind` | `src/types/index.ts` |
| 8.2 | `expenseApi.ts` + `isExpense()` guard (validate tới từng `shares[]`) | `features/settlement/api/` |
| 8.3 | `useExpenses(tripId)` + `expensesSlice` | `features/settlement/hooks/`, `store/slices/` |
| 8.4 | `TravelerManager` — thêm người local, checkbox **Là trẻ em**, select **Người chi trả**, khoá xoá người đã có chi tiêu (S9) | `features/itinerary/components/` |
| 8.5 | Nối `TravelerManager` vào Bước 1 | `TripBasicsForm.tsx` |
| 8.6 | `spreadEvenly`, `allocateExpense`, `toPayableShares`, `validateExactShares` + **test property** (spec §12) | `features/settlement/utils/settlementRules.ts` |
| 8.7 | `ExpenseForm` — ô tiền lớn, chip loại, người ứng, **toggle Chia đều / Nhập riêng** với prefill, dòng "còn X chưa phân bổ", badge 👶 (S3) | `features/settlement/components/` |
| 8.8 | `ExpenseList` — nhóm theo ngày, filter, vuốt xoá, nhóm `settlement` riêng | ↑ |
| 8.9 | `SettlementWorkspacePage` + route `/settlement/:tripId` (mới có tab Nhật ký chi) | `src/pages/`, `src/routes/` |
| 8.10 | Cập nhật `trip.spent` sau mỗi thay đổi Expense (S8) | `useExpenses` |
| 8.11 | i18n ba ngôn ngữ | `src/i18n/locales/*.json` |

**Xong khi:** ghi 10 khoản chi với 4 người lớn + 1 trẻ, mọi khoản có
`Σ allocate === amount` · chế độ Nhập riêng chặn lưu khi lệch · `trip.spent`
khớp tổng.

---

## Đợt 9 — Đối chiếu, Quyết toán, Hub ✅ xong 2026-09-15

**Kết quả Đợt 8 + 9:** `npx tsc -b` sạch · `npx eslint src` sạch ·
`npm run test` **200/200 xanh** (27 test mới: 18 cho `settlementRules` gồm hai
property test, 8 cho `ExpenseForm`). Fixture chốt ở spec §9.3 được khoá bằng
test: tổng ¥182.400, Bi có suất ¥36.680 nhưng số dư 0, Lan gánh trọn, thủ quỹ
Minh với đúng 3 giao dịch đưa mọi số dư về 0.

**Hai lỗi bố cục chỉ lộ ra khi chụp ảnh mobile:** bảng *Chi phí theo từng người*
(7 cột) và bảng *Đối chiếu* bị cắt mất đúng cột **Số dư** và **Chênh lệch** —
hai con số quan trọng nhất. Dưới `lg` cả hai đổi sang bố cục thẻ, số dư đưa lên
đầu thẻ. Kèm một lỗi i18n: tiếng Anh in ra "split 1 ways" → thêm dạng số ít.


| # | Việc | File |
|---|---|---|
| 9.1 | `personCosts`, `balances`, `pickTreasurer`, `settleViaTreasurer`, `buildSettlementExpense`, `settlementText`, `varianceByCategory` | `settlementRules.ts` |
| 9.2 | Test còn lại spec §12, **gồm fixture chốt ở §9.3** | `features/settlement/__tests__/` |
| 9.3 | Tab **Đối chiếu** — bảng 5 loại, mở rộng tới `BudgetNode`, cảnh báo vượt 20% | `features/settlement/components/VarianceTable.tsx` |
| 9.4 | Tab **Quyết toán** — bảng *Chi phí theo từng người* (trẻ thụt vào dưới người lớn) + bảng *Cần chuyển cho thủ quỹ* + dropdown thủ quỹ (PATCH `treasurerId`) | `SettlementTab.tsx` |
| 9.5 | Nút `Đã trả` → POST `Expense` kind `settlement` (S6); banner "Đã quyết toán xong" + gợi ý đổi status `done` | ↑ |
| 9.6 | `📋 Sao chép tóm tắt` → text thuần | `settlementText` |
| 9.7 | `TripCostSummary` — component **dùng chung** hub + trip detail | `features/settlement/components/` |
| 9.8 | Hub `/settlement` — tổng kết cộng dồn, danh sách **tất cả** trip, chip trạng thái + select năm + search, FAB `＋ Ghi chi tiêu` chọn trip mặc định (§9.1) | `src/pages/SettlementHubPage.tsx` |
| 9.9 | Bật nav item `nav.settlement` (bỏ "Sắp có") | `DashboardLayout.tsx` |
| 9.10 | Tab "Chi phí" của trip detail: `TripCostSummary` + nút `Mở sổ chi tiêu →` | `ItineraryDetailPage.tsx` |
| 9.11 | i18n ba ngôn ngữ | `src/i18n/locales/*.json` |

**Xong khi:** toàn bộ smoke test spec §12 tick hết · Σ số dư = 0 tuyệt đối ·
trẻ em không xuất hiện trong bảng chuyển tiền · bấm `Đã trả` hết thì banner
quyết toán xong hiện lên.

---

## Đợt 10 — Dọn dẹp (gộp vào 9 nếu kịp)

- Cập nhật `docs/features/trip-board.md` theo bảng spec §13.
- Xoá `docs/features/itinerary-revamp.md` (đã gộp từ lâu).
- Cập nhật `docs/03-database-schema.md` với `expenses` + các trường mới.

---

## Rủi ro & cách giảm

| Rủi ro | Giảm thế nào |
|---|---|
| **Làm tròn lệch** → Σ ≠ tổng, mất niềm tin | Quy tắc phần dư nằm ở **đúng một hàm** `spreadEvenly`; property test chạy mọi số tiền 1..10,000 |
| **Bỏ `estimatedCost` làm vỡ chỗ khác** | Đợt 6.6 giữ nguyên chữ ký `tripCosts.ts`; `tsc -b` sẽ chỉ ra mọi chỗ còn đọc trường cũ — sửa hết trong cùng một đợt |
| **`traveler.id` chưa có ở dữ liệu cũ** | Migration 6.2 sinh trước; `isTrip()` từ chối trip thiếu `id` để không lọt xuống DB |
| **Logic trẻ em phức tạp, dễ sai thầm lặng** | Fixture chốt ở spec §9.3 (đã kiểm chứng bằng script) làm test hồi quy; bất biến "mọi trẻ em = 0" là assertion bắt buộc |
| **Bước 4 phình to, trôi lịch** | 7.6 (biểu đồ) và 7.10 (cảnh báo) cắt được mà vẫn giao được Bước 4 |
| **i18n thiếu key ở `ja` / `en`** | `i18nKeys.test.ts` đã khoá sẵn — sẽ đỏ ngay |

---

## Thứ tự đề xuất

```
Đợt 6 ──► Đợt 7 (giao được Bước 4 cho PO xem)
   │
   └────► Đợt 8 ──► Đợt 9 ──► Đợt 10
```

Đợt 8 chỉ phụ thuộc Đợt 6, nên **7 và 8 chạy song song được** nếu có hai người.
