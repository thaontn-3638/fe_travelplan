import type { Place, Region, TripRegion } from '../../../types';
import { matchesPlaceQuery } from '../../places/utils';
import type { CategoryKey } from '../../places/utils';

export const PLACE_PICKER_PAGE_SIZE = 20;

// Place.region là TÊN vùng (denormalized), không phải id — nên phép lọc theo
// điểm đến của trip là so khớp theo tên, có xét alias của vùng.
export function matchesTripRegions(
  place: Place,
  tripRegions: TripRegion[],
  allRegions: Region[],
): boolean {
  if (tripRegions.length === 0) {
    return true;
  }

  return tripRegions.some((tripRegion) => {
    if (place.region === tripRegion.name) {
      return true;
    }
    const region = allRegions.find((candidate) => candidate.id === tripRegion.id);
    const regionNames = [tripRegion.name, ...(region?.aliases ?? [])];

    // Xét cả alias của chính Place: place tự nhập có thể ghi region là "京都"
    // trong khi trip chọn "Kyoto", và ngược lại.
    return (
      regionNames.includes(place.region) ||
      (place.aliases ?? []).some((alias) => regionNames.includes(alias))
    );
  });
}

export interface PlaceFilterInput {
  places: Place[];
  regions: Region[];
  tripRegions: TripRegion[];
  query: string;
  category: CategoryKey | null;
  restrictToTripRegions: boolean;
}

export function filterPickerPlaces({
  places,
  regions,
  tripRegions,
  query,
  category,
  restrictToTripRegions,
}: PlaceFilterInput): Place[] {
  return places
    .filter((place) => !restrictToTripRegions || matchesTripRegions(place, tripRegions, regions))
    .filter((place) => !category || place.category === category)
    .filter((place) => matchesPlaceQuery(place, query, regions));
}
