import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuItem } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import type { ItineraryDay } from '../../../types';
import { formatDateWithWeekday } from '../../../utils/dateFormat';

interface AddToDayPopoverProps {
  days: ItineraryDay[];
  onPick: (dayId: string | null) => void;
}

// Đường "thêm bằng click" — bắt buộc phải có vì kéo thả không chạy dưới
// breakpoint lg (trip-board.md §9). `null` nghĩa là khu "Chưa xếp ngày".
export function AddToDayPopover({ days, onPick }: AddToDayPopoverProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function open(event: MouseEvent<HTMLButtonElement>): void {
    event.stopPropagation();
    setAnchor(event.currentTarget);
  }

  // Menu của MUI nằm trong portal nhưng vẫn bubble theo cây React, nên nếu
  // không chặn thì click chọn ngày sẽ kích hoạt onClick của cả hàng place và
  // panel nhảy sang màn chi tiết địa điểm.
  function pick(event: MouseEvent<HTMLLIElement>, dayId: string | null): void {
    event.stopPropagation();
    setAnchor(null);
    onPick(dayId);
  }

  return (
    <>
      <button
        type="button"
        aria-label={t('itinerary.picker.addTo') ?? 'add'}
        onClick={open}
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-line text-ink-soft transition hover:border-ocean hover:bg-ocean-tint hover:text-ocean-dark"
      >
        <AddRoundedIcon sx={{ fontSize: 16 }} />
      </button>

      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        onClick={(event) => event.stopPropagation()}
      >
        {days.map((day, index) => (
          <MenuItem key={day.id} onClick={(event) => pick(event, day.id)} sx={{ fontSize: 13.5 }}>
            {t('itinerary.day.label', { index: index + 1 })} · {formatDateWithWeekday(day.date)}
          </MenuItem>
        ))}
        <MenuItem onClick={(event) => pick(event, null)} sx={{ fontSize: 13.5 }}>
          {t('itinerary.detail.unscheduledTitle')}
        </MenuItem>
      </Menu>
    </>
  );
}
