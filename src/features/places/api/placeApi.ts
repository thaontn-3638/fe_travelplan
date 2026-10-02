import type { Place, Region, SavedPlace, Trip } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { filterVisiblePlaces, isPlaceVisibleTo, resolveCoverUrl } from '../utils';
import { API_BASE_URL, HttpError, requestJson, requestList } from './httpClient';
import { searchRegions } from './regionApi';

function isPlace(value: unknown): value is Place {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.address) &&
    isNonEmptyString(candidate.region) &&
    (candidate.source === 'catalog' || candidate.source === 'custom') &&
    typeof candidate.savedCount === 'number'
  );
}

function isSavedPlace(value: unknown): value is SavedPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.userId) &&
    isNonEmptyString(candidate.placeId) &&
    isNonEmptyString(candidate.addedAt)
  );
}

function isSavedPlaceArray(value: unknown): value is SavedPlace[] {
  return Array.isArray(value) && value.every(isSavedPlace);
}

export interface PlaceCatalog {
  places: Place[];
  regions: Region[];
}

// See docs/features/place-search.md's "Fetching & filtering" — fetched once
// per currentUserId, filtered/paginated client-side from there (usePlaceSearch).
export async function fetchPlaceCatalog(currentUserId: string): Promise<PlaceCatalog> {
  const [all, regions] = await Promise.all([
    requestList(`${API_BASE_URL}/places?_sort=-savedCount`, isPlace),
    searchRegions('', currentUserId),
  ]);

  return { places: filterVisiblePlaces(all, currentUserId), regions };
}

export interface PlaceInput {
  title: string;
  address: string;
  region: string;
  coverUrl?: string;
  images?: string[];
  category?: string;
  price?: number;
  description?: string;
  isPublic?: boolean;
}

export async function createPlace(input: PlaceInput, currentUserId: string): Promise<Place> {
  // No client-side `id` — json-server always overwrites it on create.
  const place: Omit<Place, 'id'> = {
    title: input.title,
    address: input.address,
    region: input.region,
    coverUrl: resolveCoverUrl(input.title, input.coverUrl),
    images: input.images,
    category: input.category,
    price: input.price,
    description: input.description,
    source: 'custom',
    isPublic: input.isPublic ?? false,
    createdBy: currentUserId,
    createdAt: new Date().toISOString(),
    savedCount: 0,
  };

  return requestJson(`${API_BASE_URL}/places`, isPlace, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(place),
  });
}

export type PlaceAction = 'edit' | 'delete' | 'makePrivate';
export type PlaceBlockReason = 'saved' | 'inTrip' | 'inSharedTrip';

export class PlaceGuardError extends Error {
  constructor(
    public readonly reason: PlaceBlockReason = 'saved',
    public readonly count = 0,
  ) {
    super(`Place is locked (${reason}).`);
    this.name = 'PlaceGuardError';
  }
}

// Mức độ "đang được dùng" của một địa điểm tự tạo.
export interface PlaceUsage {
  otherSavers: number; // người khác đã lưu
  trips: number; // trip (của bất kỳ ai) có mục trỏ tới địa điểm này
  sharedTrips: number; // trong số đó, trip có người khác ngoài người tạo địa điểm cùng xem
}

type TripLike = Pick<Trip, 'ownerId' | 'travelers' | 'days' | 'unscheduledItems'>;

// Chỉ tính mục lịch trình. `BudgetNode.linkedPlaceId` chỉ là bản denormalize
// để lấy giá tham khảo — node dự trù vẫn hiển thị được khi địa điểm mất.
export function tripUsesPlace(trip: TripLike, placeId: string): boolean {
  return (
    trip.days.some((day) => day.items.some((item) => item.placeId === placeId)) ||
    trip.unscheduledItems.some((item) => item.placeId === placeId)
  );
}

// Trip mà người khác (ngoài `creatorId`) cũng xem được — địa điểm chuyển sang
// riêng tư sẽ biến mất khỏi lịch trình của họ thành "địa điểm không tồn tại".
function isSharedWithOthers(trip: TripLike, creatorId: string): boolean {
  return (
    (trip.ownerId !== undefined && trip.ownerId !== creatorId) ||
    trip.travelers.some((traveler) => traveler.userId !== undefined && traveler.userId !== creatorId)
  );
}

function isTripLike(value: unknown): value is TripLike {
  const v = value as Partial<TripLike> | null;
  return Boolean(v && Array.isArray(v.days) && Array.isArray(v.unscheduledItems) && Array.isArray(v.travelers));
}

export async function getPlaceUsage(placeId: string, currentUserId: string): Promise<PlaceUsage> {
  const [others, trips] = await Promise.all([
    getOtherSavers(placeId, currentUserId),
    requestList(`${API_BASE_URL}/trips`, isTripLike),
  ]);
  const using = trips.filter((trip) => tripUsesPlace(trip, placeId));
  return {
    otherSavers: others.length,
    trips: using.length,
    sharedTrips: using.filter((trip) => isSharedWithOthers(trip, currentUserId)).length,
  };
}

