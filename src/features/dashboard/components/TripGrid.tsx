import type { TripSummary } from '../types';
import { TripCard } from './TripCard';
import { AddTripCard } from './AddTripCard';

interface TripGridProps {
  trips: TripSummary[];
  onTripClick?: (trip: TripSummary) => void;
  showAddCard?: boolean;
}

export function TripGrid({ trips, onTripClick, showAddCard = true }: TripGridProps) {
  return (
    <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 xl:grid-cols-3">
      {trips.map((trip) => (
        <TripCard key={trip.id} trip={trip} onClick={onTripClick ? () => onTripClick(trip) : undefined} />
      ))}
      {showAddCard && <AddTripCard />}
    </div>
  );
}
