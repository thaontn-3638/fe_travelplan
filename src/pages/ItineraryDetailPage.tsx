import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, Menu, MenuItem } from '@mui/material';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrip } from '../features/itinerary/hooks/useTrip';
import { usePlaceCatalog } from '../features/itinerary/hooks/usePlaceCatalog';
import { CategoryFilterChips } from '../features/itinerary/components/CategoryFilterChips';
import { DayCard } from '../features/itinerary/components/DayCard';
import { UnscheduledTray } from '../features/itinerary/components/UnscheduledTray';
import { ItineraryPlaceDetailPane } from '../features/itinerary/components/ItineraryPlaceDetailPane';
import { MobileColumnTabs } from '../features/itinerary/components/MobileColumnTabs';
import { TripTimelineView } from '../features/itinerary/components/TripTimelineView';
import { countTripDays, isTimed } from '../features/itinerary/utils/itineraryRules';
import { isDraftTrip, tripProgress } from '../features/itinerary/utils/tripProgress';
import { TripProgressBar } from '../features/itinerary/components/TripProgressBar';
import {
  costPerPerson,
  dayEstimatedCosts,
  tripEstimatedCost,
} from '../features/itinerary/utils/tripCosts';
import { BudgetBreakdown } from '../features/budget/components/BudgetBreakdown';
import { BudgetPlanView } from '../features/budget/components/BudgetPlanView';
import { TripCostSummary } from '../features/settlement/components/TripCostSummary';
import { useExpenses } from '../features/settlement/hooks/useExpenses';
import { planPerHead } from '../features/budget/utils/budgetRules';
import { formatMoney, formatPerHead } from '../features/budget/utils/money';
import { useTrips } from '../features/itinerary/hooks/useTrips';
import { TripStatusSelect } from '../features/itinerary/components/TripStatusSelect';
import { DeleteTripDialog } from '../features/itinerary/components/DeleteTripDialog';
import {
  shareScopeOf,
  TripHasExpensesError,
  TripNotOwnerError,
  updateTripSharing,
} from '../features/itinerary/api/tripApi';
import { canManageTrip } from '../features/itinerary/utils/tripAccess';
import { ShareTripDialog } from '../features/itinerary/components/ShareTripDialog';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { TravelerAvatars } from '../components/TravelerAvatars';
import { countParty, formatTripDateRange, formatTripRegions } from '../utils/formatters';
import type { CategoryKey } from '../features/places/utils';
import type { ItineraryDay, ItineraryItem } from '../types';
import { isSubmitEnter } from '../utils/keyboard';
import { PageLoading } from '../components/PageLoading';

type DetailTab = 'list' | 'timeline' | 'cost';

