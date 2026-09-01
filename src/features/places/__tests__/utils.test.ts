import { describe, it, expect } from 'vitest';
import {
  canModifyPlace,
  filterVisiblePlaces,
  getPageCount,
  isPlaceVisibleTo,
  matchesCategory,
  matchesPlaceQuery,
  matchesRegionQuery,
  paginate,
  resolvePlaceImages,
} from '../utils';
import type { Place, Region, SavedPlace } from '../../../types';

function makePlace(overrides: Partial<Place>): Place {
  return {
    id: 'p1',
    title: 'Ninenzaka',
    coverUrl: 'https://example.com/ninenzaka.jpg',
    address: 'Higashiyama Ward, Kyoto',
    region: 'Kyoto',
    source: 'catalog',
    savedCount: 0,
    ...overrides,
  };
}

function makeSaved(overrides: Partial<SavedPlace>): SavedPlace {
  return { id: 'sp1', userId: 'u1', placeId: 'p1', addedAt: '2026-08-01T00:00:00Z', ...overrides };
}

describe('isPlaceVisibleTo', () => {
  it('catalog places are always visible', () => {
    expect(isPlaceVisibleTo(makePlace({ source: 'catalog' }), 'anyone')).toBe(true);
  });

  it('public custom places are visible to everyone', () => {
    const place = makePlace({ source: 'custom', isPublic: true, createdBy: 'owner' });
    expect(isPlaceVisibleTo(place, 'someone-else')).toBe(true);
  });

  it('private custom places are only visible to their creator', () => {
    const place = makePlace({ source: 'custom', isPublic: false, createdBy: 'owner' });
    expect(isPlaceVisibleTo(place, 'owner')).toBe(true);
    expect(isPlaceVisibleTo(place, 'someone-else')).toBe(false);
  });
});

describe('filterVisiblePlaces', () => {
  it('keeps catalog + own private + any public, drops others private', () => {
    const places = [
      makePlace({ id: 'p1', source: 'catalog' }),
      makePlace({ id: 'p2', source: 'custom', isPublic: false, createdBy: 'me' }),
      makePlace({ id: 'p3', source: 'custom', isPublic: false, createdBy: 'someone-else' }),
      makePlace({ id: 'p4', source: 'custom', isPublic: true, createdBy: 'someone-else' }),
    ];

    expect(filterVisiblePlaces(places, 'me').map((p) => p.id)).toEqual(['p1', 'p2', 'p4']);
  });
});

describe('canModifyPlace', () => {
  it('denies non-creators', () => {
    const place = makePlace({ source: 'custom', createdBy: 'owner' });
    expect(canModifyPlace(place, [], 'not-owner')).toBe(false);
  });

  it('denies catalog places even for the "creator" id match', () => {
    const place = makePlace({ source: 'catalog', createdBy: 'owner' });
    expect(canModifyPlace(place, [], 'owner')).toBe(false);
  });

  it('allows the creator when no one else has saved it', () => {
    const place = makePlace({ source: 'custom', createdBy: 'owner' });
    const savedByOwnerOnly = [makeSaved({ userId: 'owner' })];
    expect(canModifyPlace(place, savedByOwnerOnly, 'owner')).toBe(true);
  });

  it('blocks the creator once someone else has saved it', () => {
    const place = makePlace({ source: 'custom', createdBy: 'owner' });
    const savedByOthers = [makeSaved({ userId: 'owner' }), makeSaved({ userId: 'stranger' })];
    expect(canModifyPlace(place, savedByOthers, 'owner')).toBe(false);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 27 }, (_, i) => i + 1);

  it('slices the requested page and reports the full total', () => {
    expect(paginate(items, 1, 20)).toEqual({ items: items.slice(0, 20), totalCount: 27 });
    expect(paginate(items, 2, 20)).toEqual({ items: items.slice(20, 27), totalCount: 27 });
  });

  it('returns an empty page past the end', () => {
    expect(paginate(items, 3, 20)).toEqual({ items: [], totalCount: 27 });
  });
});

