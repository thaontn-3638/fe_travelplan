import { useTranslation } from 'react-i18next';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import type { PartySize } from '../../../types';

interface PartySizeInputProps {
  value: PartySize;
  onChange: (party: PartySize) => void;
  // Lệch với danh sách thành viên thì viền đỏ — lỗi chi tiết và nút sửa nhanh
  // do TripBasicsForm hiển thị ngay bên dưới.
  error?: boolean;
}

// `party` là số người thực tế của chuyến đi và là nguồn duy nhất cho phần dự
// trù chi phí (Bước 4). `travelers[]` là chuyện khác: ai được cùng lên lịch trình.
export function PartySizeInput({ value, onChange, error = false }: PartySizeInputProps) {
  const { t } = useTranslation();

  function update(field: keyof PartySize, delta: number): void {
    const floor = field === 'adults' ? 1 : 0;
    onChange({ ...value, [field]: Math.max(floor, value[field] + delta) });
  }

  return (
    <div className="flex flex-wrap gap-3">
      {(['adults', 'children'] as const).map((field) => (
        <div
          key={field}
          className={`flex items-center gap-2 rounded-[11px] border bg-white px-3 py-2 ${
            error ? 'border-coral' : 'border-line'
          }`}
        >
          <span className="text-[13px] font-semibold text-ink-soft">
            {t(`itinerary.stepOne.${field}`)}
          </span>
          <div className="flex items-center gap-1.5">
            <Stepper
              label="−"
              ariaLabel={t('itinerary.stepOne.decrease', { field: t(`itinerary.stepOne.${field}`) })}
              onClick={() => update(field, -1)}
            />
            <span aria-live="polite" className="w-6 text-center font-mono text-[14px] font-bold text-ink">
              {value[field]}
            </span>
            <Stepper
              label="+"
              ariaLabel={t('itinerary.stepOne.increase', { field: t(`itinerary.stepOne.${field}`) })}
              onClick={() => update(field, 1)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Stepper({ label, ariaLabel, onClick }: { label: '−' | '+'; ariaLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-ocean hover:text-ocean-dark"
    >
      {label === '+' ? <AddRoundedIcon sx={{ fontSize: 15 }} /> : <RemoveRoundedIcon sx={{ fontSize: 15 }} />}
    </button>
  );
}
