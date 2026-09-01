import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Place } from '../../../types';
import { getSavedPlaces, removeSavedPlace as deleteSavedPlaceRow, savePlace } from '../api/placeApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { addSavedPlace, removeSavedPlaceRow, setSavedPlaces } from '../../../store/slices/savedPlacesSlice';

interface UseSavedPlacesResult {
  savedPlaceIds: Set<string>;
  isSaved: (placeId: string) => boolean;
  save: (place: Place) => Promise<Place>;
  remove: (placeId: string) => Promise<void>;
  removeLocally: (placeId: string) => void;
  loading: boolean;
  count: number;
  // Force re-fetch from the server — see docs/features/place-search.md's
  // "Saved places" for why callers do this on tab focus rather than polling.
  refresh: () => void;
}

// Backed by Redux (savedPlacesSlice) — see docs/features/place-search.md's
// "Saved places" for why (shared between the header badge and DiscoverPage).
export function useSavedPlaces(currentUserId: string): UseSavedPlacesResult {
  const dispatch = useAppDispatch();
  const savedPlaces = useAppSelector((state) => state.savedPlaces.items);
  const loadedForUserId = useAppSelector((state) => state.savedPlaces.loadedForUserId);
  const [loading, setLoading] = useState(true);

  // `force` (used by `refresh` below) bypasses the loadedForUserId cache.
  const fetchSavedPlaces = useCallback(
    (force = false) => {
      if (!currentUserId) {
        setLoading(false);
        return () => {};
      }

      if (!force && loadedForUserId === currentUserId) {
        setLoading(false);
        return () => {};
      }

      let cancelled = false;
      setLoading(true);

      getSavedPlaces(currentUserId)
        .then((rows) => {
          if (!cancelled) dispatch(setSavedPlaces({ userId: currentUserId, items: rows }));
        })
        .catch(() => {
          if (!cancelled) dispatch(setSavedPlaces({ userId: currentUserId, items: [] }));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    },
    [currentUserId, loadedForUserId, dispatch],
  );

  useEffect(() => fetchSavedPlaces(), [fetchSavedPlaces]);

  const refresh = useCallback(() => {
    fetchSavedPlaces(true);
  }, [fetchSavedPlaces]);

  const savedPlaceIds = useMemo(() => new Set(savedPlaces.map((row) => row.placeId)), [savedPlaces]);

  const isSaved = useCallback((placeId: string) => savedPlaceIds.has(placeId), [savedPlaceIds]);

  const save = useCallback(
    async (place: Place): Promise<Place> => {
      const { savedPlace, place: updatedPlace } = await savePlace(place, currentUserId);
      dispatch(addSavedPlace(savedPlace));
      return updatedPlace;
    },
    [currentUserId, dispatch],
  );

  const remove = useCallback(
    async (placeId: string): Promise<void> => {
      const row = savedPlaces.find((item) => item.placeId === placeId);
      if (!row) return;

      await deleteSavedPlaceRow(row.id);
      dispatch(removeSavedPlaceRow(row.id));
    },
    [savedPlaces, dispatch],
  );

  // No DELETE call — for when the row was already removed server-side as a
  // side effect (deletePlace's self-cascade) and the cache just needs to catch up.
  const removeLocally = useCallback(
    (placeId: string) => {
      const row = savedPlaces.find((item) => item.placeId === placeId);
      if (row) dispatch(removeSavedPlaceRow(row.id));
    },
    [savedPlaces, dispatch],
  );

  return { savedPlaceIds, isSaved, save, remove, removeLocally, loading, count: savedPlaces.length, refresh };
}
