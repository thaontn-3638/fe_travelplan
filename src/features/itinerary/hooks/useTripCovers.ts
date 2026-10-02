import { useEffect, useState } from 'react';
import type { Place } from '../../../types';
import { fetchPlaceCatalog } from '../../places/api/placeApi';

// Places-by-id lookup used to resolve each Trip's cover photo (first place in
// the itinerary) — see resolveTripCoverUrl in utils/tripDefaults.ts.
export function useTripCovers(currentUserId: string): Map<string, Place> {
  const [placesById, setPlacesById] = useState<Map<string, Place>>(new Map());

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let cancelled = false;

    fetchPlaceCatalog(currentUserId)
      .then(({ places }) => {
        if (!cancelled) setPlacesById(new Map(places.map((place) => [place.id, place])));
      })
      .catch(() => {
        if (!cancelled) setPlacesById(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  return placesById;
}
