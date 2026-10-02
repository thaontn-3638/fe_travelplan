import { useState } from 'react';
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard';
import { LeaveStepDialog } from '../features/itinerary/components/LeaveStepDialog';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useTrips } from '../features/itinerary/hooks/useTrips';
import { TripWizardStepper } from '../features/itinerary/components/TripWizardStepper';
import { TripBasicsForm } from '../features/itinerary/components/TripBasicsForm';
import { validateBasics, type TripBasics } from '../features/itinerary/utils/tripBasics';
import { buildDays, normalizeEndDate } from '../features/itinerary/utils/itineraryRules';
import { getInitials } from '../utils/formatters';

// Bước 1 của luồng tạo. Khác bản cũ ở chỗ: bấm Lưu là trip được tạo thật
// (POST /trips), nên từ Bước 2 trở đi mọi thứ đều thao tác trên một bản ghi có
// thật — không còn draft nằm trong router state. Xem trip-board.md §4.
export default function ItineraryNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { create } = useTrips();

  // Người tạo có mặt trong danh sách ngay từ đầu: mọi khoản chi sau này đều
  // phải trỏ vào một travelerId có thật.
  const [initialBasics] = useState<TripBasics>(() => ({
    name: '',
    regions: [],
    startDate: '',
    endDate: null,
    party: { adults: 1, children: 0 },
    travelers: [
      {
        id: crypto.randomUUID(),
        userId: user?.id,
        fullName: user?.fullName,
        initials: getInitials(user?.fullName ?? '?'),
        colorClass: 'bg-ocean',
      },
    ],
    status: 'idea',
  }));
  const [basics, setBasics] = useState<TripBasics>(initialBasics);
  const [saving, setSaving] = useState(false);
  // Huỷ / rời trang khi đã nhập gì đó thì hỏi trước, giống màn sửa (R10).
  const isDirty = JSON.stringify(basics) !== JSON.stringify(initialBasics);
  const guard = useUnsavedChangesGuard(isDirty && !saving);
  const [error, setError] = useState<string | null>(null);

  const validation = validateBasics(basics, t as (key: string, options?: Record<string, unknown>) => string);

  async function handleSubmit(): Promise<void> {
    if (!validation.canSubmit || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const endDate = normalizeEndDate(basics.startDate, basics.endDate);

      const trip = await create({
        ownerId: user?.id ?? '',
        name: basics.name.trim(),
        regions: basics.regions,
        startDate: basics.startDate,
        endDate,
        days: buildDays(basics.startDate, endDate),
        travelers: basics.travelers,
        party: basics.party,
      });

      guard.bypassOnce();
      navigate(`/itinerary/${trip.id}/edit/2`, { replace: true });
    } catch {
      setError(t('itinerary.detail.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[760px] pb-24">
      <TripWizardStepper current={1} maxReachable={1} />

      <h1 className="m-0 mb-1 font-display text-[22px] font-bold text-ink">{t('itinerary.stepOne.title')}</h1>
      <p className="m-0 mb-7 text-[14px] text-ink-soft">{t('itinerary.stepOne.subtitle')}</p>

      <TripBasicsForm value={basics} onChange={setBasics} currentUserId={user?.id ?? ''} />

      <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-3 border-t border-line bg-white/95 px-5 py-3 backdrop-blur">
        {error && <span className="text-[12.5px] font-semibold text-coral-dark">{error}</span>}
        <button
          type="button"
          onClick={() => navigate('/itinerary')}
          className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"
        >
          {t('itinerary.detail.cancel')}
        </button>
        <button
          type="button"
          disabled={!validation.canSubmit || saving}
          onClick={() => void handleSubmit()}
          className="rounded-xl bg-ocean px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-ocean-dark disabled:cursor-not-allowed disabled:bg-navy-soft"
        >
          {saving ? t('itinerary.detail.saving') : t('itinerary.wizard.saveAndContinue')}
        </button>
      </div>

      <LeaveStepDialog
        open={guard.blocked}
        saving={saving}
        canSave={validation.canSubmit}
        onStay={guard.cancel}
        onDiscard={guard.confirm}
        onSave={() => {
          guard.cancel();
          void handleSubmit();
        }}
      />
    </div>
  );
}