// Màn xem chỉ đọc. Mọi chỉnh sửa đi qua wizard /itinerary/:id/edit/:step nên
// chỉ còn một bộ component sửa duy nhất (trip-board.md §5.6).
export default function ItineraryDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripId } = useParams<{ tripId: string }>();
  const { user } = useAuth();
  const { trip, loading, error, patch, setLocalTrip } = useTrip(tripId);
  const { expenses: tripExpenses } = useExpenses(tripId);
  const { remove } = useTrips();
  const { placesById } = usePlaceCatalog(user?.id ?? '');

  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [tab, setTab] = useState<DetailTab>('list');
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockedExpenseCount, setBlockedExpenseCount] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemNodes = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    setName(trip?.name ?? '');
  }, [trip]);

  // Chỉ bỏ chọn khi sang trip KHÁC. Trước đây effect này chạy theo `trip`, nên
  // đổi status hay đổi tên (mỗi lần PATCH ra một object trip mới) là mục đang
  // xem bị nhảy về mục đầu tiên.
  useEffect(() => {
    setActiveItemId(null);
  }, [tripId]);

  const days = useMemo(() => trip?.days ?? [], [trip]);

  // Hiển thị theo giờ; mục chưa gán giờ xếp cuối (R4).
  const orderedItems = useMemo(
    () =>
      [...days]
        .sort((a, b) => a.date.localeCompare(b.date))
        .flatMap((day) =>
          [...day.items].sort((a, b) => {
            if (isTimed(a) && isTimed(b)) return a.startTime!.localeCompare(b.startTime!);
            if (isTimed(a) !== isTimed(b)) return isTimed(a) ? -1 : 1;
            return a.order - b.order;
          }),
        ),
    [days],
  );

  useEffect(() => {
    if (!activeItemId && orderedItems.length > 0) {
      setActiveItemId(orderedItems[0]!.id);
    }
  }, [activeItemId, orderedItems]);

  // Scroll-spy: item gần đỉnh vùng cuộn nhất trở thành item đang xem.
  useEffect(() => {
    const root = scrollContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length === 0) return;

        const topMost = visible.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best,
        );

        for (const [itemId, node] of itemNodes.current.entries()) {
          if (node === topMost.target) {
            setActiveItemId(itemId);
            break;
          }
        }
      },
      { root, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    itemNodes.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // `tab`: vùng cuộn chỉ tồn tại ở tab danh sách — sang tab khác rồi quay lại
    // là một phần tử DOM mới, observer cũ đang nhìn vào phần tử đã bị gỡ.
    // `trip`: lần render đầu (đang tải) chưa có vùng cuộn nào để quan sát.
  }, [days, category, tab, trip]);

  function commitName(): void {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== trip?.name) {
      void patch({ name: trimmed }).catch(() => setName(trip?.name ?? ''));
    } else if (trip) {
      setName(trip.name);
    }
  }

  function visibleItems(day: ItineraryDay): ItineraryItem[] {
    if (!category) return day.items;
    return day.items.filter((item) =>
      item.kind === 'activity'
        ? category === 'other'
        : placesById.get(item.placeId ?? '')?.category === category,
    );
  }

  if (loading) return <PageLoading />;

  if (error || !trip) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <h2 className="m-0 mb-2 font-display text-lg font-bold text-ink">
          {t('itinerary.detail.loadErrorTitle')}
        </h2>
        <p className="m-0 mb-4 text-sm text-ink-soft">{t('itinerary.detail.loadErrorBody')}</p>
        <Link to="/itinerary" className="inline-block rounded-xl bg-ocean px-4 py-2 text-sm font-semibold text-white">
          ← {t('itinerary.detail.backToList')}
        </Link>
      </div>
    );
  }

  const activeItem = orderedItems.find((item) => item.id === activeItemId);
  const activePlace = activeItem?.placeId ? placesById.get(activeItem.placeId) : undefined;
  const dayCount = countTripDays(trip.startDate, trip.endDate);
  const isOwner = canManageTrip(trip, user?.id ?? '');
  const shareScope = shareScopeOf(trip);
  const isShared = shareScope.plan || shareScope.actual;
  const estimatedCost = tripEstimatedCost(trip);
  const costByDayId = dayEstimatedCosts(trip);
  const perHead = planPerHead(trip.budgetPlan, trip.party);
  const perPerson = costPerPerson(trip);

  function handleItemClick(item: ItineraryItem): void {
    setActiveItemId(item.id);
    setMobileTab('right');
  }

  return (
    <div>
      <Link to="/itinerary" className="mb-3 inline-block text-[13px] font-semibold text-ink-soft hover:text-ink">
        ← {t('itinerary.detail.backToList')}
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2.5">
        {editingName ? (
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (isSubmitEnter(event)) commitName();
            }}
            className="rounded-lg border border-ocean px-2 py-1 font-display text-[22px] font-bold text-ink outline-none"
          />
        ) : (
          <span className="group flex items-center gap-1">
            <h1
              onClick={() => setEditingName(true)}
              className="m-0 cursor-pointer font-display text-[24px] font-bold text-ink hover:text-ocean-dark"
              title={t('itinerary.plan.renameHint') ?? ''}
            >
              {name}
            </h1>
            {/* Nút rõ ràng cho bàn phím và màn cảm ứng — click vào tiêu đề chỉ
                là lối tắt, không ai đoán ra được trên điện thoại. */}
            <IconButton
              size="small"
              aria-label={t('itinerary.detail.rename')}
              onClick={() => setEditingName(true)}
              sx={{ color: 'text.secondary' }}
            >
              <EditRoundedIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        )}
        <TripStatusSelect
          status={trip.status}
          onChange={(status) => {
            setActionError(null);
            void patch({ status }).catch(() => setActionError(t('itinerary.detail.saveError')));
          }}
        />
        {isDraftTrip(trip) && (
          <span className="rounded-full border border-amber bg-amber-tint px-2 py-0.5 text-[11px] font-bold text-amber-dark">
            {t('itinerary.list.draftBadge')}
          </span>
        )}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 font-mono text-[13px] text-ink-soft">
            {formatTripRegions(trip.regions)} · {formatTripDateRange(trip.startDate, trip.endDate)} ·{' '}
            {dayCount > 1
              ? t('itinerary.detail.dayNightMeta', { days: dayCount, nights: dayCount - 1 })
              : t('itinerary.detail.oneDayMeta')}
            {' · '}
            {t('dashboard.trip.travelers', { count: countParty(trip.party) })}
          </p>
          <TravelerAvatars travelers={trip.travelers} size="sm" />
        </div>

        <div className="flex items-center gap-2">
          {actionError && <span className="text-[12.5px] font-semibold text-coral-dark">{actionError}</span>}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-[13px] font-semibold transition ${
              isShared
                ? 'border-mint bg-mint-tint text-mint-dark'
                : 'border-line bg-white text-ink hover:border-ocean hover:text-ocean-dark'
            }`}
          >
            {isShared && <PublicRoundedIcon sx={{ fontSize: 16 }} />}
            {isShared ? t('itinerary.share.badge') : t('itinerary.detail.shareButton')}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/itinerary/${trip.id}/edit/2`)}
            className="rounded-xl bg-ocean px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-ocean-dark"
          >
            {t('itinerary.detail.editButton')}
          </button>
          <IconButton
            size="small"
            aria-label={t('itinerary.detail.moreActions') ?? 'more'}
            onClick={(event: MouseEvent<HTMLButtonElement>) => setMenuAnchor(event.currentTarget)}
          >
            <MoreHorizRoundedIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem
              disabled={!isOwner}
              onClick={() => {
                setMenuAnchor(null);
                setConfirmDelete(true);
              }}
              sx={{ fontSize: 13.5, color: 'error.main', flexDirection: 'column', alignItems: 'flex-start' }}
            >
              {t('itinerary.detail.deleteTrip')}
              {!isOwner && (
                <span className="text-[11.5px] font-normal text-ink-soft">{t('itinerary.detail.ownerOnly')}</span>
              )}
            </MenuItem>
          </Menu>
        </div>
      </div>

      <TripProgressBar progress={tripProgress(trip)} className="mb-5 max-w-[320px]" />

      {isDraftTrip(trip) ? (
        <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
          <h3 className="m-0 mb-2 font-display text-lg font-bold text-ink">{t('itinerary.detail.emptyTitle')}</h3>
          <p className="m-0 mb-4 text-sm text-ink-soft">{t('itinerary.detail.emptyDescription')}</p>
          <button
            type="button"
            onClick={() => navigate(`/itinerary/${trip.id}/edit/2`)}
            className="rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral-dark"
          >
            {t('itinerary.detail.continuePlanning')}
          </button>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            {tab !== 'cost' ? (
              <CategoryFilterChips value={category} onChange={setCategory} />
            ) : (
              <span />
            )}
            <div className="inline-flex rounded-xl border border-line bg-white p-1">
              {(['list', 'timeline', 'cost'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                    tab === value ? 'bg-ocean-tint text-ocean-dark' : 'text-ink-soft'
                  }`}
                >
                  {t(`itinerary.detail.tab${value[0]!.toUpperCase()}${value.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>

          {tab === 'timeline' ? (
            <TripTimelineView
              trip={trip}
              placesById={placesById}
              category={category}
              selectedItemId={activeItemId}
              onSelectItem={setActiveItemId}
              onOpenDetail={(itemId) => {
                setTab('list');
                setActiveItemId(itemId);
                setMobileTab('right');
                // Đợi tab danh sách render xong rồi mới cuộn tới mục đó.
                requestAnimationFrame(() =>
                  itemNodes.current.get(itemId)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
                );
              }}
            />
          ) : tab === 'cost' ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              {/* Trên mobile, con số tổng đứng trước bảng chi tiết. */}
              <div className="order-last min-w-0 lg:order-none">
                <BudgetPlanView trip={trip} onEdit={() => navigate(`/itinerary/${trip.id}/edit/4`)} />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-line bg-white p-5">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="text-[14px] font-bold text-ink">{t('itinerary.detail.totalEstimated')}</span>
                    <span className="font-mono text-[18px] font-bold text-ink">
                      {formatMoney(estimatedCost, trip.currency)}
                    </span>
                  </div>
                  <p className="m-0 flex flex-wrap justify-end gap-x-4 text-[12.5px] text-ink-soft">
                    <span>
                      {t('itinerary.step4.perAdult')}: {formatPerHead(perHead.adult, trip.currency)}
                    </span>
                    {trip.party.children > 0 && (
                      <span>
                        {t('itinerary.step4.perChild')}: {formatPerHead(perHead.child, trip.currency)}
                      </span>
                    )}
                    {perPerson !== null && (
                      <span>
                        {t('itinerary.detail.perPerson', { amount: formatPerHead(perPerson, trip.currency) })}
                      </span>
                    )}
                  </p>
                  {estimatedCost === 0 && (
                    <button
                      type="button"
                      onClick={() => navigate(`/itinerary/${trip.id}/edit/4`)}
                      className="mt-4 rounded-xl border border-ocean bg-white px-4 py-2 text-[13px] font-semibold text-ocean-dark"
                    >
                      {t('itinerary.detail.startBudget')}
                    </button>
                  )}
                </div>

                {/* Không dựng lại UI sổ chi tiêu ở đây: chỉ ba con số dùng chung
                    component với hub, rồi một nút điều hướng (trip-budget.md §7.1). */}
                <div className="rounded-2xl border border-line bg-white p-5">
                  <h3 className="m-0 mb-3 font-display text-[14px] font-bold text-ink">
                    {t('settlement.summary.title')}
                  </h3>
                  <TripCostSummary trip={trip} expenses={tripExpenses} currentUserId={user?.id ?? ''} />
                  <button
                    type="button"
                    onClick={() => navigate(`/settlement/${trip.id}`)}
                    className="mt-4 rounded-xl border border-ocean bg-white px-4 py-2 text-[13px] font-semibold text-ocean-dark"
                  >
                    {t('settlement.summary.open')} →
                  </button>
                </div>
                <BudgetBreakdown trip={trip} />
              </div>
            </div>
          ) : (
          <>
          <MobileColumnTabs
            activeTab={mobileTab}
            onChange={setMobileTab}
            leftLabel={t('itinerary.plan.tabItinerary')}
            rightLabel={t('itinerary.detail.tabDetail')}
          />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
            <div
              ref={scrollContainerRef}
              className={`${mobileTab === 'left' ? 'flex' : 'hidden'} max-h-[calc(100vh-250px)] flex-col gap-3 overflow-y-auto pr-1 lg:flex`}
            >
              {days.map((day, index) => (
                <DayCard
                  key={day.id}
                  day={day}
                  dayIndex={index + 1}
                  dayCost={costByDayId[day.id] ?? 0}
                  currency={trip.currency}
                  visibleItems={visibleItems(day)}
                  hiddenByFilterCount={day.items.length - visibleItems(day).length}
                  placesById={placesById}
                  editable={false}
                  showNotes
                  timeVariant="axis"
                  activeItemId={activeItemId}
                  onItemClick={handleItemClick}
                  registerItemRef={(itemId, node) => {
                    if (node) itemNodes.current.set(itemId, node);
                    else itemNodes.current.delete(itemId);
                  }}
                />
              ))}

              <UnscheduledTray items={trip.unscheduledItems} placesById={placesById} editable={false} />

            </div>

            <div
              className={`${mobileTab === 'right' ? 'block' : 'hidden'} max-h-[calc(100vh-250px)] overflow-y-auto lg:block`}
            >
              {activePlace ? (
                <ItineraryPlaceDetailPane
                  place={activePlace}
                  note={activeItem?.note}
                  timeRangeLabel={
                    activeItem && isTimed(activeItem)
                      ? `${activeItem.startTime} – ${activeItem.endTime}`
                      : undefined
                  }
                />
              ) : activeItem ? (
                <div className="rounded-2xl border border-line bg-white p-4">
                  <h3 className="m-0 mb-1 font-display text-[16px] font-bold text-ink">
                    {activeItem.title ?? t('itinerary.item.untitledActivity')}
                  </h3>
                  {isTimed(activeItem) && (
                    <p className="m-0 mb-3 font-mono text-[13px] text-ink-soft">
                      {activeItem.startTime} – {activeItem.endTime}
                    </p>
                  )}
                  {activeItem.note ? (
                    <div className="rounded-xl border border-amber bg-amber-tint/50 p-3">
                      <h4 className="m-0 mb-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-amber-dark">
                        {t('itinerary.detail.itemNote')}
                      </h4>
                      <p className="m-0 whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
                        {activeItem.note}
                      </p>
                    </div>
                  ) : (
                    <p className="m-0 text-[13px] text-ink-soft">{t('itinerary.detail.noNote')}</p>
                  )}
                </div>
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-line bg-white p-6 text-center text-[13px] text-ink-soft">
                  {t('itinerary.detail.noItemSelected')}
                </div>
              )}
            </div>
          </div>
          </>
          )}
        </>
      )}

      <ShareTripDialog
        open={shareOpen}
        trip={trip}
        canManage={isOwner}
        onClose={() => setShareOpen(false)}
        onChange={async (action) => {
          const updated = await updateTripSharing(trip.id, user?.id ?? '', action);
          setLocalTrip(updated);
        }}
      />

      <DeleteTripDialog
        open={confirmDelete}
        tripName={trip.name}
        deleting={deleting}
        expenseCount={Math.max(tripExpenses.length, blockedExpenseCount)}
        onCancel={() => setConfirmDelete(false)}
        onOpenExpenses={() => navigate(`/settlement/${trip.id}`)}
        onConfirm={() => {
          setDeleting(true);
          setActionError(null);
          void remove(trip.id)
            .then(() => navigate('/itinerary', { replace: true }))
            .catch((err: unknown) => {
              // Có người vừa ghi thêm khoản chi: giữ dialog, đổi sang lý do bị chặn.
              if (err instanceof TripHasExpensesError) {
                setBlockedExpenseCount(err.count);
                return;
              }
              if (err instanceof TripNotOwnerError) {
                setActionError(t('itinerary.detail.ownerOnly'));
                setConfirmDelete(false);
                return;
              }
              setActionError(t('itinerary.detail.deleteError'));
              setConfirmDelete(false);
            })
            .finally(() => setDeleting(false));
        }}
      />
    </div>
  );
}
