import { useTranslation } from 'react-i18next';
import type { TripStatus } from '../types';

const STATUS_TEXT_CLASSES: Record<TripStatus, string> = {
  idea: 'text-idea-dark',
  planning: 'text-amber-dark',
  confirmed: 'text-ocean-dark',
  ongoing: 'text-coral-dark',
  settling: 'text-violet-dark',
  done: 'text-mint-dark',
};

const STATUS_TINT_CLASSES: Record<TripStatus, string> = {
  idea: 'bg-idea-tint',
  planning: 'bg-amber-tint',
  confirmed: 'bg-ocean-tint',
  ongoing: 'bg-coral-tint',
  settling: 'bg-violet-tint',
  done: 'bg-mint-tint',
};

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
