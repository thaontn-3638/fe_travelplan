import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, IconButton, Pagination, Snackbar, Tooltip, useMediaQuery, useTheme } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useAppSelector } from '../store/hooks';
import { userErrorMessage } from '../utils/errorMessages';
import { usePlaceSearch } from '../features/places/hooks/usePlaceSearch';
import { useSavedPlaces } from '../features/places/hooks/useSavedPlaces';
import { SearchResultsList } from '../features/places/components/SearchResultsList';
import { PlaceDetailPanel } from '../features/places/components/PlaceDetailPanel';
import { SearchEmptyState } from '../features/places/components/SearchEmptyState';
import { PlaceFormModal, type PlaceFormPrefill } from '../features/places/components/PlaceFormModal';
import {
  createPlace,
  deletePlace,
  getPlaceUsage,
  placeBlockReason,
  type PlaceAction,
  type PlaceBlockReason,
  type PlaceUsage,
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
  // Tăng mỗi lần mở để form tạo mới luôn bắt đầu sạch (không giữ lần trước).
  key?: number;
  prefill?: PlaceFormPrefill;
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
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  useEffect(() => {
    setSelectedId(defaultSelectedId);
  }, [defaultSelectedId]);
  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;

  const isOwnCustom = Boolean(
    selectedPlace && selectedPlace.source === 'custom' && selectedPlace.createdBy === currentUserId,
  );
  // null = đang kiểm tra (chặn tạm mọi thao tác sửa cho tới khi biết chắc).
  const [usage, setUsage] = useState<PlaceUsage | null>(null);

  // Returns a cancel fn (same shape as an effect cleanup) so it can also be
  // called directly from the tab-focus effect below.
  const refreshCanModify = useCallback((): (() => void) => {
    if (!selectedPlace || !isOwnCustom) {
      setUsage(null);
      return () => {};
    }

    let cancelled = false;
    getPlaceUsage(selectedPlace.id, currentUserId)
      .then((result) => {
        if (!cancelled) setUsage(result);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPlace, isOwnCustom, currentUserId]);

  // Resets synchronously on every change (not just the early-return branch)
  // so switching to a different own-custom place can't briefly keep the
  // previous place's usage while the new check is still in flight.
  useEffect(() => {
    setUsage(null);
    return refreshCanModify();
  }, [refreshCanModify]);

  const blockMessage = useCallback(
    (reason: PlaceBlockReason | null, count = 0): string | null => {
      if (reason === 'saved') return t('discover.guardTooltip');
      if (reason === 'inTrip') return t('discover.guardInTrip', { count });
      if (reason === 'inSharedTrip') return t('discover.guardInSharedTrip', { count });
      return null;
    },
    [t],
  );

  const blocked: Record<PlaceAction, string | null> = usage
    ? {
        edit: blockMessage(placeBlockReason(usage, 'edit')),
        delete: blockMessage(placeBlockReason(usage, 'delete'), usage.trips),
        makePrivate: blockMessage(placeBlockReason(usage, 'makePrivate'), usage.sharedTrips),
      }
    : { edit: t('discover.guardChecking'), delete: t('discover.guardChecking'), makePrivate: t('discover.guardChecking') };

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
    if (err instanceof PlaceGuardError) return blockMessage(err.reason, err.count) ?? t('discover.guardTooltip');
    if (err instanceof PlaceNotVisibleError) return t('discover.placeNotVisible');
    return userErrorMessage(err);
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

  // Mở form tạo mới. Từ trạng thái "không tìm thấy" thì điền sẵn từ khoá vừa
  // tìm và loại đang lọc; từ nút trên header thì chỉ điền loại đang lọc.
  function openCreate(fromQuery: boolean): void {
    setFormError(null);
    setFormModal({
      open: true,
      mode: 'create',
      key: Date.now(),
      prefill: {
        title: fromQuery ? rawQuery.trim() : undefined,
        category: selectedCategory ?? undefined,
      },
    });
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

  const detailPanel = selectedPlace ? (
    <PlaceDetailPanel
      place={selectedPlace}
      saved={isSaved(selectedPlace.id)}
      isOwnCustom={isOwnCustom}
      blocked={blocked}
      wishlistPending={savePendingId === selectedPlace.id}
      onToggleSaved={() => handleToggleSaved(selectedPlace)}
      onEdit={() => {
        setFormError(null);
        setFormModal({ open: true, mode: 'edit' });
      }}
      onDelete={() => setDeleteOpen(true)}
      onToggleVisibility={handleToggleVisibility}
      onGuardedAction={(reason) => setToast({ message: reason, severity: 'warning' })}
    />
  ) : null;

  return (
    <div className="flex flex-col lg:h-[calc(100vh-112px)] lg:min-h-[420px] lg:overflow-hidden">
      <div className="mb-4 flex flex-shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="m-0 mb-1.5 font-display text-[26px] font-bold text-ink">{t('discover.title')}</h1>
          <p className="m-0 text-[14.5px] text-ink-soft">{t('discover.subtitle')}</p>
        </div>

        {/* Luôn hiện, không chỉ khi tìm không ra: người mới vào thấy ngay danh
            sách thịnh hành nên gần như không bao giờ gặp trạng thái rỗng, và
            sẽ không biết là app cho tự tạo địa điểm. */}
        <Tooltip title={t('discover.addPlaceHint')}>
          <span className="flex-shrink-0">
            <Button
              variant="outlined"
              startIcon={<AddRoundedIcon />}
              onClick={() => openCreate(false)}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, borderRadius: '12px', fontWeight: 600 }}
            >
              {t('discover.addPlaceHeader')}
            </Button>
            <IconButton
              aria-label={t('discover.addPlaceHeader')}
              onClick={() => openCreate(false)}
              sx={{ display: { xs: 'inline-flex', sm: 'none' }, border: 1, borderColor: 'divider' }}
            >
              <AddRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
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
            <SearchEmptyState query={rawQuery.trim()} onAddPlace={() => openCreate(true)} />
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
                  onSelect={(id) => {
                    setSelectedId(id);
                    if (!isDesktop) setMobileDetailOpen(true);
                  }}
                  isSaved={isSaved}
                  onToggleSave={handleToggleSaved}
                  savePendingId={savePendingId}
                />
              </div>

              {/* Dưới lg chỉ có một cột: panel chi tiết nằm sau cả danh sách nên
                  chạm vào kết quả trông như không có gì xảy ra. Ở màn nhỏ chi tiết
                  mở dạng dialog toàn màn hình (xem bên dưới). */}
              {isDesktop && (
                <div className="min-h-0 lg:overflow-y-auto">
                  {selectedPlace && detailPanel}
                </div>
              )}

              {pageCount > 1 && (
                <div className="flex justify-center pt-1">
                  <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={!isDesktop && mobileDetailOpen && selectedPlace !== null}
        onClose={() => setMobileDetailOpen(false)}
        fullScreen
        aria-label={selectedPlace?.title}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-3 py-2">
          <span className="min-w-0 truncate font-display text-[15px] font-bold text-ink">{selectedPlace?.title}</span>
          <IconButton onClick={() => setMobileDetailOpen(false)} aria-label={t('common.close')}>
            <CloseRoundedIcon />
          </IconButton>
        </div>
        <div className="p-4">{selectedPlace && detailPanel}</div>
      </Dialog>

      <PlaceFormModal
        key={formModal.mode === 'create' ? formModal.key : 'edit'}
        open={formModal.open}
        mode={formModal.mode}
        initialPlace={formModal.mode === 'edit' ? (selectedPlace ?? undefined) : undefined}
        prefill={formModal.prefill}
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
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <Button variant="text" onClick={() => setDeleteOpen(false)} disabled={deletePending}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deletePending}>
            {t('discover.deleteConfirmAction')}
          </Button>
        </DialogActions>
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
