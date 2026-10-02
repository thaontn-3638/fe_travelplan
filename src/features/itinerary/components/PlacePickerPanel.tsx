import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import { Alert, Checkbox, FormControlLabel, Snackbar, TextField } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import type { ItineraryDay, Place, Region, SavedPlace, TripRegion } from '../../../types';
import { formatPlacePrice } from '../../../utils/formatters';
import type { CategoryKey } from '../../places/utils';
import { CATEGORY_COLOR_CLASSES } from '../utils/categoryColors';
import { filterPickerPlaces, PLACE_PICKER_PAGE_SIZE } from '../utils/placeFilters';
import { AddToDayPopover } from './AddToDayPopover';
import { ItineraryPlaceDetailPane } from './ItineraryPlaceDetailPane';
import { PlaceFormModal, type PlaceFormPrefill } from '../../places/components/PlaceFormModal';
import { createPlace, type PlaceInput } from '../../places/api/placeApi';
import { userErrorMessage } from '../../../utils/errorMessages';

type PickerTab = 'wishlist' | 'all';

interface PlacePickerPanelProps {
  savedPlaces: SavedPlace[];
  placesById: Map<string, Place>;
  regions: Region[];
  tripRegions: TripRegion[];
  days: ItineraryDay[];
  usageByPlaceId: Map<string, number>;
  category: CategoryKey | null;
  currentUserId: string;
  onAddPlace: (placeId: string, dayId: string | null) => void;
  // Place vừa tạo ngay trong panel — caller đưa nó vào catalog đang dùng.
  onPlaceCreated: (place: Place) => void;
}

