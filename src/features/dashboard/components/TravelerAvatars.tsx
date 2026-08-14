import type { Traveler } from '../types';

interface TravelerAvatarsProps {
  travelers: Traveler[];
  extraCount: number;
  size?: 'sm' | 'md';
}

export function TravelerAvatars({ travelers, extraCount, size = 'md' }: TravelerAvatarsProps) {
  const dimension = size === 'md' ? 'h-7 w-7 text-[11px]' : 'h-[22px] w-[22px] text-[9.5px]';

  return (
    <div className="flex">
      {travelers.map((traveler, index) => (
        <span
          key={`${traveler.initials}-${index}`}
          className={`-ml-2 flex items-center justify-center rounded-full border-2 border-white font-display font-bold text-white first:ml-0 ${dimension} ${traveler.colorClass}`}
        >
          {traveler.initials}
        </span>
      ))}
      {extraCount > 0 && (
        <span
          className={`-ml-2 flex items-center justify-center rounded-full border-2 border-white bg-ink-soft font-display font-bold text-white ${dimension}`}
        >
          +{extraCount}
        </span>
      )}
    </div>
  );
}
