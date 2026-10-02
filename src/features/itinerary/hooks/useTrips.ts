import { useCallback, useEffect, useState } from 'react';
import type { Trip, TripStatus } from '../../../types';
import { createTrip, deleteTrip, getTrips, updateTrip, type CreateTripInput } from '../api/tripApi';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { removeTrip, setTrips, upsertTrip } from '../../../store/slices/tripsSlice';

interface UseTripsResult {
  trips: Trip[];
  loading: boolean;
  // Lỗi tải danh sách. Khác với "chưa có trip nào" — màn hình phải hiện lỗi +
  // nút thử lại, không được hiện trạng thái trống.
  error: boolean;
  create: (input: CreateTripInput) => Promise<Trip>;
  setStatus: (tripId: string, status: TripStatus) => Promise<void>;
  remove: (tripId: string) => Promise<void>;
  refresh: () => void;
}

// Backed by Redux (tripsSlice) so Dashboard and the Itinerary list share one
// fetched-once cache — mirrors useSavedPlaces.ts.
export function useTrips(): UseTripsResult {
  const dispatch = useAppDispatch();
  const trips = useAppSelector((state) => state.trips.items);
  const loaded = useAppSelector((state) => state.trips.loaded);
  const userId = useAppSelector((state) => state.auth.user?.id ?? '');
  const [loading, setLoading] = useState(!loaded);
  const [error, setError] = useState(false);

  const fetchTrips = useCallback(
    (force = false) => {
      if (!force && loaded) {
        setLoading(false);
        return () => {};
      }

      let cancelled = false;
      setLoading(true);
      setError(false);

      getTrips(userId)
        .then((rows) => {
          if (!cancelled) dispatch(setTrips(rows));
        })
        .catch(() => {
          // KHÔNG setTrips([]): như thế sẽ đánh dấu loaded=true và mọi màn coi
          // như người dùng không có trip nào cho tới khi tải lại trang.
          if (!cancelled) setError(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    },
    [loaded, dispatch, userId],
  );

  useEffect(() => fetchTrips(), [fetchTrips]);

  const refresh = useCallback(() => {
    fetchTrips(true);
  }, [fetchTrips]);

  const create = useCallback(
    async (input: CreateTripInput): Promise<Trip> => {
      const trip = await createTrip(input);
      dispatch(upsertTrip(trip));
      return trip;
    },
    [dispatch],
  );

  // Kéo card ở Kanban: cập nhật ngay cho mượt, lỗi thì trả về trạng thái cũ.
  const setStatus = useCallback(
    async (tripId: string, status: TripStatus): Promise<void> => {
      const previous = trips.find((trip) => trip.id === tripId);
      if (!previous || previous.status === status) {
        return;
      }

      dispatch(upsertTrip({ ...previous, status }));
      try {
        const updated = await updateTrip(tripId, { status });
        dispatch(upsertTrip(updated));
      } catch (error) {
        dispatch(upsertTrip(previous));
        throw error;
      }
    },
    [trips, dispatch],
  );

  // Ném TripHasExpensesError nếu trip đã có khoản chi — caller hiển thị lý do.
  const remove = useCallback(
    async (tripId: string): Promise<void> => {
      await deleteTrip(tripId, userId);
      dispatch(removeTrip(tripId));
    },
    [dispatch, userId],
  );

  return { trips, loading, error, create, setStatus, remove, refresh };
}
