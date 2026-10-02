import { useTranslation } from 'react-i18next';
import type { TripStatus } from '../types';
import { STATUS_TEXT_CLASSES, STATUS_TINT_CLASSES } from './tripStatusColors';

interface TripStatusChipProps {
  status: TripStatus;
  className?: string;
  /** Render on a translucent white chip instead of the status tint — used over colored covers. */
  onCover?: boolean;
}

export function TripStatusChip({ status, className = '', onCover = false }: TripStatusChipProps) {
  const { t } = useTranslation();
  const surfaceClass = onCover ? 'bg-white/95' : STATUS_TINT_CLASSES[status];

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide ${surfaceClass} ${STATUS_TEXT_CLASSES[status]} ${className}`}
    >
      {t(`dashboard.status.${status}`)}
    </span>
  );
}
