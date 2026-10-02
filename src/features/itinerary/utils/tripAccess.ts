import type { Trip } from '../../../types';

// Một tài khoản thấy được trip khi là chủ, hoặc là thành viên đã gắn tài
// khoản. Thành viên chỉ có tên (không tài khoản) không ảnh hưởng gì ở đây.
export function canViewTrip(trip: Pick<Trip, 'ownerId' | 'travelers'>, userId: string): boolean {
  if (!userId) {
    return false;
  }
  return trip.ownerId === userId || trip.travelers.some((traveler) => traveler.userId === userId);
}

// Quyền "chủ trip": xoá trip, quản lý thành viên (xoá người, nhất là người đã
// gắn tài khoản — xoá là thu hồi quyền xem của họ) và bật/tắt link chia sẻ.
// Thành viên khác vẫn sửa được lịch trình, dự trù, ghi chi tiêu như thường.
// Trip cũ chưa có `ownerId` (trước migrate) thì ai xem được cũng quản lý được.
export function canManageTrip(trip: Pick<Trip, 'ownerId'>, userId: string): boolean {
  if (!userId) return false;
  return trip.ownerId === undefined || trip.ownerId === userId;
}

// Thành viên ứng với tài khoản đang đăng nhập (nếu có).
export function travelerOfUser(trip: Pick<Trip, 'travelers'>, userId: string) {
  return userId ? trip.travelers.find((traveler) => traveler.userId === userId) : undefined;
}