describe('getPageCount', () => {
  it('rounds up and never returns less than 1', () => {
    expect(getPageCount(0)).toBe(1);
    expect(getPageCount(20, 20)).toBe(1);
    expect(getPageCount(21, 20)).toBe(2);
    expect(getPageCount(27, 20)).toBe(2);
  });
});

describe('matchesPlaceQuery', () => {
  const place = makePlace({
    title: 'Tokyo Tower',
    address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo',
    region: 'Tokyo',
    country: 'Japan',
    aliases: ['東京タワー'],
  });

  it('matches an empty query unconditionally', () => {
    expect(matchesPlaceQuery(place, '')).toBe(true);
  });

  it('matches by title, address, or region, case-insensitively', () => {
    expect(matchesPlaceQuery(place, 'tokyo tower')).toBe(true);
    expect(matchesPlaceQuery(place, 'shibakoen')).toBe(true);
    expect(matchesPlaceQuery(place, 'TOKYO')).toBe(true);
  });

  it('matches a Japanese alias even though title/region are English', () => {
    expect(matchesPlaceQuery(place, '東京タワー')).toBe(true);
    expect(matchesPlaceQuery(place, '東京')).toBe(true); // substring of the alias
  });

  it('does not match unrelated text', () => {
    expect(matchesPlaceQuery(place, 'kyoto')).toBe(false);
  });

  it('is safe for a place with no aliases', () => {
    expect(matchesPlaceQuery(makePlace({ aliases: undefined }), 'ninenzaka')).toBe(true);
  });

  it("falls back to the place's region alias when the place has none of its own", () => {
    // Ninenzaka has no Japanese alias of its own here, only its region does.
    const ninenzaka = makePlace({ title: 'Ninenzaka', region: 'Kyoto', aliases: undefined });
    const regions: Region[] = [{ id: 'r1', name: 'Kyoto', source: 'catalog', aliases: ['京都'] }];

    expect(matchesPlaceQuery(ninenzaka, '京都', regions)).toBe(true);
    expect(matchesPlaceQuery(ninenzaka, '京都', [])).toBe(false); // no regions passed in = no fallback
    expect(matchesPlaceQuery(ninenzaka, '大阪', regions)).toBe(false); // Osaka alias, wrong region
  });
});

describe('matchesRegionQuery', () => {
  const region: Region = { id: 'r1', name: 'Kyoto', country: 'Japan', source: 'catalog', aliases: ['京都'] };

  it('matches an empty query unconditionally', () => {
    expect(matchesRegionQuery(region, '')).toBe(true);
  });

  it('matches by name or a Japanese alias', () => {
    expect(matchesRegionQuery(region, 'kyoto')).toBe(true);
    expect(matchesRegionQuery(region, '京都')).toBe(true);
    expect(matchesRegionQuery(region, 'osaka')).toBe(false);
  });
});

describe('matchesCategory', () => {
  it('matches everything when no category is selected ("All")', () => {
    expect(matchesCategory(makePlace({ category: 'restaurant' }), null)).toBe(true);
    expect(matchesCategory(makePlace({ category: undefined }), null)).toBe(true);
  });

  it('matches only places with that exact category', () => {
    expect(matchesCategory(makePlace({ category: 'restaurant' }), 'restaurant')).toBe(true);
    expect(matchesCategory(makePlace({ category: 'hotel' }), 'restaurant')).toBe(false);
  });

  it('excludes places with no category once a specific one is selected', () => {
    expect(matchesCategory(makePlace({ category: undefined }), 'restaurant')).toBe(false);
  });
});

describe('resolvePlaceImages', () => {
  it('returns the images gallery when present', () => {
    const place = makePlace({ images: ['a.jpg', 'b.jpg'] });
    expect(resolvePlaceImages(place)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('falls back to [coverUrl] when images is missing or empty', () => {
    expect(resolvePlaceImages(makePlace({ images: undefined }))).toEqual([makePlace({}).coverUrl]);
    expect(resolvePlaceImages(makePlace({ images: [] }))).toEqual([makePlace({}).coverUrl]);
  });
});
