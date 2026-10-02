import { useCallback, useEffect, useState } from 'react';
import type { Place, Region } from '../../../types';
import { fetchPlaceCatalog } from '../../places/api/placeApi';

interface PlaceCatalogState {
  placesById: Map<string, Place>;
  regions: Region[];
}

interface PlaceCatalogResult extends PlaceCatalogState {
  // Đưa ngay place vừa tạo vào catalog đang cầm — khỏi tải lại cả catalog.
  addPlace: (place: Place) => void;
}

// Catalog dùng chung cho cover ảnh, panel chọn địa điểm và bộ lọc theo vùng.
export function usePlaceCatalog(currentUserId: string): PlaceCatalogResult {
  const [result, setResult] = useState<PlaceCatalogState>({ placesById: new Map(), regions: [] });

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let cancelled = false;

    fetchPlaceCatalog(currentUserId)
      .then(({ places, regions }) => {
        if (!cancelled) {
          setResult({ placesById: new Map(places.map((place) => [place.id, place])), regions });
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ placesById: new Map(), regions: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const addPlace = useCallback((place: Place) => {
    setResult((current) => ({
      ...current,
      placesById: new Map(current.placesById).set(place.id, place),
    }));
  }, []);

  return { ...result, addPlace };
}
