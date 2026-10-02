# Chia sẻ lịch trình (共有) — Spec

Link công khai, **chỉ đọc**, để gửi chuyến đi cho người không có tài khoản (gia
đình, bạn bè chưa dùng app). Không phải tính năng mời thành viên.

## 1. File map

```
src/features/itinerary/components/ShareTripDialog.tsx  # dialog 2 công tắc mức + link (màn xem chi tiết)
src/features/itinerary/api/tripApi.ts                   # shareScopeOf, updateTripSharing, getSharedTrip
src/features/places/api/placeApi.ts                     # getPlacesByIds — địa điểm của trip (mức 1)
src/features/settlement/api/expenseApi.ts               # getExpenses — khoản chi (mức 2)
src/pages/SharedTripPage.tsx                            # /share/:token — trang công khai
src/routes/AppRoutes.tsx                                # route ngoài PublicRoute / ProtectedRoute
```

## 2. Hai mức chia sẻ — bật / tắt riêng

| Mức | Hiển thị | Không hiển thị |
|---|---|---|
| **1 · Kế hoạch** (`plan`) | Lịch trình từng ngày (giờ, địa điểm, hoạt động, **memo**, lọc theo loại), Timeline (hover / bấm xem memo), Dự trù (`BudgetPlanView`, tổng + bình quân đầu người, `BudgetBreakdown`) | **Tên / avatar thành viên**; gợi ý "còn N mục chưa dự trù"; "Chưa xếp ngày"; trạng thái, tiến độ, nút sửa |
| **2 · Chi tiêu thực tế** (`actual`) | Tab **実際の支出**: tổng đã chi, donut + chú giải theo hạng mục, danh sách khoản chi (ngày · tên · hạng mục · số tiền · **người trả** · chia cho mấy người · ghi chú; lọc theo hạng mục / người trả). Tab **精算**: chi phí từng người, số dư, thủ quỹ, ai chuyển cho ai bao nhiêu (+ sao chép tóm tắt) | Nút sửa / xoá khoản chi, "đã trả", đổi thủ quỹ; lịch sử 履歴 |
| **1 + 2** | Tất cả ở trên, thêm "予算との差" ở thẻ tổng và bảng **予算との比較** (dự trù vs thực tế theo hạng mục) trong tab 実際の支出 | — |

- Mức 2 **có tên thành viên** (không có tên thì không đọc được "ai trả ai").
  Dialog nhắc rõ điều này bằng dòng cảnh báo màu vàng dưới công tắc mức 2.
- Thứ tự tab trên trang: リスト · タイムライン · 予算 (mức 1; tab 予算 chỉ khi có
  `budgetPlan`) · 実際の支出 · 精算 (mức 2). Tab đầu tiên có được là tab mặc định.
- Header luôn có: tên trip, điểm đến, khoảng ngày, số ngày/đêm, số người.
- Địa điểm riêng tư của chủ trip vẫn hiện ở mức 1 (chủ trip đã chủ động chia sẻ).
- Trang chỉ tải phần đã bật: không bật mức 2 thì không gọi `GET /expenses`.

## 3. Dữ liệu

```ts
shareToken?: string | null;      // 32 hex ngẫu nhiên; có = đang chia sẻ
sharedAt?: string;
shareScope?: { plan: boolean; actual: boolean };
```

`shareScopeOf(trip)` trả về mức đang có hiệu lực: không có token → cả hai
`false`; có token mà chưa có `shareScope` (dữ liệu trước khi có 2 mức) →
`{ plan: true, actual: false }`.

| Thao tác (`updateTripSharing`) | Kết quả |
|---|---|
| `{ scope: { plan / actual: true } }` | bật mức đó; chưa có token thì tạo token |
| `{ scope: { …: false } }` còn mức kia | giữ token, chỉ tắt mức đó |
| tắt nốt mức cuối cùng | `shareToken: null` — link cũ thành "このリンクは使えません" |
| `'regenerate'` | token mới, giữ nguyên các mức — link cũ hết hiệu lực ngay |

`shareToken` / `shareScope` không thuộc phần nào của R10b (`trip-board.md`)
nên không gây xung đột khi lưu wizard. Là field cấp một vì json-server v1 không
lọc được theo field lồng (`?share.token=` bị bỏ qua và trả về mọi trip).

## 4. Quyền

- **Chỉ chủ trip** bật / tắt từng mức và tạo lại link (`canManageTrip`, kiểm
  lại trên bản mới nhất trong `updateTripSharing` → `TripNotOwnerError`).
- Thành viên khác mở dialog vẫn thấy mức nào đang bật và sao chép được link;
  công tắc bị khoá kèm dòng "共有の開始・停止は旅行の作成者だけができます。".
- Trang `/share/:token` không cần đăng nhập. Người đã đăng nhập mở link vẫn xem
  được (route nằm ngoài `PublicRoute`, vốn đẩy người đã đăng nhập về Dashboard).

## 5. Tải trip theo token (`getSharedTrip`)

1. Token sai định dạng (`/^[0-9a-f]{32}$/`) → `SharedTripNotFoundError`, không gọi server.
2. `GET /trips?shareToken=:token`, rồi **lọc lại ở client** `row.shareToken === token`
   — không tin bộ lọc của json-server.
3. Không có trip, hoặc có nhưng cả hai mức đều tắt → trang báo link không dùng
   được (không phân biệt "đã tắt" hay "đã đổi link"). Lỗi mạng → `LoadErrorState` + thử lại.
4. Mức 1 → `getPlacesByIds(placeIdsInTrip(trip))`; mức 2 → `getExpenses(trip.id)`.

## 6. UI

- Màn xem chi tiết: nút `共有` → dialog. Đang chia sẻ (ít nhất một mức) thì nút
  thành chip xanh `🌐 共有中`.
- Dialog: mô tả chung; **hai thẻ có công tắc** (レベル1：旅行プラン / レベル2：実際の
  支出), mỗi thẻ ghi rõ nội dung được hiển thị; trạng thái "リンクで共有中" / "共有して
  いません（どちらかをオンにするとリンクが作成されます）"; ô link chỉ đọc + sao chép
  (Clipboard API, lỗi thì vẫn chọn tay được) + mở trang; "リンクを再発行" kèm cảnh báo.
- Component dùng lại ở chế độ chỉ đọc: `ExpenseList` không truyền `onEdit` /
  `onRemove` thì ẩn nút; `SettlementTab` không truyền `onSettle` /
  `onTreasurerChange` thì ẩn "đã trả" và hiện thủ quỹ dạng chữ.
- Header trang công khai: logo, nhãn `閲覧専用`, đổi ngôn ngữ, nút
  "WanderPlanで旅を計画する" → `/register` (hoặc "WanderPlanを開く" nếu đã đăng nhập).

## 7. Giới hạn (mock server)

- Không có kiểm soát phía server: ai gọi thẳng `GET /trips` hay `GET /expenses`
  vẫn thấy mọi dữ liệu. Backend thật phải trả trang chia sẻ qua endpoint riêng
  chỉ nhận token và chỉ trả đúng các field của các mức đang bật (§2).
- Không có hết hạn link, không đếm lượt xem.

## 8. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-10-02 | Link công khai chỉ đọc, chỉ chủ trip bật/tắt |
| 2026-10-02 | Hai mức bật riêng: 1 = kế hoạch (không tên thành viên), 2 = chi tiêu thực tế **kể cả quyết toán và tên người trả**; bật cả hai thì thêm so sánh dự trù vs thực tế |
