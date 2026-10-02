import type {
  BudgetNode,
  CostCategory,
  Currency,
  ItineraryDay,
  ItineraryItem,
  PartySize,
  ShareScope,
  Traveler,
  Trip,
  TripRegion,
  TripStatus,
} from '../../../types';
import { COST_CATEGORIES } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { API_BASE_URL, HttpError, requestJson, requestList } from '../../places/api/httpClient';
import { canManageTrip, canViewTrip } from '../utils/tripAccess';

const TRIP_STATUSES: TripStatus[] = ['idea', 'planning', 'confirmed', 'ongoing', 'settling', 'done'];
const CURRENCIES: Currency[] = ['JPY', 'VND', 'USD'];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableTime(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && TIME_PATTERN.test(value));
}

// Validate sâu tới từng item: dữ liệu rác kiểu "NaN:NaN" từng lọt xuống db vì
// guard cũ chỉ kiểm tra `Array.isArray(days)`.
function isItineraryItem(value: unknown): value is ItineraryItem {
  if (!isRecord(value)) {
    return false;
  }

  const hasBody =
    value.kind === 'place' ? isNonEmptyString(value.placeId) : isNonEmptyString(value.title);

  return (
    isNonEmptyString(value.id) &&
    (value.kind === 'place' || value.kind === 'activity') &&
    hasBody &&
    isNullableTime(value.startTime) &&
    isNullableTime(value.endTime) &&
    (value.startTime === null) === (value.endTime === null) &&
    typeof value.order === 'number'
  );
}

function isItineraryDay(value: unknown): value is ItineraryDay {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.date) &&
    Array.isArray(value.items) &&
    value.items.every(isItineraryItem)
  );
}

function isTripRegion(value: unknown): value is TripRegion {
  return isRecord(value) && isNonEmptyString(value.id) && isNonEmptyString(value.name);
}

function isPartySize(value: unknown): value is PartySize {
  return isRecord(value) && typeof value.adults === 'number' && typeof value.children === 'number';
}

// `id` của traveler là khoá của mọi tham chiếu chia tiền — thiếu nó thì lịch
// sử chi tiêu sẽ trỏ sai người, nên chặn ngay ở cửa (trip-budget.md §2.3).
function isTraveler(value: unknown): value is Traveler {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.initials) &&
    isNonEmptyString(value.colorClass) &&
    (value.isChild === undefined || typeof value.isChild === 'boolean') &&
    (value.guardianId === undefined || isNonEmptyString(value.guardianId))
  );
}

function isBudgetNode(value: unknown): value is BudgetNode {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    (value.parentId === null || isNonEmptyString(value.parentId)) &&
    COST_CATEGORIES.includes(value.category as CostCategory) &&
    typeof value.title === 'string' &&
    (value.pricingMode === 'perPerson' || value.pricingMode === 'lumpSum') &&
    typeof value.quantity === 'number' &&
    value.quantity >= 1 &&
    typeof value.order === 'number'
  );
}

// Export để test khoá được dữ liệu seed trong db.json sau migration.
export function isTrip(value: unknown): value is Trip {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    (value.ownerId === undefined || isNonEmptyString(value.ownerId)) &&
    Array.isArray(value.regions) &&
    value.regions.every(isTripRegion) &&
    isNonEmptyString(value.startDate) &&
    (value.endDate === null || isNonEmptyString(value.endDate)) &&
    TRIP_STATUSES.includes(value.status as TripStatus) &&
    Array.isArray(value.travelers) &&
    value.travelers.every(isTraveler) &&
    isPartySize(value.party) &&
    CURRENCIES.includes(value.currency as Currency) &&
    (value.budget === null || typeof value.budget === 'number') &&
    (value.budgetPerPerson === null || typeof value.budgetPerPerson === 'number') &&
    typeof value.spent === 'number' &&
    Array.isArray(value.budgetPlan) &&
    value.budgetPlan.every(isBudgetNode) &&
    (value.treasurerId === undefined || isNonEmptyString(value.treasurerId)) &&
    Array.isArray(value.days) &&
    value.days.every(isItineraryDay) &&
    Array.isArray(value.unscheduledItems) &&
    value.unscheduledItems.every(isItineraryItem) &&
    isNonEmptyString(value.updatedAt) &&
    (value.shareToken === undefined || value.shareToken === null || isNonEmptyString(value.shareToken)) &&
    (value.shareScope === undefined ||
      (typeof value.shareScope === 'object' &&
        value.shareScope !== null &&
        typeof (value.shareScope as Record<string, unknown>).plan === 'boolean' &&
        typeof (value.shareScope as Record<string, unknown>).actual === 'boolean'))
  );
}

