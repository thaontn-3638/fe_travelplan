import { useTranslation } from 'react-i18next';
import { TextField } from '@mui/material';
import type { ItineraryItem, Place } from '../../../types';
import { isNoteTooLong, isValidRange, MAX_NOTE_LENGTH } from '../utils/itineraryRules';

const DEFAULT_SPAN_MINUTES = 60;

// Cộng/trừ phút trên "HH:mm", kẹp trong 00:00–23:59 (không tràn sang ngày sau).
function shiftTime(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, Math.max(0, hours * 60 + mins + minutes));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

interface ScheduleItemFormProps {
  item: ItineraryItem | null;
  place: Place | undefined;
  onChange: (patch: Partial<Omit<ItineraryItem, 'id'>>) => void;
}

// Panel phải của Bước 3 — sửa giờ bằng bàn phím và ghi chú. Chi phí dự trù gom
// hết về Bước 4 nên không nhập ở đây.
// Giá trị không hợp lệ bị báo inline và KHÔNG được ghi vào state.
export function ScheduleItemForm({ item, place, onChange }: ScheduleItemFormProps) {
  const { t } = useTranslation();

  if (!item) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-dashed border-line bg-white p-6 text-center text-[13px] text-ink-soft">
        {t('itinerary.step3.noItemSelected')}
      </div>
    );
  }

  const title = item.kind === 'activity' ? (item.title ?? '') : (place?.title ?? '');
  const rangeInvalid =
    item.startTime !== null && item.endTime !== null && !isValidRange(item.startTime, item.endTime);
  const noteLength = item.note?.length ?? 0;
  const noteTooLong = isNoteTooLong(item.note);

  function handleTimeChange(field: 'startTime' | 'endTime', value: string): void {
    // Bước 3 không hỗ trợ bỏ giờ (spec §5.5): xoá trắng ô sẽ bị R5 gán lại ngay
    // ở lần render sau, gây cảm giác mục tự nhảy giờ. Bỏ qua giá trị rỗng.
    if (value === '') {
      return;
    }

    const next = { startTime: item!.startTime, endTime: item!.endTime, [field]: value };

    // Mục chưa có giờ (nằm ở dải "chưa xếp giờ") mà chỉ nhập một đầu: phải điền
    // luôn đầu còn lại. Giờ bắt đầu có mà giờ kết thúc null là bản ghi hỏng —
    // trip đó sẽ không tải lại được nữa.
    if (next.startTime && !next.endTime) {
      next.endTime = shiftTime(next.startTime, DEFAULT_SPAN_MINUTES);
    } else if (next.endTime && !next.startTime) {
      next.startTime = shiftTime(next.endTime, -DEFAULT_SPAN_MINUTES);
    }

    if (!next.startTime || !next.endTime || !isValidRange(next.startTime, next.endTime)) {
      return; // không ghi giá trị sai
    }
    onChange({ startTime: next.startTime, endTime: next.endTime });
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <h3 className="m-0 mb-3 font-display text-[15.5px] font-bold text-ink">{title}</h3>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <TextField
          size="small"
          type="time"
          label={t('itinerary.step3.startTime')}
          value={item.startTime ?? ''}
          error={rangeInvalid}
          onChange={(event) => handleTimeChange('startTime', event.target.value)}
        />
        <TextField
          size="small"
          type="time"
          label={t('itinerary.step3.endTime')}
          value={item.endTime ?? ''}
          error={rangeInvalid}
          helperText={rangeInvalid ? t('itinerary.step3.invalidRange') : ''}
          onChange={(event) => handleTimeChange('endTime', event.target.value)}
        />
      </div>

      <TextField
        fullWidth
        multiline
        minRows={2}
        size="small"
        label={t('itinerary.step3.note')}
        value={item.note ?? ''}
        error={noteTooLong}
        helperText={
          <span className={noteTooLong ? 'font-semibold text-coral-dark' : 'text-ink-soft'}>
            {t('itinerary.step3.noteCounter', { count: noteLength, max: MAX_NOTE_LENGTH })}
            {noteTooLong && ` · ${t('itinerary.step3.noteTooLong')}`}
          </span>
        }
        onChange={(event) => onChange({ note: event.target.value || undefined })}
      />

    </div>
  );
}
