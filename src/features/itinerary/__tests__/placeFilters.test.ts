import { describe, expect, it } from 'vitest';
import type { Place, Region, TripRegion } from '../../../types';
import { filterPickerPlaces, matchesTripRegions } from '../utils/placeFilters';

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p1',
    title: 'Kinkaku-ji',
    coverUrl: '',
    address: 'Kyoto',
    region: 'Kyoto',
    source: 'catalog',
    savedCount: 0,
    category: 'attraction',
    ...overrides,
  };
}

const regions: Region[] = [
  { id: 'r1', name: 'Kyoto', source: 'catalog', aliases: ['京都'] },
  { id: 'r2', name: 'Osaka', source: 'catalog' },
];
const tripRegions: TripRegion[] = [{ id: 'r1', name: 'Kyoto' }];

describe('lọc panel địa điểm theo điểm đến của trip', () => {
  it('khớp theo tên vùng', () => {
    expect(matchesTripRegions(place(), tripRegions, regions)).toBe(true);
    expect(matchesTripRegions(place({ region: 'Osaka' }), tripRegions, regions)).toBe(false);
  });

  it('khớp cả theo alias của vùng', () => {
    expect(matchesTripRegions(place({ region: '京都' }), tripRegions, regions)).toBe(true);
  });

  it('trip chưa chọn điểm đến thì không lọc', () => {
    expect(matchesTripRegions(place({ region: 'Osaka' }), [], regions)).toBe(true);
  });

  it('bỏ lọc vùng thì giữ lại place ở vùng khác', () => {
    const places = [place(), place({ id: 'p2', region: 'Osaka', title: 'Dotonbori' })];

    const restricted = filterPickerPlaces({
      places,
      regions,
      tripRegions,
      query: '',
      category: null,
      restrictToTripRegions: true,
    });
    expect(restricted.map((entry) => entry.id)).toEqual(['p1']);

    const unrestricted = filterPickerPlaces({
      places,
      regions,
      tripRegions,
      query: '',
      category: null,
      restrictToTripRegions: false,
    });
    expect(unrestricted).toHaveLength(2);
  });

  it('lọc theo category và từ khoá', () => {
    const places = [place(), place({ id: 'p2', title: 'Nishiki Market', category: 'shopping' })];

    expect(
      filterPickerPlaces({
        places,
        regions,
        tripRegions,
        query: '',
        category: 'shopping',
        restrictToTripRegions: true,
      }).map((entry) => entry.id),
    ).toEqual(['p2']);

    expect(
      filterPickerPlaces({
        places,
        regions,
        tripRegions,
        query: 'nishiki',
        category: null,
        restrictToTripRegions: true,
      }).map((entry) => entry.id),
    ).toEqual(['p2']);
  });
});

describe('alias hai chiều giữa Place và Region', () => {
  it('place ghi region bằng alias tiếng Nhật vẫn khớp trip chọn tên latin', () => {
    expect(matchesTripRegions(place({ region: '京都' }), tripRegions, regions)).toBe(true);
  });

  it('place có alias trùng tên vùng của trip cũng khớp', () => {
    const custom = place({ region: 'Kyoto-shi', aliases: ['Kyoto'] });
    expect(matchesTripRegions(custom, tripRegions, regions)).toBe(true);
  });

  it('không liên quan thì vẫn loại', () => {
    expect(matchesTripRegions(place({ region: 'Sapporo' }), tripRegions, regions)).toBe(false);
  });
});
