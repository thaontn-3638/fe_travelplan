import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, MenuItem } from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { TripStatus } from '../../../types';
import { TRIP_STATUSES } from '../utils/tripBasics';
import { STATUS_DOT_CLASSES, STATUS_TEXT_CLASSES, STATUS_TINT_CLASSES } from '../../../components/tripStatusColors';

interface TripStatusSelectProps {
  status: TripStatus;
  onChange: (status: TripStatus) => void;
  disabled?: boolean;
}

// Đổi trạng thái là thao tác nhẹ và làm thường xuyên — cho sửa ngay tại header
// màn xem, không bắt đi vòng qua wizard (trip-board.md R12).
export function TripStatusSelect({ status, onChange, disabled = false }: TripStatusSelectProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  function open(event: MouseEvent<HTMLButtonElement>): void {
    setAnchor(event.currentTarget);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={open}
        aria-label={t('itinerary.detail.changeStatus') ?? 'status'}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide transition disabled:opacity-60 ${STATUS_TINT_CLASSES[status]} ${STATUS_TEXT_CLASSES[status]}`}
      >
        {t(`dashboard.status.${status}`)}
        <ExpandMoreRoundedIcon sx={{ fontSize: 15 }} />
      </button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {TRIP_STATUSES.map((value) => (
          <MenuItem
            key={value}
            selected={value === status}
            onClick={() => {
              setAnchor(null);
              if (value !== status) onChange(value);
            }}
            sx={{ fontSize: 13.5, gap: 1 }}
          >
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[value]}`} />
            {t(`dashboard.status.${value}`)}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
