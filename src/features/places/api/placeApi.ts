import type { Place, Region, SavedPlace } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { filterVisiblePlaces, isPlaceVisibleTo, resolveCoverUrl } from '../utils';
import { API_BASE_URL, requestJson } from './httpClient';
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

function isPlaceArray(value: unknown): value is Place[] {
  return Array.isArray(value) && value.every(isPlace);
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
    requestJson(`${API_BASE_URL}/places?_sort=-savedCount`, isPlaceArray),
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

export class PlaceGuardError extends Error {}

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
async function assertCanModifyPlace(placeId: string, currentUserId: string): Promise<void> {
  const others = await getOtherSavers(placeId, currentUserId);

  if (others.length > 0) {
    throw new PlaceGuardError(
      'Someone else has already saved this place, so it can no longer be edited, deleted, or made private.',
    );
  }
}

export async function updatePlace(placeId: string, patch: Partial<PlaceInput>, currentUserId: string): Promise<Place> {
  await assertCanModifyPlace(placeId, currentUserId);

  return requestJson(`${API_BASE_URL}/places/${placeId}`, isPlace, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function updatePlaceVisibility(placeId: string, isPublic: boolean, currentUserId: string): Promise<Place> {
  // Private → public is always allowed; only public → private needs the guard.
  if (!isPublic) {
    await assertCanModifyPlace(placeId, currentUserId);
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
  await assertCanModifyPlace(placeId, currentUserId);

  const ownRow = await requestJson(
    `${API_BASE_URL}/savedPlaces?placeId=${encodeURIComponent(placeId)}&userId=${encodeURIComponent(currentUserId)}`,
    isSavedPlaceArray,
  );

  await Promise.all(ownRow.map((row) => fetch(`${API_BASE_URL}/savedPlaces/${row.id}`, { method: 'DELETE' })));

  const response = await fetch(`${API_BASE_URL}/places/${placeId}`, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
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
    throw new Error(`Request failed (${response.status}).`);
  }
}
