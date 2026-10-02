import type { Trip } from '../../../types';
import { planTotal, totalsByDay } from '../../budget/utils/budgetRules';

// Chi phí dự trù của một chuyến đi. Nguồn sự thật là `trip.budgetPlan`
// (trip-budget.md D2) — trước Đợt 6 số này nằm rải trên từng ItineraryItem.

export function tripEstimatedCost(trip: Trip): number {
  return planTotal(trip.budgetPlan, trip.party);
}

// Quy chi phí về từng ngày, dayId -> tổng. Tính một lần rồi truyền xuống các
// DayCard thay vì để mỗi card tự cộng lại cả cây.
export function dayEstimatedCosts(trip: Trip): Record<string, number> {
  return totalsByDay(trip).byDay;
}

// Chi phí không gắn với ngày nào (vé máy bay, bảo hiểm...).
export function unassignedEstimatedCost(trip: Trip): number {
  return totalsByDay(trip).unassigned;
}

// Bình quân đầu người theo số người thực tế (`party`), không theo số thành
// viên có tên. Bước 4 hiển thị riêng suất người lớn / trẻ em; đây là con số
// gộp dùng cho màn xem và card. KHÔNG làm tròn ở đây — tầng hiển thị dùng
// formatPerHead() để ra đúng 2 chữ số thập phân.
export function costPerPerson(trip: Trip): number | null {
  const people = trip.party.adults + trip.party.children;
  if (people <= 0) {
    return null;
  }
  return tripEstimatedCost(trip) / people;
}
