import { Button, Chip, IconButton, Tooltip } from '@mui/material';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import BookmarkBorderRoundedIcon from '@mui/icons-material/BookmarkBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { useTranslation } from 'react-i18next';
import type { Place } from '../../../types';
import { formatCurrencyJPY } from '../../../utils/formatters';
import { resolvePlaceImages } from '../utils';
import { PlaceImageCarousel } from './PlaceImageCarousel';

interface PlaceDetailPanelProps {
  place: Place;
  saved: boolean;
  isOwnCustom: boolean;
  canModify: boolean;
  wishlistPending?: boolean;
  onToggleSaved: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
  // Called instead of onEdit/onDelete/onToggleVisibility when blocked — the
  // icon stays clickable (not `disabled`) so it still gives feedback.
  onGuardedAction: () => void;
}

export function PlaceDetailPanel({
  place,
  saved,
  isOwnCustom,
  canModify,
  wishlistPending = false,
  onToggleSaved,
  onEdit,
  onDelete,
  onToggleVisibility,
  onGuardedAction,
}: PlaceDetailPanelProps) {
  const { t } = useTranslation();
  const canToggleVisibility = place.isPublic ? canModify : true;

  function handleEditClick(): void {
    if (canModify) onEdit();
    else onGuardedAction();
  }

  function handleDeleteClick(): void {
    if (canModify) onDelete();
    else onGuardedAction();
  }

  function handleVisibilityClick(): void {
    if (canToggleVisibility) onToggleVisibility();
    else onGuardedAction();
  }

  return (
    // `lg:min-h-full` stretches this to match the grid cell's height —
    // a block element otherwise shrink-wraps to its own content.
    <div className="overflow-hidden rounded-2xl border border-line bg-white lg:min-h-full">
      <PlaceImageCarousel images={resolvePlaceImages(place)} alt={place.title} resetKey={place.id} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="m-0 font-display text-xl font-bold text-ink">{place.title}</h2>
            <p className="m-0 mt-1 flex items-center gap-1 text-sm text-ink-soft">
              <PlaceRoundedIcon sx={{ fontSize: 16 }} />
              {place.region}
              {place.country ? `, ${place.country}` : ''}
            </p>
          </div>

          {/* Right corner, level with the title — action icons (own custom
              place only) stacked above the save button. */}
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            {isOwnCustom && (
              <div className="flex items-center gap-1">
                <Tooltip title={t('discover.edit')}>
                  <IconButton
                    size="small"
                    onClick={handleEditClick}
                    aria-label={t('discover.edit') as string}
                    sx={{ opacity: canModify ? 1 : 0.45 }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t(place.isPublic ? 'discover.makePrivate' : 'discover.makePublic')}>
                  <IconButton
                    size="small"
                    onClick={handleVisibilityClick}
                    aria-label={t(place.isPublic ? 'discover.makePrivate' : 'discover.makePublic') as string}
                    sx={{ opacity: canToggleVisibility ? 1 : 0.45 }}
                  >
                    {place.isPublic ? <PublicRoundedIcon fontSize="small" /> : <LockRoundedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
                <Tooltip title={t('discover.delete')}>
                  <IconButton
                    size="small"
                    onClick={handleDeleteClick}
                    aria-label={t('discover.delete') as string}
                    sx={{ opacity: canModify ? 1 : 0.45 }}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </div>
            )}

            <Button
              variant={saved ? 'outlined' : 'contained'}
              color={saved ? 'inherit' : 'secondary'}
              size="small"
              disabled={wishlistPending}
              startIcon={saved ? <BookmarkRoundedIcon /> : <BookmarkBorderRoundedIcon />}
              onClick={onToggleSaved}
            >
              {saved ? t('discover.removeFromWishlist') : t('discover.addToWishlist')}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          {typeof place.rating === 'number' ? (
            <span className="flex items-center gap-0.5 font-semibold text-amber-dark">
              <StarRoundedIcon sx={{ fontSize: 18 }} />
              {place.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-ink-soft">{t('discover.ratingNotYet')}</span>
          )}
          <span className="font-mono font-semibold text-ink">
            {place.price ? formatCurrencyJPY(place.price) : t('discover.priceFree')}
          </span>
          {place.category && <Chip size="small" label={t(`discover.category.${place.category}`)} />}
          {isOwnCustom && (
            <Chip
              size="small"
              icon={place.isPublic ? <PublicRoundedIcon /> : <LockRoundedIcon />}
              label={t(place.isPublic ? 'discover.public' : 'discover.private')}
              variant="outlined"
            />
          )}
        </div>

        <p className="m-0 mt-3 flex items-start gap-1 text-sm text-ink-soft">
          <PlaceRoundedIcon sx={{ fontSize: 16, flexShrink: 0, marginTop: '2px' }} />
          <span>{place.address}</span>
        </p>

        {place.description && (
          <div className="mt-4 border-t border-line pt-4">
            <h3 className="m-0 mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-soft">
              {t('discover.descriptionLabel')}
            </h3>
            <p className="m-0 text-sm leading-relaxed text-ink">{place.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
