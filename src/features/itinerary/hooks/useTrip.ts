import { useCallback, useEffect, useState } from 'react';
import type { ItineraryDay, Trip } from '../../../types';
import { getTrip, updateTrip } from '../api/tripApi';
import { getErrorMessage } from '../../../utils/typeGuards';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { canViewTrip } from '../utils/tripAccess';
import { upsertTrip } from '../../../store/slices/tripsSlice';

interface UseTripResult {
  trip: Trip | null;
  loading: boolean;
  error: string | null;
  // Optimistic local update — callers apply this immediately (e.g. while
  // dragging) and separately persist via `patch`/`patchDays`.
  setLocalTrip: (trip: Trip) => void;
  patch: (input: Partial<Omit<Trip, 'id'>>) => Promise<Trip>;
  patchDays: (days: ItineraryDay[]) => Promise<Trip>;
}

export function useTrip(tripId: string | undefined): UseTripResult {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? '');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getTrip(tripId)
      .then((result) => {
        if (cancelled) return;
        // Mở thẳng URL trip của tài khoản khác thì xử lý như không tồn tại.
        if (!canViewTrip(result, userId)) {
          setTrip(null);
          setError('not-found');
          return;
        }
        setTrip(result);
        dispatch(upsertTrip(result));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tripId, dispatch, userId]);

  const setLocalTrip = useCallback((next: Trip) => {
    setTrip(next);
  }, []);

  const patch = useCallback(
    async (input: Partial<Omit<Trip, 'id'>>): Promise<Trip> => {
      if (!tripId) {
        throw new Error('Missing tripId.');
      }

      const updated = await updateTrip(tripId, input);
      setTrip(updated);
      dispatch(upsertTrip(updated));
      return updated;
    },
    [tripId, dispatch],
  );

  const patchDays = useCallback((days: ItineraryDay[]) => patch({ days }), [patch]);

  return { trip, loading, error, setLocalTrip, patch, patchDays };
}
