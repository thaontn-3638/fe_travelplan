import { useTranslation } from 'react-i18next';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { TimeConflict } from '../utils/itineraryRules';

interface ScheduleConflictBannerProps {
  conflicts: TimeConflict[];
  // Tính lại từ dữ liệu hiện tại ở mỗi lần render, nên sau khi người dùng sửa
  // cho dồn được thì nút bật lại ngay — không còn lý do cũ dính lại.
  canPushDown: boolean;
  onFocusFirst: () => void;
  onPushDown: () => void;
}

// R6 — trạng thái trùng giờ luôn hiện realtime kèm một cách thoát bằng một
// click, để việc khoá nút Lưu không bao giờ thành ngõ cụt.
export function ScheduleConflictBanner({
  conflicts,
  canPushDown,
  onFocusFirst,
  onPushDown,
}: ScheduleConflictBannerProps) {
  const { t } = useTranslation();

  if (conflicts.length === 0) {
    return null;
  }

  const affected = new Set(conflicts.flatMap((conflict) => [conflict.aId, conflict.bId]));

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-coral bg-coral-tint/50 px-4 py-3">
      <WarningAmberRoundedIcon fontSize="small" className="text-coral-dark" />
      <span className="flex-1 text-[13px] font-semibold text-coral-dark">
        {t('itinerary.step3.conflictCount', { count: affected.size })}
        {!canPushDown && (
          <span className="ml-2 font-normal">· {t('itinerary.step3.pushDownFailed')}</span>
        )}
      </span>
      <button
        type="button"
        onClick={onFocusFirst}
        className="rounded-lg border border-coral bg-white px-3 py-1.5 text-[12.5px] font-semibold text-coral-dark"
      >
        {t('itinerary.step3.conflictView')}
      </button>
      <button
        type="button"
        disabled={!canPushDown}
        onClick={onPushDown}
        title={canPushDown ? undefined : (t('itinerary.step3.pushDownFailed') ?? '')}
        className="rounded-lg bg-coral px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:bg-ink-soft/40"
      >
        {t('itinerary.step3.pushDown')}
      </button>
    </div>
  );
}