export function PlacePickerPanel({
  savedPlaces,
  placesById,
  regions,
  tripRegions,
  days,
  usageByPlaceId,
  category,
  currentUserId,
  onAddPlace,
  onPlaceCreated,
}: PlacePickerPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<PickerTab>('wishlist');
  const [query, setQuery] = useState('');
  const [restrictToTripRegions, setRestrictToTripRegions] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PLACE_PICKER_PAGE_SIZE);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  // Form tạo place ngay trong wizard: trước đây thiếu một quán là phải thoát
  // wizard, sang màn Khám phá tạo, rồi quay lại tìm.
  const [createForm, setCreateForm] = useState<{ key: number; prefill: PlaceFormPrefill } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);

  const savedIds = useMemo(() => new Set(savedPlaces.map((row) => row.placeId)), [savedPlaces]);
  const savedOrder = useMemo(
    () => new Map([...savedPlaces].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).map((row, index) => [row.placeId, index])),
    [savedPlaces],
  );

  const results = useMemo(() => {
    const pool = [...placesById.values()].filter((place) => (tab === 'wishlist' ? savedIds.has(place.id) : true));

    const filtered = filterPickerPlaces({
      places: pool,
      regions,
      tripRegions,
      query,
      category,
      // Tab wishlist là danh sách do người dùng tự lưu — không lọc theo vùng.
      restrictToTripRegions: tab === 'all' && restrictToTripRegions,
    });

    return filtered.sort((a, b) => {
      const usedA = usageByPlaceId.get(a.id) ?? 0;
      const usedB = usageByPlaceId.get(b.id) ?? 0;
      // Place đã thêm vào lịch trình không biến mất — chỉ tụt xuống cuối (R8).
      if ((usedA === 0) !== (usedB === 0)) {
        return usedA === 0 ? -1 : 1;
      }
      if (tab === 'wishlist') {
        return (savedOrder.get(a.id) ?? 0) - (savedOrder.get(b.id) ?? 0);
      }
      return b.savedCount - a.savedCount;
    });
  }, [placesById, tab, savedIds, regions, tripRegions, query, category, restrictToTripRegions, usageByPlaceId, savedOrder]);

  function openCreate(): void {
    setCreateError(null);
    setCreateForm({
      key: Date.now(),
      prefill: {
        title: query.trim() || undefined,
        // Vùng đầu tiên của chuyến đi — đa số place mới là ở chính điểm đến.
        region: tripRegions[0]?.name,
        category: category ?? undefined,
      },
    });
  }

  async function handleCreate(input: PlaceInput): Promise<void> {
    setCreateError(null);
    try {
      const created = await createPlace(input, currentUserId);
      onPlaceCreated(created);
      setCreateForm(null);
      // Đưa place mới lên đầu danh sách: tab "Tất cả", lọc đúng tên nó, và bỏ
      // lọc theo vùng nếu nó nằm ngoài điểm đến của chuyến.
      setTab('all');
      setQuery(created.title);
      setVisibleCount(PLACE_PICKER_PAGE_SIZE);
      if (!tripRegions.some((region) => region.name === created.region)) {
        setRestrictToTripRegions(false);
      }
      setCreatedTitle(created.title);
    } catch (err) {
      setCreateError(userErrorMessage(err));
    }
  }

  const createModal = createForm && (
    <PlaceFormModal
      key={createForm.key}
      open
      mode="create"
      prefill={createForm.prefill}
      currentUserId={currentUserId}
      submitError={createError}
      onClose={() => setCreateForm(null)}
      onSubmit={handleCreate}
    />
  );

  const selectedPlace = selectedPlaceId ? placesById.get(selectedPlaceId) : null;
  if (selectedPlace) {
    return <ItineraryPlaceDetailPane place={selectedPlace} onBack={() => setSelectedPlaceId(null)} />;
  }

  const visible = results.slice(0, visibleCount);

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="mb-3 inline-flex w-full rounded-xl border border-line bg-surface p-1">
        {(['wishlist', 'all'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value);
              setVisibleCount(PLACE_PICKER_PAGE_SIZE);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
              tab === value ? 'bg-white text-ocean-dark shadow-sm' : 'text-ink-soft'
            }`}
          >
            {t(`itinerary.picker.tab.${value}`)}
          </button>
        ))}
      </div>

      <TextField
        fullWidth
        size="small"
        value={query}
        placeholder={t('itinerary.picker.searchPlaceholder') ?? ''}
        onChange={(event) => {
          setQuery(event.target.value);
          setVisibleCount(PLACE_PICKER_PAGE_SIZE);
        }}
      />

      {tab === 'all' && tripRegions.length > 0 && (
        <FormControlLabel
          className="mt-1"
          control={
            <Checkbox
              size="small"
              checked={!restrictToTripRegions}
              onChange={(event) => setRestrictToTripRegions(!event.target.checked)}
            />
          }
          label={
            <span className="text-[12px] text-ink-soft">{t('itinerary.picker.ignoreRegionFilter')}</span>
          }
        />
      )}

      <div className="mb-2 mt-3 flex items-center justify-between">
        <span className="text-[11.5px] text-ink-soft">
          {t('itinerary.picker.resultCount', { count: results.length })}
        </span>
        <span className="text-[11.5px] text-ink-soft">{t('itinerary.picker.dragHint')}</span>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <p className="m-0 text-[13px] text-ink-soft">
            {query.trim()
              ? t('itinerary.picker.emptyQuery', { query: query.trim() })
              : t('itinerary.picker.empty')}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1 rounded-lg bg-ocean px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-ocean-dark"
          >
            <AddRoundedIcon sx={{ fontSize: 16 }} />
            {t('itinerary.picker.createPlace')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((place) => (
            <PlaceRow
              key={place.id}
              place={place}
              usedCount={usageByPlaceId.get(place.id) ?? 0}
              days={days}
              onOpen={() => setSelectedPlaceId(place.id)}
              onAdd={(dayId) => onAddPlace(place.id, dayId)}
            />
          ))}
        </div>
      )}

      {visible.length < results.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((current) => current + PLACE_PICKER_PAGE_SIZE)}
          className="mt-3 w-full rounded-xl border border-dashed border-line py-2 text-[12.5px] font-semibold text-ink-soft transition hover:border-ocean hover:text-ocean-dark"
        >
          {t('itinerary.picker.loadMore')}
        </button>
      )}

      {/* Luôn có lối tạo mới ở cuối danh sách, kể cả khi đang có kết quả —
          quán mình cần có thể không nằm trong số đó. */}
      {visible.length > 0 && (
        <p className="m-0 mt-3 border-t border-line pt-3 text-center text-[12.5px] text-ink-soft">
          {t('itinerary.picker.notFound')}{' '}
          <button
            type="button"
            onClick={openCreate}
            className="font-semibold text-ocean-dark underline-offset-2 hover:underline"
          >
            {t('itinerary.picker.createPlace')}
          </button>
        </p>
      )}

      {createModal}

      <Snackbar
        open={createdTitle !== null}
        autoHideDuration={6000}
        onClose={() => setCreatedTitle(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {createdTitle ? (
          <Alert severity="success" variant="filled" onClose={() => setCreatedTitle(null)}>
            {t('itinerary.picker.created', { title: createdTitle })}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
}

interface PlaceRowProps {
  place: Place;
  usedCount: number;
  days: ItineraryDay[];
  onOpen: () => void;
  onAdd: (dayId: string | null) => void;
}

function PlaceRow({ place, usedCount, days, onOpen, onAdd }: PlaceRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `place-${place.id}`,
    data: { type: 'place', placeId: place.id },
  });
  const colors = CATEGORY_COLOR_CLASSES[place.category as CategoryKey] ?? CATEGORY_COLOR_CLASSES.other;

  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border border-line p-2 transition hover:border-ocean-light ${
        isDragging ? 'opacity-45' : ''
      } ${usedCount > 0 ? 'opacity-60' : ''}`}
    >
      <img src={place.coverUrl} alt="" className="h-11 w-11 flex-shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <p className="m-0 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <span className="truncate">{place.title}</span>
          {usedCount > 0 && (
            <span className="flex-shrink-0 rounded-full bg-ocean-tint px-1.5 py-0.5 text-[10px] font-bold text-ocean-dark">
              {t('itinerary.wishlist.alreadyAdded', { count: usedCount })}
            </span>
          )}
        </p>
        <p className="m-0 flex items-center gap-1.5 truncate text-[11.5px] text-ink-soft">
          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${colors.dot}`} />
          {place.region}
          {typeof place.rating === 'number' && (
            <span className="flex items-center gap-0.5 text-amber-dark">
              <StarRoundedIcon sx={{ fontSize: 13 }} />
              {place.rating.toFixed(1)}
            </span>
          )}
          {place.price ? ` · ${formatPlacePrice(place)}` : ''}
        </p>
      </div>

      <AddToDayPopover days={days} onPick={onAdd} />

      <span
        {...listeners}
        {...attributes}
        onClick={(event) => event.stopPropagation()}
        className="hidden flex-shrink-0 cursor-grab text-ink-soft active:cursor-grabbing lg:block"
      >
        <DragIndicatorRoundedIcon fontSize="small" />
      </span>
    </div>
  );
}
