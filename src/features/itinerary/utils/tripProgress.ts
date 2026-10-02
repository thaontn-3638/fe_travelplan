import type { Trip } from '../../../types';

// R11 — tiến độ lên lịch trình, hiển thị dạng "2/4" trên TripCard.
// Điều kiện "done" của mỗi bước là có ít nhất một dữ liệu thuộc bước đó.
export const TRIP_STEP_COUNT = 4;

export function tripProgress(trip: Trip): number {
  // Step 1 luôn xong: trip tồn tại nghĩa là đã qua bước thông tin chung.
  let done = 1;

  // Item ở khu "Chưa xếp ngày" chưa thuộc ngày nào nên không tính cho Step 2.
  const items = trip.days.flatMap((day) => day.items);

  if (items.length > 0) {
    done += 1; // Step 2 — đã sắp xếp
  }
  if (items.some((item) => item.startTime !== null)) {
    done += 1; // Step 3 — đã gán giờ
  }
  // B9 — chi phí dự trù giờ nằm ở `budgetPlan`; `budget`/`budgetPerPerson` là
  // hạn mức (đặt theo cả chuyến HOẶC theo đầu người — trước đây quên mất cách
  // thứ hai nên trip đặt hạn mức theo đầu người kẹt ở 3/4).
  if (trip.budget !== null || trip.budgetPerPerson !== null || trip.budgetPlan.length > 0) {
    done += 1; // Step 4 — đã dự trù chi phí
  }

  return done;
}

export function isDraftTrip(trip: Trip): boolean {
  return tripProgress(trip) === 1;
}
