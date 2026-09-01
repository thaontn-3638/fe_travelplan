import type { Place, Region, SavedPlace } from '../../types';

export const PLACES_PAGE_SIZE = 20;

// Shared by the create/edit form's category select and Discover's filter chips.
export const CATEGORY_KEYS = ['attraction', 'restaurant', 'hotel', 'shopping', 'other'] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// See docs/features/place-search.md's "Visibility rule".
export function isPlaceVisibleTo(place: Place, currentUserId: string): boolean {
  if (place.source === 'catalog') {
    return true;
  }

  return Boolean(place.isPublic) || place.createdBy === currentUserId;
}

export function filterVisiblePlaces(places: Place[], currentUserId: string): Place[] {
  return places.filter((place) => isPlaceVisibleTo(place, currentUserId));
}

// See docs/features/place-search.md's "Editing & deleting a custom place".
export function canModifyPlace(place: Place, savedByOthers: SavedPlace[], currentUserId: string): boolean {
  if (place.source !== 'custom' || place.createdBy !== currentUserId) {
    return false;
  }

  return savedByOthers.every((saved) => saved.userId === currentUserId);
}

// See docs/features/place-search.md's "Multi-language search matching".
export function matchesPlaceQuery(place: Place, query: string, regions: Region[] = []): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystacks = [place.title, place.address, place.region, place.country, ...(place.aliases ?? [])];
  if (haystacks.some((value) => value?.toLowerCase().includes(normalizedQuery))) {
    return true;
  }

  const region = regions.find((candidate) => candidate.name === place.region);
  return region ? matchesRegionQuery(region, normalizedQuery) : false;
}

export function matchesCategory(place: Place, category: string | null): boolean {
  return !category || place.category === category;
}

export function matchesRegionQuery(region: Region, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystacks = [region.name, region.country, ...(region.aliases ?? [])];
  return haystacks.some((value) => value?.toLowerCase().includes(normalizedQuery));
}

export function resolvePlaceImages(place: Place): string[] {
  return place.images && place.images.length > 0 ? place.images : [place.coverUrl];
}

export interface Page<T> {
  items: T[];
  totalCount: number;
}

export function paginate<T>(items: T[], page: number, pageSize = PLACES_PAGE_SIZE): Page<T> {
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), totalCount: items.length };
}

export function getPageCount(totalCount: number, pageSize = PLACES_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(totalCount / pageSize));
}

// Falls back to a placehold.co placeholder (not picsum.photos — a plain
// image generator has nothing to 503 on, unlike a random-photo service).
export function resolveCoverUrl(title: string, coverUrl?: string): string {
  const trimmed = coverUrl?.trim();
  if (trimmed) {
    return trimmed;
  }

  const label = encodeURIComponent(title.trim() || 'Place');
  return `https://placehold.co/640x400/DCEEE9/223138?font=roboto&text=${label}`;
}