// Luật chặn (place-search.md "Editing & deleting a custom place"):
// - người khác đã lưu → không sửa / xoá / chuyển riêng tư
// - đang nằm trong một trip bất kỳ → không xoá (trip sẽ có mục "không tồn tại")
// - đang nằm trong trip có người khác cùng xem → không chuyển riêng tư
export function placeBlockReason(usage: PlaceUsage, action: PlaceAction): PlaceBlockReason | null {
  if (usage.otherSavers > 0) return 'saved';
  if (action === 'delete' && usage.trips > 0) return 'inTrip';
  if (action === 'makePrivate' && usage.sharedTrips > 0) return 'inSharedTrip';
  return null;
}

export class PlaceNotVisibleError extends Error {}

// Everyone else's saved-list rows for this place — the edit/delete/visibility guard.
export async function getOtherSavers(placeId: string, currentUserId: string): Promise<SavedPlace[]> {
  const rows = await requestJson(
    `${API_BASE_URL}/savedPlaces?placeId=${encodeURIComponent(placeId)}`,
    isSavedPlaceArray,
  );
  return rows.filter((row) => row.userId !== currentUserId);
}

// Server-side enforcement of the guard — see docs/features/place-search.md's
// "Editing & deleting a custom place".
async function assertCanModifyPlace(placeId: string, currentUserId: string, action: PlaceAction): Promise<void> {
  const usage = await getPlaceUsage(placeId, currentUserId);
  const reason = placeBlockReason(usage, action);

  if (reason) {
    throw new PlaceGuardError(reason, reason === 'inTrip' ? usage.trips : usage.sharedTrips);
  }
}

export async function updatePlace(placeId: string, patch: Partial<PlaceInput>, currentUserId: string): Promise<Place> {
  await assertCanModifyPlace(placeId, currentUserId, patch.isPublic === false ? 'makePrivate' : 'edit');

  return requestJson(`${API_BASE_URL}/places/${placeId}`, isPlace, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function updatePlaceVisibility(placeId: string, isPublic: boolean, currentUserId: string): Promise<Place> {
  // Private → public is always allowed; only public → private needs the guard.
  if (!isPublic) {
    await assertCanModifyPlace(placeId, currentUserId, 'makePrivate');
  }

  return requestJson(`${API_BASE_URL}/places/${placeId}`, isPlace, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isPublic }),
  });
}

async function incrementSavedCount(place: Place): Promise<Place> {
  return requestJson(`${API_BASE_URL}/places/${place.id}`, isPlace, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedCount: place.savedCount + 1 }),
  });
}

export async function deletePlace(placeId: string, currentUserId: string): Promise<void> {
  await assertCanModifyPlace(placeId, currentUserId, 'delete');

  const ownRow = await requestJson(
    `${API_BASE_URL}/savedPlaces?placeId=${encodeURIComponent(placeId)}&userId=${encodeURIComponent(currentUserId)}`,
    isSavedPlaceArray,
  );

  await Promise.all(ownRow.map((row) => fetch(`${API_BASE_URL}/savedPlaces/${row.id}`, { method: 'DELETE' })));

  const response = await fetch(`${API_BASE_URL}/places/${placeId}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new HttpError(response.status);
  }
}

export async function getSavedPlaces(userId: string): Promise<SavedPlace[]> {
  return requestJson(`${API_BASE_URL}/savedPlaces?userId=${encodeURIComponent(userId)}`, isSavedPlaceArray);
}

// Re-fetches and re-checks visibility against fresh data rather than
// trusting the caller's possibly-stale `place` — see "Save guard" in
// docs/features/place-search.md.
export async function savePlace(place: Place, userId: string): Promise<{ savedPlace: SavedPlace; place: Place }> {
  const current = await requestJson(`${API_BASE_URL}/places/${place.id}`, isPlace);

  if (!isPlaceVisibleTo(current, userId)) {
    throw new PlaceNotVisibleError('This place is private and can no longer be saved.');
  }

  const existing = await requestJson(
    `${API_BASE_URL}/savedPlaces?userId=${encodeURIComponent(userId)}&placeId=${encodeURIComponent(place.id)}`,
    isSavedPlaceArray,
  );

  if (existing[0]) {
    return { savedPlace: existing[0], place: current };
  }

  const savedPlace = await requestJson(`${API_BASE_URL}/savedPlaces`, isSavedPlace, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      placeId: place.id,
      addedAt: new Date().toISOString(),
    }),
  });

  const updatedPlace = await incrementSavedCount(current);
  return { savedPlace, place: updatedPlace };
}

export async function removeSavedPlace(savedPlaceId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/savedPlaces/${savedPlaceId}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new HttpError(response.status);
  }
}

// Trang chia sẻ công khai: lấy đúng các địa điểm mà trip dùng — kể cả địa
// điểm riêng tư của chủ trip, vì chủ trip đã chủ động chia sẻ lịch trình này.
export async function getPlacesByIds(ids: string[]): Promise<Place[]> {
  if (ids.length === 0) return [];
  const wanted = new Set(ids);
  const rows = await requestList(`${API_BASE_URL}/places`, isPlace);
  return rows.filter((place) => wanted.has(place.id));
}
