import type { Traveler } from '../types';

interface TravelerAvatarsProps {
  travelers: Traveler[];
  size?: 'sm' | 'md';
}

// Chỉ vẽ các thành viên cùng lên lịch trình. Số người thực tế của chuyến đi
// nằm ở `trip.party` và được hiển thị riêng dưới dạng chữ.
export function TravelerAvatars({ travelers, size = 'md' }: TravelerAvatarsProps) {
  const dimension = size === 'md' ? 'h-7 w-7 text-[11px]' : 'h-[22px] w-[22px] text-[9.5px]';

  if (travelers.length === 0) {
    return null;
  }

  return (
    <div className="flex">
      {travelers.map((traveler) => (
        <span
          key={traveler.id}
          title={traveler.fullName}
          className={`-ml-2 flex items-center justify-center rounded-full border-2 border-white font-display font-bold text-white first:ml-0 ${dimension} ${traveler.colorClass}`}
        >
          {traveler.initials}
        </span>
      ))}
    </div>
  );
}