// Sắp xếp mới-cập-nhật-trước — xem ghi chú json-server v1-beta trong
// docs/03-database-schema.md: tham số là `_sort`, không phải `sort`.
//
// Chỉ trả về trip mà `userId` được xem (canViewTrip). json-server không lọc
// được điều kiện "chủ HOẶC thành viên" nên lọc ở client — đủ cho mock server;
// backend thật phải lọc ở phía server.
export async function getTrips(userId: string): Promise<Trip[]> {
  const rows = await requestList(`${API_BASE_URL}/trips?_sort=-updatedAt`, isTrip);
  return rows.filter((trip) => canViewTrip(trip, userId));
}

// Trip đã có khoản chi thì KHÔNG được xoá: xoá là bỏ lại các khoản chi mồ côi
// (vẫn bị tải ở màn Tính toán), và mất luôn lịch sử ai nợ ai.
export class TripHasExpensesError extends Error {
  constructor(public readonly count: number) {
    super(`Trip has ${count} expense(s).`);
    this.name = 'TripHasExpensesError';
  }
}

export async function getTrip(id: string): Promise<Trip> {
  return requestJson(`${API_BASE_URL}/trips/${id}`, isTrip);
}

export interface CreateTripInput {
  ownerId: string;
  name: string;
  regions: TripRegion[];
  startDate: string;
  endDate: string | null;
  days: ItineraryDay[];
  travelers: Trip['travelers'];
  party: PartySize;
}

// Step 1 lưu ngay: trip tồn tại thật từ bước đầu tiên, nên các bước sau chỉ là
// PATCH lên một bản ghi có thật (xem trip-board.md §4).
export async function createTrip(input: CreateTripInput): Promise<Trip> {
  // Không gửi `id` từ client — json-server luôn ghi đè khi tạo mới.
  const trip: Omit<Trip, 'id'> = {
    ownerId: input.ownerId,
    name: input.name,
    regions: input.regions,
    startDate: input.startDate,
    endDate: input.endDate,
    status: 'idea',
    travelers: input.travelers,
    party: input.party,
    currency: 'JPY',
    budget: null,
    budgetPerPerson: null,
    spent: 0,
    budgetPlan: [],
    days: input.days,
    unscheduledItems: [],
    updatedAt: new Date().toISOString(),
  };

  return requestJson(`${API_BASE_URL}/trips`, isTrip, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  });
}

// PATCH chung (đổi tên, đổi status, lưu một bước của wizard...). Luôn bump
// `updatedAt` để màn List sắp xếp theo `_sort=-updatedAt` phản ánh đúng.
export async function updateTrip(id: string, patch: Partial<Omit<Trip, 'id'>>): Promise<Trip> {
  return requestJson(`${API_BASE_URL}/trips/${id}`, isTrip, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, updatedAt: new Date().toISOString() }),
  });
}

// json-server v1-beta không có route lồng `/trips/:id/days` — mọi thay đổi
// ngày/item đều PATCH nguyên mảng `days` (và `unscheduledItems`).
export async function updateTripDays(
  id: string,
  days: ItineraryDay[],
  unscheduledItems: ItineraryItem[] = [],
): Promise<Trip> {
  return updateTrip(id, { days, unscheduledItems });
}

