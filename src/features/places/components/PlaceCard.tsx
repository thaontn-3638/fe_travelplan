import type { KeyboardEvent } from 'react';
import { IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import type { Place } from '../../../types';
import { formatCurrencyJPY } from '../../../utils/formatters';
import { palette } from '../../../theme/palette';

interface PlaceCardProps {
  place: Place;
  saved?: boolean;
  selected?: boolean;
  savePending?: boolean;
  onClick?: () => void;
  onToggleSave?: () => void;
}

// A <div role="button">, not a <button> — the save toggle is a real nested
// <button>, and a <button> can't contain another interactive button.
export function PlaceCard({ place, saved = false, selected = false, savePending = false, onClick, onToggleSave }: PlaceCardProps) {
  const { t } = useTranslation();
  const isPrivateCustom = place.source === 'custom' && !place.isPublic;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  }

  // No stopPropagation — clicking save should also select the card.
  function handleToggleSaveClick(): void {
    onToggleSave?.();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition ${
        selected
          ? 'border-ocean bg-ocean-tint'
          : 'border-line bg-white hover:-translate-y-0.5 hover:border-ocean-light hover:shadow-[0_14px_28px_-18px_rgba(29,150,194,0.35)]'
      }`}
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-line">
        <img src={place.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate font-display text-[14px] font-bold text-ink">{place.title}</p>
        <p className="m-0 mt-0.5 truncate text-[12px] text-ink-soft">
          {place.region}
          {place.country ? `, ${place.country}` : ''}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[12px]">
          {typeof place.rating === 'number' && (
            <span className="flex items-center gap-0.5 font-semibold text-amber-dark">
              <StarRoundedIcon sx={{ fontSize: 15 }} />
              {place.rating.toFixed(1)}
            </span>
          )}
          <span className="font-mono font-semibold text-ink">
            {place.price ? formatCurrencyJPY(place.price) : t('discover.priceFree')}
          </span>
          {isPrivateCustom && (
            <span className="flex items-center gap-0.5 text-ink-soft" title={t('discover.private') as string}>
              <LockRoundedIcon sx={{ fontSize: 13 }} />
            </span>
          )}
        </div>
      </div>

      <IconButton
        size="small"
        disabled={savePending}
        onClick={handleToggleSaveClick}
        aria-pressed={saved}
        aria-label={t(saved ? 'discover.removeFromWishlist' : 'discover.addToWishlist') as string}
        title={t(saved ? 'discover.removeFromWishlist' : 'discover.addToWishlist') as string}
        className="flex-shrink-0"
        sx={{ color: saved ? palette.amberDark : palette.ink }}
      >
        {saved ? <BookmarkRoundedIcon fontSize="small" /> : <BookmarkBorderRoundedIcon fontSize="small" />}
      </IconButton>
    </div>
  );
}
