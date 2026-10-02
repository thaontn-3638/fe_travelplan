import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pagination } from '@mui/material';
import type { Place, Trip } from '../../../types';
import { TripCard } from './TripCard';
import { resolveTripCoverUrl } from '../utils/tripDefaults';

export const TRIPS_PER_PAGE = 12;

interface TripCardGridProps {
  trips: Trip[];
  placesById: Map<string, Place>;
  onTripClick: (trip: Trip) => void;
}

export function TripCardGrid({ trips, placesById, onTripClick }: TripCardGridProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(trips.length / TRIPS_PER_PAGE));

  // Xoá bớt trip có thể làm trang hiện tại không còn tồn tại.
  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const visible = useMemo(
    () => trips.slice((page - 1) * TRIPS_PER_PAGE, page * TRIPS_PER_PAGE),
    [trips, page],
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((trip) => (
          <TripCard
            key={trip.id}
            trip={trip}
            coverUrl={resolveTripCoverUrl(trip, placesById)}
            onClick={() => onTripClick(trip)}
          />
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-ink-soft">
            {t('itinerary.list.pageRange', {
              from: (page - 1) * TRIPS_PER_PAGE + 1,
              to: (page - 1) * TRIPS_PER_PAGE + visible.length,
              total: trips.length,
            })}
          </span>
          <Pagination
            page={page}
            count={pageCount}
            shape="rounded"
            color="primary"
            onChange={(_, next) => setPage(next)}
          />
        </div>
      )}
    </div>
  );
}
