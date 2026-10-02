import { useTranslation } from 'react-i18next';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import type { Place, Trip, TripStatus } from '../../../types';
import { TRIP_STATUSES } from '../utils/tripBasics';
import {
  STATUS_DOT_CLASSES,
  STATUS_TEXT_CLASSES,
  STATUS_TINT_CLASSES,
} from '../../../components/tripStatusColors';
import { resolveTripCoverUrl } from '../utils/tripDefaults';
import { formatTripDateRange, formatTripRegions } from '../../../utils/formatters';
import { TripProgressBar } from './TripProgressBar';
import { isDraftTrip, tripProgress } from '../utils/tripProgress';

interface TripKanbanBoardProps {
  trips: Trip[];
  placesById: Map<string, Place>;
  onTripClick: (trip: Trip) => void;
  onStatusChange: (tripId: string, status: TripStatus) => void;
}

// Thay cho tab "Mốc thời gian" cũ: 6 cột theo TripStatus, kéo card sang cột
// khác là đổi trạng thái (trip-board.md §5.8).
export function TripKanbanBoard({ trips, placesById, onTripClick, onStatusChange }: TripKanbanBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent): void {
    const tripId = event.active.data.current?.tripId as string | undefined;
    const status = event.over?.data.current?.status as TripStatus | undefined;
    const from = event.active.data.current?.status as TripStatus | undefined;

    if (tripId && status && status !== from) {
      onStatusChange(tripId, status);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Cuộn nằm trong từng cột, không đẩy cả trang ra ngoài. Chừa một khoảng
          dưới đáy màn hình để bảng không dính sát mép. */}
      <div className="mb-6 flex h-[calc(100vh-300px)] min-h-[380px] gap-3 overflow-x-auto pb-1">
        {TRIP_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            trips={trips
              .filter((trip) => trip.status === status)
              // Mới cập nhật nhất lên đầu cột.
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
            placesById={placesById}
            onTripClick={onTripClick}
          />
        ))}
      </div>
    </DndContext>
  );
}

interface KanbanColumnProps {
  status: TripStatus;
  trips: Trip[];
  placesById: Map<string, Place>;
  onTripClick: (trip: Trip) => void;
}

function KanbanColumn({ status, trips, placesById, onTripClick }: KanbanColumnProps) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: `status-${status}`, data: { type: 'status', status } });

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
        <span className="text-[12.5px] font-bold text-ink">{t(`dashboard.status.${status}`)}</span>
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11.5px] font-bold ${STATUS_TINT_CLASSES[status]} ${STATUS_TEXT_CLASSES[status]}`}
        >
          {trips.length}
        </span>
      </div>

      {/* Khi kéo card qua, cột sáng lên bằng đúng màu pastel của trạng thái đó. */}
      <div
        ref={setNodeRef}
        className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-2xl border-2 border-dashed p-2 transition ${
          isOver ? `${STATUS_TINT_CLASSES[status]} border-current ${STATUS_TEXT_CLASSES[status]}` : 'border-line bg-surface/60'
        }`}
      >
        {trips.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-center text-[12px] text-ink-soft">
            {t('itinerary.kanban.emptyColumn')}
          </div>
        ) : (
          trips.map((trip) => (
            <KanbanCard
              key={trip.id}
              trip={trip}
              placesById={placesById}
              onClick={() => onTripClick(trip)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function KanbanCard({
  trip,
  placesById,
  onClick,
}: {
  trip: Trip;
  placesById: Map<string, Place>;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `trip-${trip.id}`,
    data: { type: 'trip', tripId: trip.id, status: trip.status },
  });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      // Mở trip bằng bàn phím: card là một nút (Enter / Space). Tay nắm kéo là
      // một điểm focus riêng bên trong.
      role="button"
      tabIndex={0}
      aria-label={trip.name}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={`flex-shrink-0 cursor-pointer rounded-xl border border-line bg-white p-2 transition hover:border-ocean-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean ${
        isDragging ? 'opacity-45' : ''
      }`}
    >
      <div className="relative mb-2 h-[58px] overflow-hidden rounded-lg bg-line">
        <img src={resolveTripCoverUrl(trip, placesById)} alt="" className="h-full w-full object-cover" />
        {isDraftTrip(trip) && (
          <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-amber-dark">
            {t('itinerary.list.draftBadge')}
          </span>
        )}
        <span
          {...listeners}
          {...attributes}
          aria-label={t('itinerary.kanban.dragHandle', { name: trip.name })}
          onClick={(event) => event.stopPropagation()}
          className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-grab items-center justify-center rounded-lg bg-white/95 text-ink-soft active:cursor-grabbing"
        >
          <DragIndicatorRoundedIcon fontSize="small" />
        </span>
      </div>

      <p className="m-0 mb-0.5 truncate text-[13px] font-bold text-ink">{trip.name}</p>
      <p className="m-0 mb-2 flex items-center gap-1.5 truncate text-[11px] text-ink-soft">
        <span className="truncate">{formatTripRegions(trip.regions)}</span>
        <span className="flex-shrink-0 font-mono">{formatTripDateRange(trip.startDate, trip.endDate)}</span>
      </p>

      <TripProgressBar progress={tripProgress(trip)} />
    </div>
  );
}
