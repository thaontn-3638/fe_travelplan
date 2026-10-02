import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Snackbar } from '@mui/material';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useSavedPlaces } from '../features/places/hooks/useSavedPlaces';
import { useTrip } from '../features/itinerary/hooks/useTrip';
import { useExpenses } from '../features/settlement/hooks/useExpenses';
import { usePlaceCatalog } from '../features/itinerary/hooks/usePlaceCatalog';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { TripWizardStepper } from '../features/itinerary/components/TripWizardStepper';
import type { WizardStep } from '../features/itinerary/utils/wizardSteps';
import { TripBasicsForm } from '../features/itinerary/components/TripBasicsForm';
import { validateBasics, type TripBasics } from '../features/itinerary/utils/tripBasics';
import { ItineraryBoard } from '../features/itinerary/components/ItineraryBoard';
import { CategoryFilterChips } from '../features/itinerary/components/CategoryFilterChips';
import { ScheduleStep } from '../features/itinerary/components/ScheduleStep';
import { BudgetStep } from '../features/budget/components/BudgetStep';
import { LeaveStepDialog } from '../features/itinerary/components/LeaveStepDialog';
import { applyItineraryDrag, createActivityItem, createPlaceItem, type DragData } from '../features/itinerary/dnd';
import { DragPreviewCard } from '../features/itinerary/components/DragPreviewCard';
import {
  addDay,
  addItemToDay,
  applyDateRange,
  findItemsWithLongNote,
  hasConflicts,
  isUsableDateRange,
  itemsLostByDateRange,
  moveItemToDay,
  normalizeEndDate,
  removeDay,
  removeItem,
  reorderByTime,
  swapDays,
} from '../features/itinerary/utils/itineraryRules';
import { tripProgress } from '../features/itinerary/utils/tripProgress';
import type { CategoryKey } from '../features/places/utils';
import type { Trip } from '../types';
import { PageLoading } from '../components/PageLoading';
import { canManageTrip } from '../features/itinerary/utils/tripAccess';
import { getTrip } from '../features/itinerary/api/tripApi';
import { analyzeSave, pickSections, type SaveAnalysis } from '../features/itinerary/utils/tripMerge';
import { SaveConflictDialog } from '../features/itinerary/components/SaveConflictDialog';

// Bước cao nhất đã dựng xong — cũng là bước mang nút "Hoàn thành".
const MAX_IMPLEMENTED_STEP: WizardStep = 4;

function parseStep(raw: string | undefined): WizardStep {
  const parsed = Number(raw);
  return parsed === 1 || parsed === 2 || parsed === 3 || parsed === 4 ? parsed : 1;
}