export class TripNotOwnerError extends Error {
  constructor() {
    super('Only the trip owner can do this.');
    this.name = 'TripNotOwnerError';
  }
}

export async function deleteTrip(id: string, userId: string): Promise<void> {
  // Kiểm tra lại ngay trước khi xoá, không tin số liệu UI đang cầm (có thể
  // người khác vừa ghi thêm một khoản chi).
  const current = await requestJson(`${API_BASE_URL}/trips/${encodeURIComponent(id)}`, isTrip);
  if (!canManageTrip(current, userId)) {
    throw new TripNotOwnerError();
  }

  const expenses = await requestJson(
    `${API_BASE_URL}/expenses?tripId=${encodeURIComponent(id)}`,
    (value: unknown): value is unknown[] => Array.isArray(value),
  );
  if (expenses.length > 0) {
    throw new TripHasExpensesError(expenses.length);
  }

  const response = await fetch(`${API_BASE_URL}/trips/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    throw new HttpError(response.status);
  }
}

// ---------------------------------------------------------------- chia sẻ (trip-share.md)

function newShareToken(): string {
  // 32 ký tự hex ngẫu nhiên — đủ để không đoán được (mock server không có
  // xác thực phía server; backend thật phải kiểm token ở server).
  return crypto.randomUUID().replace(/-/g, '');
}

// Đổi một mức (bật/tắt riêng) hoặc tạo lại link (giữ nguyên các mức).
export type ShareAction = { scope: Partial<ShareScope> } | 'regenerate';

// Mức đang có hiệu lực. Không có token = không chia sẻ gì, bất kể shareScope.
export function shareScopeOf(trip: Pick<Trip, 'shareToken' | 'shareScope'>): ShareScope {
  if (!trip.shareToken) return { plan: false, actual: false };
  return trip.shareScope ?? { plan: true, actual: false };
}

// Chỉ chủ trip. Kiểm lại quyền trên bản mới nhất, không tin UI.
export async function updateTripSharing(tripId: string, userId: string, action: ShareAction): Promise<Trip> {
  const current = await getTrip(tripId);
  if (!canManageTrip(current, userId)) {
    throw new TripNotOwnerError();
  }

  if (action === 'regenerate') {
    if (!current.shareToken) return current;
    return updateTrip(tripId, { shareToken: newShareToken(), sharedAt: new Date().toISOString() });
  }

  const next: ShareScope = { ...shareScopeOf(current), ...action.scope };
  // Tắt cả hai mức = ngừng chia sẻ: bỏ token để link cũ chết hẳn.
  if (!next.plan && !next.actual) {
    return updateTrip(tripId, { shareToken: null, shareScope: next });
  }
  return updateTrip(tripId, {
    shareScope: next,
    ...(current.shareToken ? {} : { shareToken: newShareToken(), sharedAt: new Date().toISOString() }),
  });
}

export class SharedTripNotFoundError extends Error {
  constructor() {
    super('Shared trip not found.');
    this.name = 'SharedTripNotFoundError';
  }
}

// Trang công khai: KHÔNG cần đăng nhập. Lọc lại ở client vì json-server bỏ qua
// tham số lọc lạ thay vì báo lỗi — tin nguyên kết quả là lộ mọi trip.
export async function getSharedTrip(token: string): Promise<Trip> {
  if (!/^[0-9a-f]{32}$/.test(token)) {
    throw new SharedTripNotFoundError();
  }
  const rows = await requestList(`${API_BASE_URL}/trips?shareToken=${encodeURIComponent(token)}`, isTrip);
  const trip = rows.find((row) => row.shareToken === token);
  const scope = trip ? shareScopeOf(trip) : null;
  if (!trip || !scope || (!scope.plan && !scope.actual)) {
    throw new SharedTripNotFoundError();
  }
  return trip;
}
