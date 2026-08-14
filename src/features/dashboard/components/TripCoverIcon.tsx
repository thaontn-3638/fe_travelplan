import { palette } from '../../../theme/palette';
import type { TripIcon } from '../types';

interface TripCoverIconProps {
  icon: TripIcon;
  className?: string;
}

export function TripCoverIcon({ icon, className }: TripCoverIconProps) {
  const props = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: palette.white,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  };

  switch (icon) {
    case 'landmark':
      return (
        <svg {...props}>
          <path d="M4 18h16M6 18l1.5-9h9L18 18M9 9l1-5h4l1 5" />
        </svg>
      );
    case 'beach':
      return (
        <svg {...props}>
          <path d="M4 20c3-8 6-14 8-16 2 2 5 8 8 16" />
          <path d="M4 20h16" />
        </svg>
      );
    case 'lantern':
      return (
        <svg {...props}>
          <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 7.1 18.2 8 12.7 4 8.8l5.5-.8z" />
        </svg>
      );
    case 'settlement':
      return (
        <svg {...props}>
          <path d="M6 20V9l6-5 6 5v11M10 20v-6h4v6" />
        </svg>
      );
    case 'noodles':
      return (
        <svg {...props}>
          <path d="M4 20l4-6 3 4 3-7 6 9" />
        </svg>
      );
    case 'ski':
      return (
        <svg {...props}>
          <path d="M4 16l4-6 3 4 3-7 6 9" />
        </svg>
      );
    default:
      return null;
  }
}