export default function ItineraryEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tripId, step: rawStep } = useParams<{ tripId: string; step: string }>();
  const step = parseStep(rawStep);

  const { user } = useAuth();
  const { trip, loading, error, patch, setLocalTrip } = useTrip(tripId);
  // Cần cho hai luật: B5 (đã có chi tiêu thì khoá đổi đơn vị tiền) và S9
  // (không cho xoá thành viên đã xuất hiện trong một khoản chi).
  const { expenses, loading: expensesLoading, error: expensesError } = useExpenses(tripId);
  const { placesById, regions, addPlace } = usePlaceCatalog(user?.id ?? '');
  const { items: savedPlaces } = useSavedPlaces(user?.id ?? '');

  const [draft, setDraft] = useState<Trip | null>(null);
  // Mốc so sánh để tính dirty. Bình thường là bản trên server, nhưng việc gán
  // giờ tự động khi vào Bước 3 là gợi ý của hệ thống chứ không phải thao tác
  // của người dùng — nó dời mốc này để bấm Huỷ ngay lúc đó không bị hỏi.
  const [baseline, setBaseline] = useState<Trip | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'left' | 'right'>('left');
  const [category, setCategory] = useState<CategoryKey | null>(null);
  const [pendingDates, setPendingDates] = useState<TripBasics | null>(null);
  // Đích đến đang bị chặn lại vì bước hiện tại còn thay đổi chưa lưu.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [dragging, setDragging] = useState<DragData | null>(null);
  // R13 — người khác đã sửa CÙNG phần trong lúc mình đang sửa.
  const [conflict, setConflict] = useState<{
    latest: Trip;
    prepared: Trip;
    analysis: SaveAnalysis;
    // Chạy tiếp việc đang làm dở (chuyển bước, rời trang) — proceed=false là ở lại.
    onResolved: (proceed: boolean) => void;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bàn phím: Space/Enter trên tay nắm để nhấc, mũi tên để di chuyển, Space để
  // thả. Điện thoại dùng menu "Chuyển sang…" trên từng dòng thay vì kéo.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    setDraft(trip);
    setBaseline(trip);
    setSaveError(null);
  }, [trip, tripId]);

  // Bản đang mở (server) — mốc "original" để biết phần nào là mình sửa, phần
  // nào là người khác sửa (R13). Dùng ref để handler async đọc bản mới nhất.
  const originalRef = useRef<Trip | null>(null);
  originalRef.current = trip;

  const isDirty = useMemo(
    () => Boolean(draft && baseline) && JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline],
  );
  const guard = useUnsavedChangesGuard(isDirty);

  const mutate = useCallback((updater: (current: Trip) => Trip): void => {
    setDraft((current) => (current ? updater(current) : current));
  }, []);

  const basics: TripBasics | null = draft
    ? {
        name: draft.name,
        regions: draft.regions,
        startDate: draft.startDate,
        endDate: draft.endDate,
        party: draft.party,
        travelers: draft.travelers,
        status: draft.status,
      }
    : null;

  // Đổi khoảng ngày có thể làm mất ngày → hỏi lại trước, và item của các ngày
  // bị cắt chuyển sang "Chưa xếp ngày" chứ không bị xoá (R3).
  function handleBasicsChange(next: TripBasics): void {
    if (!draft) return;

    const rangeChanged = next.startDate !== draft.startDate || next.endDate !== draft.endDate;
    // Đang gõ dở ngày (khoảng ngày tạm sai) thì chỉ ghi giá trị vào form, giữ
    // nguyên các ngày của lịch trình; lỗi ngày hiện inline và nút Lưu bị khoá.
    if (!rangeChanged || !isUsableDateRange(next.startDate, next.endDate)) {
      setDraft({ ...draft, ...next });
      return;
    }

    const { removedDays, movedItems } = itemsLostByDateRange(draft, next.startDate, next.endDate);
    if (removedDays > 0 && movedItems > 0) {
      setPendingDates(next);
      return;
    }

    setDraft(applyDateRange({ ...draft, ...next }, next.startDate, next.endDate));
  }

  function confirmDateChange(): void {
    if (!draft || !pendingDates) return;
    setDraft(applyDateRange({ ...draft, ...pendingDates }, pendingDates.startDate, pendingDates.endDate));
    setPendingDates(null);
  }

  function handleDragStart(event: DragStartEvent): void {
    setDragging((event.active.data.current as DragData | undefined) ?? null);
  }

  function handleDragEnd(event: DragEndEvent): void {
    setDragging(null);
    mutate((current) => applyItineraryDrag(current, event) ?? current);
  }

  // Chuẩn hoá bản nháp trước khi so / ghi.
  function prepare(current: Trip): Trip {
    return {
      ...current,
      name: current.name.trim(),
      endDate: normalizeEndDate(current.startDate, current.endDate),
      // R4 — thời gian thắng order: lưu Bước 3 thì ghi lại order theo giờ.
      days: step === 3 ? reorderByTime(current.days) : current.days,
    };
  }

  // R13 — chỉ ghi các PHẦN mình đã sửa. Người khác sửa phần khác thì tự gộp
  // (PATCH của json-server trộn field); cùng sửa một phần thì hỏi.
  // `onResolved` chỉ được gọi khi phải hỏi (xung đột) — lưu thẳng thì caller
  // tự đi tiếp theo giá trị trả về.
  async function save(onResolved: (proceed: boolean) => void = () => {}): Promise<boolean> {
    const original = originalRef.current;
    if (!draft || !original || saving) return false;

    setSaving(true);
    setSaveError(null);
    try {
      const prepared = prepare(draft);
      const latest = await getTrip(original.id);
      const analysis = analyzeSave(original, prepared, latest);

      if (analysis.conflicts.length > 0) {
        setConflict({ latest, prepared, analysis, onResolved });
        return false;
      }

      if (analysis.mine.length > 0) {
        await patch(pickSections(prepared, analysis.mine));
      } else if (analysis.theirs.length > 0) {
        setLocalTrip(latest);
      }
      return true;
    } catch {
      setSaveError(t('itinerary.detail.saveError'));
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Xung đột → "ghi đè bằng bản của tôi": ghi mọi phần mình đã sửa.
  async function resolveKeepMine(): Promise<void> {
    if (!conflict) return;
    const { prepared, analysis, onResolved } = conflict;
    setSaving(true);
    try {
      await patch(pickSections(prepared, analysis.mine));
      setConflict(null);
      onResolved(true);
    } catch {
      setSaveError(t('itinerary.detail.saveError'));
      setConflict(null);
      onResolved(false);
    } finally {
      setSaving(false);
    }
  }

  // Xung đột → "lấy bản mới nhất": phần bị trùng lấy theo server; các phần
  // mình sửa mà không ai đụng vẫn được lưu. Ở lại bước hiện tại để xem lại.
  async function resolveTakeLatest(): Promise<void> {
    if (!conflict) return;
    const { latest, prepared, analysis, onResolved } = conflict;
    const safe = analysis.mine.filter((section) => !analysis.conflicts.includes(section));
    setSaving(true);
    try {
      if (safe.length > 0) {
        await patch(pickSections(prepared, safe));
      } else {
        setLocalTrip(latest);
      }
      setNotice(t('itinerary.conflict.loadedLatest'));
    } catch {
      setSaveError(t('itinerary.detail.saveError'));
    } finally {
      setSaving(false);
      setConflict(null);
      onResolved(false);
    }
  }

  // "Lưu tạm" = lưu rồi về màn xem. "Tiếp tục" = lưu rồi sang bước sau.
  async function saveAndGo(target: WizardStep | 'detail'): Promise<void> {
    const go = () => {
      guard.bypassOnce();
      navigate(target === 'detail' ? `/itinerary/${tripId}` : `/itinerary/${tripId}/edit/${target}`);
    };
    if (await save((proceed) => proceed && go())) go();
  }

  // Bấm icon bước khác hoặc Huỷ: nếu còn thay đổi chưa lưu thì hỏi trước.
  function leaveTo(go: () => void): void {
    if (isDirty) {
      setPendingLeave(() => go);
      return;
    }
    go();
  }

  function goToStep(next: WizardStep): void {
    if (next === step) return;
    leaveTo(() => navigate(`/itinerary/${tripId}/edit/${next}`));
  }

  if (loading) return <PageLoading />;

  if (error || !draft || !baseline || !basics) {
    return (
      <div className="mx-auto max-w-[520px] rounded-2xl border border-dashed border-line bg-white px-6 py-14 text-center">
        <h2 className="m-0 mb-2 font-display text-lg font-bold text-ink">
          {t('itinerary.detail.loadErrorTitle')}
        </h2>
        <p className="m-0 text-sm text-ink-soft">{t('itinerary.detail.loadErrorBody')}</p>
      </div>
    );
  }

  const validation = validateBasics(basics, t as (key: string, options?: Record<string, unknown>) => string);
  // Xoá một người đã có chi tiêu là làm `payerId`/`shares[]` trỏ vào người
  // không tồn tại — và khi đó Σ số dư khác 0 một cách âm thầm (S9).
  //
  // Chưa tải xong (hoặc tải lỗi) danh sách chi tiêu thì CHƯA BIẾT ai có chi
  // tiêu — khoá hết cho an toàn, thay vì mở khoá hết.
  const expensesUnknown = expensesLoading || expensesError !== null;
  const travelerIdsWithExpenses = expensesUnknown
    ? draft.travelers.map((traveler) => traveler.id)
    : [
        ...new Set(
          expenses.flatMap((expense) => [expense.payerId, ...expense.shares.map((share) => share.travelerId)]),
        ),
      ];
  const draggingItem =
    dragging?.type === 'item'
      ? ([...draft.days.flatMap((day) => day.items), ...draft.unscheduledItems].find(
          (item) => item.id === dragging.itemId,
        ) ?? null)
      : null;
  // R6 — còn cặp trùng giờ thì không cho lưu; banner đã chỉ rõ chỗ và có nút
  // "Dồn xuống" để thoát ra bằng một click.
  const scheduleBlocked = step === 3 && hasConflicts(draft.days);
  const noteBlocked = findItemsWithLongNote(draft).length > 0;
  const canSave = (step === 1 ? validation.canSubmit : true) && !scheduleBlocked && !noteBlocked;
  const completed = ([1, 2, 3, 4] as WizardStep[]).filter((value) => value <= tripProgress(draft));

  const body =
    step === 1 ? (
      <div className="mx-auto max-w-[760px]">
        <TripBasicsForm
          value={basics}
          onChange={handleBasicsChange}
          currentUserId={user?.id ?? ''}
          showStatus
          lockedTravelerIds={travelerIdsWithExpenses}
          canRemoveMembers={canManageTrip(draft, user?.id ?? '')}
        />
      </div>
    ) : step === 4 ? (
      <BudgetStep
        trip={draft}
        placesById={placesById}
        hasExpenses={expensesUnknown || expenses.length > 0}
        onChange={setDraft}
      />
    ) : step === 3 ? (
      <ScheduleStep
        trip={draft}
        placesById={placesById}
        onChange={setDraft}
        onAutoAssign={(next) => {
          setDraft(next);
          setBaseline(next);
        }}
      />
    ) : (
      <ItineraryBoard
        trip={draft}
        placesById={placesById}
        regions={regions}
        savedPlaces={savedPlaces}
        currentUserId={user?.id ?? ''}
        onPlaceCreated={addPlace}
        category={category}
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
        onAddPlace={(placeId, dayId) => mutate((current) => addItemToDay(current, dayId, createPlaceItem(placeId)))}
        onAddActivity={(dayId, input) =>
          mutate((current) =>
            addItemToDay(
              current,
              dayId,
              createActivityItem(input.title, { note: input.note, category: input.category }),
            ),
          )
        }
        onRemoveItem={(itemId) => mutate((current) => removeItem(current, itemId))}
        onMoveItem={(itemId, fromDayId, toDayId) =>
          // insertAfter = null → thêm vào cuối ngăn đích, như thả vào vùng trống.
          mutate((current) => moveItemToDay(current, itemId, fromDayId, toDayId, null))
        }
        onRemoveDay={(dayId) => mutate((current) => removeDay(current, dayId))}
        onSwapDays={(dayIdA, dayIdB) => mutate((current) => swapDays(current, dayIdA, dayIdB))}
        onAddDay={() => mutate((current) => addDay(current))}
      />
    );

  return (
    <div className="pb-24">
      <TripWizardStepper
        current={step}
        maxReachable={MAX_IMPLEMENTED_STEP}
        completed={completed}
        onStepClick={goToStep}
      />

      {/* Bước 1 là form hẹp căn giữa nên tiêu đề phải nằm trong cùng khối đó;
          Bước 2/3 là bảng rộng, tiêu đề bám lề trái. */}
      <div className={`mb-5 ${step === 1 ? 'mx-auto max-w-[760px]' : ''}`}>
        <h1 className="m-0 font-display text-[22px] font-bold text-ink">{draft.name}</h1>
        <p className="m-0 text-[13px] text-ink-soft">{t(`itinerary.wizard.subtitle${step}`)}</p>
      </div>

      {step === 2 && (
        <div className="mb-5">
          <CategoryFilterChips value={category} onChange={setCategory} />
        </div>
      )}

      {step === 2 ? (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDragging(null)}
        >
          {body}
          <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {dragging ? (
              <DragPreviewCard
                item={draggingItem}
                place={dragging.type === 'place' ? placesById.get(dragging.placeId) : undefined}
                placesById={placesById}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        body
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
        {saveError && <span className="text-[12.5px] font-semibold text-coral-dark">{saveError}</span>}
        {step === 1 && validation.partyError && (
          <span className="text-[12.5px] font-semibold text-coral-dark">
            {t('itinerary.stepOne.partyBlocked')}
          </span>
        )}
        {scheduleBlocked && (
          <span className="text-[12.5px] font-semibold text-coral-dark">
            {t('itinerary.step3.saveBlocked')}
          </span>
        )}
        {noteBlocked && (
          <span className="text-[12.5px] font-semibold text-coral-dark">
            {t('itinerary.step3.noteBlocked')}
          </span>
        )}
        <button
          type="button"
          onClick={() => leaveTo(() => navigate(`/itinerary/${tripId}`))}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          {t('itinerary.detail.cancel')}
        </button>
        <button
          type="button"
          disabled={saving || !canSave || !isDirty}
          onClick={() => void saveAndGo('detail')}
          className="rounded-xl border border-ocean bg-white px-4 py-2.5 text-sm font-semibold text-ocean-dark transition disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft"
        >
          {saving ? t('itinerary.detail.saving') : t('itinerary.wizard.saveDraft')}
        </button>
        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() =>
            void saveAndGo(step === MAX_IMPLEMENTED_STEP ? 'detail' : ((step + 1) as WizardStep))
          }
          className="rounded-xl bg-ocean px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean-dark disabled:cursor-not-allowed disabled:bg-navy-soft"
        >
          {step === MAX_IMPLEMENTED_STEP ? t('itinerary.wizard.finish') : t('itinerary.wizard.next')}
        </button>
      </div>

      <Dialog open={pendingDates !== null} onClose={() => setPendingDates(null)}>
        <DialogTitle>{t('itinerary.step2.shrinkTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingDates &&
              t('itinerary.step2.shrinkBody', itemsLostByDateRange(draft, pendingDates.startDate, pendingDates.endDate))}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDates(null)}>{t('itinerary.detail.cancel')}</Button>
          <Button onClick={confirmDateChange} color="error">
            {t('itinerary.step2.shrinkConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <LeaveStepDialog
        open={guard.blocked || pendingLeave !== null}
        saving={saving}
        canSave={canSave}
        onStay={() => {
          setPendingLeave(null);
          guard.cancel();
        }}
        onDiscard={() => {
          const go = pendingLeave;
          setPendingLeave(null);
          setDraft(baseline);
          if (go) {
            guard.bypassOnce();
            go();
          }
          else guard.confirm();
        }}
        onSave={() => {
          const proceed = () => {
            const go = pendingLeave;
            setPendingLeave(null);
            if (go) {
              guard.bypassOnce();
              go();
            } else guard.confirm();
          };
          const stay = () => {
            setPendingLeave(null);
            guard.cancel();
          };
          void save((ok) => (ok ? proceed() : stay())).then((ok) => {
            if (ok) proceed();
          });
        }}
      />

      <SaveConflictDialog
        open={conflict !== null}
        sections={conflict?.analysis.conflicts ?? []}
        saving={saving}
        onKeepMine={() => void resolveKeepMine()}
        onTakeLatest={() => void resolveTakeLatest()}
        onCancel={() => {
          const pending = conflict;
          setConflict(null);
          pending?.onResolved(false);
        }}
      />

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </div>
  );
}
