import type { Place } from '../../../types';
import { PlaceCard } from './PlaceCard';

interface SearchResultsListProps {
  places: Place[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isSaved: (placeId: string) => boolean;
  onToggleSave: (place: Place) => void;
  savePendingId: string | null;
}

export function SearchResultsList({
  places,
  selectedId,
  onSelect,
  isSaved,
  onToggleSave,
  savePendingId,
}: SearchResultsListProps) {
  return (
    <div className="flex flex-col gap-2.5">
      {places.map((place) => (
        <PlaceCard
          key={place.id}
          place={place}
          selected={place.id === selectedId}
          saved={isSaved(place.id)}
          savePending={savePendingId === place.id}
          onClick={() => onSelect(place.id)}
          onToggleSave={() => onToggleSave(place)}
        />
      ))}
    </div>
  );
}
