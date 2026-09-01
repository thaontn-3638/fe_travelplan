import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogContent, Pagination, Snackbar } from '@mui/material';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useAppSelector } from '../store/hooks';
import { getErrorMessage } from '../utils/typeGuards';
import { usePlaceSearch } from '../features/places/hooks/usePlaceSearch';
import { useSavedPlaces } from '../features/places/hooks/useSavedPlaces';
import { SearchResultsList } from '../features/places/components/SearchResultsList';
import { PlaceDetailPanel } from '../features/places/components/PlaceDetailPanel';
import { SearchEmptyState } from '../features/places/components/SearchEmptyState';
import { PlaceFormModal } from '../features/places/components/PlaceFormModal';
import {
  createPlace,
  deletePlace,
  getOtherSavers,
  PlaceGuardError,
  PlaceNotVisibleError,
  updatePlace,
  updatePlaceVisibility,
  type PlaceInput,
} from '../features/places/api/placeApi';
import { CATEGORY_KEYS, getPageCount } from '../features/places/utils';
import type { Place } from '../types';

interface FormModalState {
  open: boolean;
  mode: 'create' | 'edit';
}

interface Toast {
  message: string;
  severity: 'error' | 'warning';
}

export default function DiscoverPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';
  const [searchParams, setSearchParams] = useSearchParams();

  // Search box lives in the header (DashboardLayout), not this page.
  const rawQuery = useAppSelector((state) => state.ui.searchQuery);
  const { isSaved, save, remove, removeLocally, refresh: refreshSavedPlaces, savedPlaceIds } =
    useSavedPlaces(currentUserId);

  // Derived from the URL, not mirrored into its own state, so the browser
  // Back button and the header's `?saved=true` link both stay in sync.
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const showSavedOnly = searchParams.get('saved') === 'true';

  const setShowSavedOnly = useCallback(
    (value: boolean) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value) {
            next.set('saved', 'true');
          } else {
            next.delete('saved');
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const {
    places,
    totalCount,
    page,
    setPage,
    loading,
    error,
    isIdle,
    defaultSelectedId,
    patchPlaceLocally,
    removePlaceLocally,
    addPlaceLocally,
  } = usePlaceSearch(rawQuery, currentUserId, {
    category: selectedCategory,
    savedPlaceIds: showSavedOnly ? savedPlaceIds : undefined,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedId(defaultSelectedId);
  }, [defaultSelectedId]);
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;

  const isOwnCustom = Boolean(
    selectedPlace && selectedPlace.source === 'custom' && selectedPlace.createdBy === currentUserId,
  );
  const [canModifySelected, setCanModifySelected] = useState(false);

  // Returns a cancel fn (same shape as an effect cleanup) so it can also be
  // called directly from the tab-focus effect below.
  const refreshCanModify = useCallback((): (() => void) => {
    if (!selectedPlace || !isOwnCustom) {
      setCanModifySelected(false);
      return () => {};
    }

    let cancelled = false;
    getOtherSavers(selectedPlace.id, currentUserId)
      .then((others) => {
        if (!cancelled) setCanModifySelected(others.length === 0);
      })
      .catch(() => {
        if (!cancelled) setCanModifySelected(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlace, isOwnCustom, currentUserId]);

  // Resets synchronously on every change (not just the early-return branch)
  // so switching to a different own-custom place can't briefly keep the
  // previous place's `true` while the new check is still in flight.
  useEffect(() => {
    setCanModifySelected(false);
    return refreshCanModify();
  }, [refreshCanModify]);

  // Re-sync on tab focus — see docs/features/place-search.md's "Editing &
  // deleting a custom place" for why this is a UX freshness nicety, not enforcement.
  useEffect(() => {
    function handleFocus(): void {
      if (document.visibilityState === 'visible') {
        refreshSavedPlaces();
        refreshCanModify();
      }
    }

    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshSavedPlaces, refreshCanModify]);

  const [savePendingId, setSavePendingId] = useState<string | null>(null);
  const [formModal, setFormModal] = useState<FormModalState>({ open: false, mode: 'create' });
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  function getActionErrorMessage(err: unknown): string {
    if (err instanceof PlaceGuardError) return t('discover.guardTooltip');
    if (err instanceof PlaceNotVisibleError) return t('discover.placeNotVisible');
    return getErrorMessage(err);
  }

  function showActionError(err: unknown): void {
    setToast({ message: getActionErrorMessage(err), severity: 'error' });
  }

  async function handleToggleSaved(place: Place): Promise<void> {
    setSavePendingId(place.id);

    try {
      if (isSaved(place.id)) {
        await remove(place.id);
      } else {
        const updated = await save(place);
        patchPlaceLocally(place.id, { savedCount: updated.savedCount });
      }
    } catch (err) {
      showActionError(err);
    } finally {
      setSavePendingId(null);
    }
  }

  async function handleFormSubmit(input: PlaceInput): Promise<void> {
    setFormError(null);

    try {
      if (formModal.mode === 'create') {
        const created = await createPlace(input, currentUserId);
        addPlaceLocally(created);
        setSelectedId(created.id);
      } else if (selectedPlace) {
        const updated = await updatePlace(selectedPlace.id, input, currentUserId);
        patchPlaceLocally(selectedPlace.id, updated);
      }

      setFormModal((state) => ({ ...state, open: false }));
    } catch (err) {
      setFormError(getActionErrorMessage(err));
    }
  }

  async function handleToggleVisibility(): Promise<void> {
    if (!selectedPlace) return;

    try {
      const updated = await updatePlaceVisibility(selectedPlace.id, !selectedPlace.isPublic, currentUserId);
      patchPlaceLocally(selectedPlace.id, updated);
    } catch (err) {
      showActionError(err);
    }
  }

  async function handleConfirmDelete(): Promise<void> {
    if (!selectedPlace) return;
    setDeletePending(true);

    try {
      await deletePlace(selectedPlace.id, currentUserId);
      removeLocally(selectedPlace.id);
      removePlaceLocally(selectedPlace.id);
      setSelectedId(places.find((place) => place.id !== selectedPlace.id)?.id ?? null);
      setDeleteOpen(false);
    } catch (err) {
      showActionError(err);
    } finally {
      setDeletePending(false);
    }
  }

  const pageCount = getPageCount(totalCount);
  const showEmptyState = !loading && !error && places.length === 0 && !isIdle;
  const showInitialLoading = loading && places.length === 0;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-112px)] lg:min-h-[420px] lg:overflow-hidden">
      <div className="mb-4 flex-shrink-0">
        <h1 className="m-0 mb-1.5 font-display text-[26px] font-bold text-ink">{t('discover.title')}</h1>
        <p className="m-0 text-[14.5px] text-ink-soft">{t('discover.subtitle')}</p>
      </div>

      <div className="mb-4 flex flex-shrink-0 flex-wrap items-center gap-2">
        <Chip
          label={t('discover.categoryAll')}
          onClick={() => setSelectedCategory(null)}
          color={selectedCategory === null ? 'secondary' : undefined}
          variant={selectedCategory === null ? 'filled' : 'outlined'}
        />
        {CATEGORY_KEYS.map((key) => (
          <Chip
            key={key}
            label={t(`discover.category.${key}`)}
            onClick={() => setSelectedCategory(key)}
            color={selectedCategory === key ? 'secondary' : undefined}
            variant={selectedCategory === key ? 'filled' : 'outlined'}
          />
        ))}

        <Chip
          icon={<BookmarkRoundedIcon fontSize="small" />}
          label={t('discover.savedOnly')}
          onClick={() => setShowSavedOnly(!showSavedOnly)}
          color={showSavedOnly ? 'secondary' : undefined}
          variant={showSavedOnly ? 'filled' : 'outlined'}
          className="ml-auto"
        />
      </div>

      {error && (
        <Alert severity="error" className="mb-4 flex-shrink-0">
          {error}
        </Alert>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {showInitialLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <CircularProgress size={28} />
          </div>
        ) : showEmptyState ? (
          showSavedOnly ? (
            <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line text-center">
              <p className="m-0 font-display text-base font-bold text-ink">{t('discover.noSavedTitle')}</p>
              <p className="m-0 text-sm text-ink-soft">{t('discover.noSavedSubtitle')}</p>
            </div>
          ) : (
            <SearchEmptyState query={rawQuery.trim()} onAddPlace={() => setFormModal({ open: true, mode: 'create' })} />
          )
        ) : (
          <>
            <h2 className="mb-3 flex flex-shrink-0 items-center gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">
              {t(isIdle ? 'discover.trending' : 'discover.searchResults')}
              <span className="rounded-full bg-ocean-tint px-2 py-0.5 text-[12px] font-bold normal-case tracking-normal text-ocean-dark">
                {totalCount}
              </span>
            </h2>

            {/* Row 2 (pagination) auto-places into column 1 once row 1's two cells are filled. */}
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-[4fr_6fr] lg:grid-rows-[minmax(0,1fr)_auto]">
              <div className="min-h-0 lg:overflow-y-auto lg:pr-1">
                <SearchResultsList
                  places={places}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  isSaved={isSaved}
                  onToggleSave={handleToggleSaved}
                  savePendingId={savePendingId}
                />
              </div>

              <div className="min-h-0 lg:overflow-y-auto">
                {selectedPlace && (
                  <PlaceDetailPanel
                    place={selectedPlace}
                    saved={isSaved(selectedPlace.id)}
                    isOwnCustom={isOwnCustom}
                    canModify={canModifySelected}
                    wishlistPending={savePendingId === selectedPlace.id}
                    onToggleSaved={() => handleToggleSaved(selectedPlace)}
                    onEdit={() => {
                      setFormError(null);
                      setFormModal({ open: true, mode: 'edit' });
                    }}
                    onDelete={() => setDeleteOpen(true)}
                    onToggleVisibility={handleToggleVisibility}
                    onGuardedAction={() => setToast({ message: t('discover.guardTooltip'), severity: 'warning' })}
                  />
                )}
              </div>

              {pageCount > 1 && (
                <div className="flex justify-center pt-1">
                  <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PlaceFormModal
        open={formModal.open}
        mode={formModal.mode}
        initialPlace={formModal.mode === 'edit' ? (selectedPlace ?? undefined) : undefined}
        currentUserId={currentUserId}
        submitError={formError}
        onClose={() => setFormModal((state) => ({ ...state, open: false }))}
        onSubmit={handleFormSubmit}
      />

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent>
          <h3 className="m-0 mb-2 font-display text-lg font-bold text-ink">{t('discover.deleteConfirmTitle')}</h3>
          <p className="m-0 text-sm text-ink-soft">
            {t('discover.deleteConfirmBody', { title: selectedPlace?.title ?? '' })}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="text" onClick={() => setDeleteOpen(false)} disabled={deletePending}>
              {t('common.cancel')}
            </Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deletePending}>
              {t('discover.deleteConfirmAction')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Snackbar
        open={!!toast}
        onClose={() => setToast(null)}
        autoHideDuration={4000}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        sx={{ top: { xs: 72, lg: 88 } }} // clear the sticky AppBar instead of overlapping it
      >
        {toast ? (
          <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </div>
  );
}
