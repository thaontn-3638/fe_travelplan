import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Place, Region } from '../../../types';
import { fetchPlaceCatalog } from '../api/placeApi';
import { getErrorMessage } from '../../../utils/typeGuards';
import { matchesCategory, matchesPlaceQuery, paginate } from '../utils';
import { useDebounce } from './useDebounce';

interface UsePlaceSearchFilters {
  category: string | null;
  // undefined = no saved-state filter; a Set (including empty) turns it on.
  savedPlaceIds: Set<string> | undefined;
}

interface UsePlaceSearchResult {
  places: Place[];
  totalCount: number;
  page: number;
  setPage: (page: number) => void;
  loading: boolean;
  error: string | null;
  isIdle: boolean;
  // Stable "reset selection to first result" key — does NOT change on a
  // local catalog mutation (patch/remove/addPlaceLocally), unlike `places`
  // itself, so saving a place doesn't snap the selection back to the top.
  defaultSelectedId: string | null;
  patchPlaceLocally: (placeId: string, patch: Partial<Place>) => void;
  removePlaceLocally: (placeId: string) => void;
  addPlaceLocally: (place: Place) => void;
}

const EMPTY_CATALOG = { places: [] as Place[], regions: [] as Region[] };

export function usePlaceSearch(
  rawQuery: string,
  currentUserId: string,
  filters: UsePlaceSearchFilters,
): UsePlaceSearchResult {
  const debouncedQuery = useDebounce(rawQuery, 500);
  const { category, savedPlaceIds } = filters;
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState(EMPTY_CATALOG);
  // Bumped only on a real network fetch, never a local mutation — lets
  // defaultSelectedId's effect tell the two apart (see below).
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, category, savedPlaceIds]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPlaceCatalog(currentUserId)
      .then((result) => {
        if (cancelled) return;
        setCatalog(result);
        setCatalogVersion((version) => version + 1);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getErrorMessage(err));
        setCatalog(EMPTY_CATALOG);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const filtered = useMemo(() => {
    let matched = catalog.places.filter((place) => matchesPlaceQuery(place, debouncedQuery, catalog.regions));
    matched = matched.filter((place) => matchesCategory(place, category ?? null));

    if (savedPlaceIds) {
      matched = matched.filter((place) => savedPlaceIds.has(place.id));
    }

    return paginate(matched, page);
  }, [catalog, debouncedQuery, category, savedPlaceIds, page]);

  const [defaultSelectedId, setDefaultSelectedId] = useState<string | null>(null);

  // Deliberately excludes `catalog`/`filtered` — only reruns on a real
  // filter/page change or fresh fetch (catalogVersion), not a local mutation.
  useEffect(() => {
    setDefaultSelectedId(filtered.items[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, category, savedPlaceIds, page, catalogVersion]);

  const patchPlaceLocally = useCallback((placeId: string, patch: Partial<Place>) => {
    setCatalog((prev) => ({
      ...prev,
      places: prev.places.map((place) => (place.id === placeId ? { ...place, ...patch } : place)),
    }));
  }, []);

  const removePlaceLocally = useCallback((placeId: string) => {
    setCatalog((prev) => ({ ...prev, places: prev.places.filter((place) => place.id !== placeId) }));
  }, []);

  const addPlaceLocally = useCallback((place: Place) => {
    setCatalog((prev) => ({ ...prev, places: [place, ...prev.places] }));
  }, []);

  return {
    places: filtered.items,
    totalCount: filtered.totalCount,
    page,
    setPage,
    loading,
    error,
    isIdle: debouncedQuery.trim() === '' && !category && !savedPlaceIds,
    defaultSelectedId,
    patchPlaceLocally,
    removePlaceLocally,
    addPlaceLocally,
  };
}
