import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, TextField } from '@mui/material';
import type { TripRegion, TripStatus } from '../../../types';
import {
  partyFromTravelers,
  partyMatchesTravelers,
  TRIP_STATUSES,
  validateBasics,
  type TripBasics,
} from '../utils/tripBasics';
import { RegionMultiSelect } from './RegionMultiSelect';
import { PartySizeInput } from './PartySizeInput';
import { TravelerManager } from './TravelerManager';
import { buildDefaultTripName } from '../utils/tripDefaults';

interface TripBasicsFormProps {
  value: TripBasics;
  onChange: (next: TripBasics) => void;
  currentUserId: string;
  showStatus?: boolean;
  // Thành viên đã có chi tiêu — không cho xoá (S9).
  lockedTravelerIds?: string[];
  // false = người đang sửa không phải chủ trip → không xoá được thành viên.
  canRemoveMembers?: boolean;
}

export function TripBasicsForm({
  value,
  onChange,
  currentUserId,
  showStatus = false,
  lockedTravelerIds = [],
  canRemoveMembers = true,
}: TripBasicsFormProps) {
  const { t } = useTranslation();
  // Khi người dùng đã tự sửa tên thì đổi điểm đến không được ghi đè lên nữa.
  const [nameTouched, setNameTouched] = useState(() => {
    return value.name.trim() !== '' && value.name !== buildDefaultTripName(value.regions);
  });

  const validation = validateBasics(value, t as (key: string, options?: Record<string, unknown>) => string);
  // Ô bắt buộc để trống: chỉ báo sau khi người dùng đã chạm vào, để form mới
  // mở ra không đỏ rực — nhưng phải có lý do, nếu không nút Lưu bị khoá mà
  // không ai hiểu vì sao.
  const [regionsTouched, setRegionsTouched] = useState(value.regions.length > 0);
  const nameMissing = nameTouched && value.name.trim() === '';
  const regionsMissing = regionsTouched && value.regions.length === 0;
  const ids = {
    city: useId(),
    name: useId(),
    party: useId(),
    travelers: useId(),
    start: useId(),
    end: useId(),
    status: useId(),
  };

  // Thêm/xoá thành viên khi số người đang khớp thì số người đi theo luôn — chỉ
  // khi người dùng tự chỉnh số người cho lệch đi mới phải sửa tay.
  function handleTravelersChange(travelers: TripBasics['travelers']): void {
    const wasInSync = partyMatchesTravelers(value.party, value.travelers);
    const counts = partyFromTravelers(travelers);
    onChange({
      ...value,
      travelers,
      party: wasInSync && counts.adults >= 1 ? counts : value.party,
    });
  }

  function handleRegionsChange(regions: TripRegion[]): void {
    onChange({
      ...value,
      regions,
      name: nameTouched ? value.name : buildDefaultTripName(regions),
    });
  }

  return (
    <div className="flex flex-col gap-7">
      <section>
        <Label id={ids.city} required>{t('itinerary.stepOne.cityLabel')}</Label>
        <RegionMultiSelect
          value={value.regions}
          onChange={(regions) => {
            setRegionsTouched(true);
            handleRegionsChange(regions);
          }}
          currentUserId={currentUserId}
          labelledBy={ids.city}
          error={regionsMissing}
          helperText={regionsMissing ? t('itinerary.stepOne.cityRequired') : undefined}
        />
      </section>

      <section>
        <Label id={ids.name} required>{t('itinerary.stepOne.nameLabel')}</Label>
        <TextField
          fullWidth
          size="small"
          value={value.name}
          error={nameMissing}
          helperText={nameMissing ? t('itinerary.stepOne.nameRequired') : undefined}
          slotProps={{ htmlInput: { maxLength: 80, 'aria-labelledby': ids.name, 'aria-required': true } }}
          placeholder={t('itinerary.stepOne.namePlaceholder') ?? ''}
          onChange={(event) => {
            setNameTouched(true);
            onChange({ ...value, name: event.target.value });
          }}
        />
      </section>

      <section>
        <Label id={ids.party} required>{t('itinerary.stepOne.partyLabel')}</Label>
        <PartySizeInput
          value={value.party}
          onChange={(party) => onChange({ ...value, party })}
          error={Boolean(validation.partyError)}
        />
        {validation.partyError && (
          <div
            role="alert"
            className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-coral bg-coral-tint px-3 py-2.5 text-[12.5px] font-medium text-coral-dark"
          >
            <span className="min-w-0 flex-1">{validation.partyError}</span>
            {validation.partySuggestion && (
              <button
                type="button"
                onClick={() => onChange({ ...value, party: validation.partySuggestion! })}
                className="rounded-lg border border-coral-dark bg-white px-3 py-1.5 text-[12px] font-semibold text-coral-dark transition hover:bg-coral-dark hover:text-white"
              >
                {t('itinerary.stepOne.partyQuickFix', { ...validation.partySuggestion })}
              </button>
            )}
          </div>
        )}
      </section>

      <section>
        <Label id={ids.travelers}>{t('itinerary.stepOne.travelersLabel')}</Label>
        <TravelerManager
          value={value.travelers}
          onChange={handleTravelersChange}
          lockedIds={lockedTravelerIds}
          currentUserId={currentUserId}
          canRemoveMembers={canRemoveMembers}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label id={ids.start} required>{t('itinerary.stepOne.startDateLabel')}</Label>
          <TextField
            fullWidth
            size="small"
            type="date"
            value={value.startDate}
            slotProps={{ htmlInput: { 'aria-labelledby': ids.start, 'aria-required': true } }}
            onChange={(event) => onChange({ ...value, startDate: event.target.value })}
          />
        </div>
        <div>
          <Label id={ids.end}>{t('itinerary.stepOne.endDateLabel')}</Label>
          <TextField
            fullWidth
            size="small"
            type="date"
            value={value.endDate ?? ''}
            error={Boolean(validation.dateError)}
            helperText={validation.dateError ?? ''}
            slotProps={{ htmlInput: { min: value.startDate || undefined, 'aria-labelledby': ids.end } }}
            onChange={(event) => onChange({ ...value, endDate: event.target.value || null })}
          />
        </div>
      </section>

      {showStatus && (
        <section>
          <Label id={ids.status}>{t('itinerary.stepOne.statusLabel')}</Label>
          <TextField
            select
            size="small"
            slotProps={{ select: { 'aria-labelledby': ids.status } as object }}
            className="w-full sm:w-[240px]"
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as TripStatus })}
          >
            {TRIP_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {t(`dashboard.status.${status}`)}
              </MenuItem>
            ))}
          </TextField>
        </section>
      )}

      <div
        className={`rounded-2xl px-4 py-3.5 text-[13px] font-medium ${
          !value.startDate ? 'bg-amber-tint text-amber-dark' : 'bg-ocean-tint text-ocean-dark'
        }`}
      >
        {!value.startDate
          ? t('itinerary.stepOne.hintNeedStartDate')
          : value.endDate
            ? t('itinerary.stepOne.hintBothDates', {
                days: validation.dayCount,
                nights: (validation.dayCount ?? 1) - 1,
              })
            : t('itinerary.stepOne.hintOneDayTrip')}
        {validation.pastWarning && ` · ${t('itinerary.stepOne.pastDateWarning')}`}
      </div>
    </div>
  );
}

function Label({ id, children, required = false }: { id?: string; children: React.ReactNode; required?: boolean }) {
  const { t } = useTranslation();

  return (
    <h2 id={id} className="m-0 mb-2 flex items-center gap-1 text-[13px] font-bold uppercase tracking-[0.06em] text-ink-soft">
      {children}
      {required && (
        <span className="text-[14px] font-bold text-coral-dark" title={t('itinerary.stepOne.required') ?? ''}>
          *
        </span>
      )}
    </h2>
  );
}
