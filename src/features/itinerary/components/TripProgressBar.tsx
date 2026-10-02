import { useTranslation } from 'react-i18next';
import { TRIP_STEP_COUNT } from '../utils/tripProgress';
import { LOCKED_STEPS, WIZARD_STEPS } from '../utils/wizardSteps';

interface TripProgressBarProps {
  progress: number; // 1..4
  className?: string;
}

// R11 — tiến độ lên lịch trình. Cả 4 bước đều đã dựng xong nên không đoạn nào
// vẽ mờ; giữ `LOCKED_STEPS` để còn chỗ khoá bước khi cần trong tương lai.
export function TripProgressBar({ progress, className = '' }: TripProgressBarProps) {
  const { t } = useTranslation();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex flex-1 gap-1" aria-hidden>
        {WIZARD_STEPS.map((step) => {
          const done = step <= progress;
          const locked = LOCKED_STEPS.includes(step);

          return (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full ${
                done ? 'bg-ocean' : locked ? 'bg-line/60' : 'bg-line'
              }`}
            />
          );
        })}
      </div>
      <span className="font-mono text-[11px] font-semibold text-ink-soft">
        {t('itinerary.list.progress', { done: progress, total: TRIP_STEP_COUNT })}
      </span>
    </div>
  );
}
