import type { Region } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import { matchesRegionQuery } from '../utils';
import { API_BASE_URL, requestJson } from './httpClient';

function isRegion(value: unknown): value is Region {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.name) &&
    (candidate.source === 'catalog' || candidate.source === 'custom')
  );
}

function isRegionArray(value: unknown): value is Region[] {
  return Array.isArray(value) && value.every(isRegion);
}

// See docs/features/place-search.md's "Region search".
export async function searchRegions(query: string, currentUserId: string): Promise<Region[]> {
  const all = await requestJson(`${API_BASE_URL}/regions`, isRegionArray);

  return all
    .filter((region) => region.source === 'catalog' || region.createdBy === currentUserId)
    .filter((region) => matchesRegionQuery(region, query));
}

export async function createRegion(name: string, currentUserId: string): Promise<Region> {
  // No client-side `id` — json-server always overwrites it on create.
  return requestJson(`${API_BASE_URL}/regions`, isRegion, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      source: 'custom',
      createdBy: currentUserId,
    }),
  });
}
