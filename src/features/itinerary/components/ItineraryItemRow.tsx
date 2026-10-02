import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, ListSubheader, Menu, MenuItem, Tooltip } from '@mui/material';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import type { ItineraryItem, Place } from '../../../types';
import { CATEGORY_COLOR_CLASSES, itemCategory } from '../utils/categoryColors';
import { formatPlacePrice } from '../../../utils/formatters';

// Đích "chuyển sang ngày…": id ngày, hoặc null = "Chưa xếp ngày".
export interface MoveTarget {
  id: string | null;
  label: string;
}

interface ItineraryItemRowProps {
  item: ItineraryItem;
  place: Place | undefined;
  placesById: Map<string, Place>;
  dayId: string | null;
  editable: boolean;
  variant: 'list' | 'axis';
  active?: boolean;
  // Bước 2 không hiển thị giờ — giờ chỉ xuất hiện từ Bước 3 (R4).
  hideTime?: boolean;
  // R4: khoá kéo trong ngày đã gán giờ, vì thứ tự lúc đó do Bước 3 quyết định.
  dragLocked?: boolean;
  // Chế độ xem: in memo ra ngay bên phải mục, không bắt phải bấm vào mới thấy.
  showNote?: boolean;
  onClick?: () => void;
  onTimeChange?: (field: 'startTime' | 'endTime', value: string) => void;
  onRemove?: () => void;
  // Đường thay thế cho kéo thả — dùng được trên điện thoại và bằng bàn phím.
  moveTargets?: MoveTarget[];
  onMove?: (dayId: string | null) => void;
}

export function ItineraryItemRow({
  item,
  place,
  placesById,
  dayId,
  editable,
  variant,
  active = false,
  hideTime = false,
  dragLocked = false,
  showNote = false,
  onClick,
  onTimeChange,
  onRemove,
  moveTargets = [],
  onMove,
}: ItineraryItemRowProps) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `item-${item.id}`,
    data: { type: 'item', dayId, itemId: item.id },
    disabled: !editable || dragLocked,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `itemdrop-${item.id}`,
    data: { type: 'item', dayId, itemId: item.id },
  });

  function setRefs(node: HTMLDivElement | null): void {
    setDragRef(node);
    setDropRef(node);
  }

  // Một item place mà không tìm thấy Place (đã bị xoá, hoặc là place riêng tư
  // của người khác) vẫn phải render được — nếu không người dùng có một mục vô
  // hình nhưng vẫn được đếm và không thể gỡ ra.
  const missingPlace = item.kind === 'place' && !place;

  const title = missingPlace
    ? t('itinerary.item.missingPlace')
    : item.kind === 'activity'
      ? (item.title ?? t('itinerary.item.untitledActivity'))
      : (place?.title ?? '');

  // Hoạt động tự do có category riêng do người dùng chọn — dùng chung
  // itemCategory() để màu và bộ lọc luôn nói cùng một chuyện (R7).
  const category = itemCategory(item, placesById);
  const colors = CATEGORY_COLOR_CLASSES[category];
  const note = item.note?.trim() ?? '';
  const noteShown = showNote && note !== '';

  // Memo đã có khối riêng thì dòng phụ của hoạt động tự do đổi sang loại hoạt
  // động — in memo hai lần là nhiễu.
  const subtitle = missingPlace
    ? t('itinerary.item.missingPlaceHint')
    : item.kind === 'activity'
      ? noteShown
        ? t(`discover.category.${category}`)
        : note
      : `${place?.region ?? ''}${place?.price ? ` · ${formatPlacePrice(place)}` : ''}`;

  const hasTime = item.startTime !== null && item.endTime !== null;

  return (
    <div
      ref={setRefs}
      onClick={onClick}
      // Dòng bấm được thì phải với tới được bằng bàn phím (Enter / Space).
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event: KeyboardEvent<HTMLDivElement>) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`relative flex items-center gap-2 rounded-xl border bg-white p-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ocean sm:gap-3 ${
        missingPlace ? 'border-coral bg-coral-tint/40' : active ? 'border-ocean bg-ocean-tint' : 'border-line'
      } ${isDragging ? 'opacity-30' : ''} ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Thả lên một hàng nghĩa là "chèn ngay sau hàng này" — vẽ hẳn một vạch
          ở mép dưới để người dùng thấy chính xác vị trí sẽ chèn. */}
      {isOver && (
        <span className="pointer-events-none absolute inset-x-2 -bottom-[5px] z-10 flex items-center">
          <span className="h-[3px] flex-1 rounded-full bg-ocean" />
          <span className="h-2 w-2 rounded-full bg-ocean" />
        </span>
      )}

      {hideTime ? null : variant === 'axis' ? (
        <div className="flex w-[52px] flex-shrink-0 flex-col items-center font-mono text-[11px] text-ink-soft">
          {hasTime ? (
            <>
              <span>{item.startTime}</span>
              <span className="my-0.5 h-3 w-px bg-line" />
              <span>{item.endTime}</span>
            </>
          ) : (
            <span className="text-[10px] leading-tight">{t('itinerary.item.noTime')}</span>
          )}
        </div>
      ) : editable ? (
        <div className="flex flex-shrink-0 flex-col items-center gap-1 font-mono text-[11px]">
          <input
            type="time"
            value={item.startTime ?? ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onTimeChange?.('startTime', event.target.value)}
            className="w-[74px] rounded-md border border-line px-1 py-0.5 text-center text-[11px]"
          />
          <input
            type="time"
            value={item.endTime ?? ''}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => onTimeChange?.('endTime', event.target.value)}
            className="w-[74px] rounded-md border border-line px-1 py-0.5 text-center text-[11px]"
          />
        </div>
      ) : (
        <div className="flex w-[74px] flex-shrink-0 flex-col items-center font-mono text-[11px] text-ink-soft">
          {hasTime ? (
            <>
              <span>{item.startTime}</span>
              <span>{item.endTime}</span>
            </>
          ) : (
            <span className="text-[10px]">{t('itinerary.item.noTime')}</span>
          )}
        </div>
      )}

      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${colors.dot}`} />

      {missingPlace ? (
        <span className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-coral-tint text-coral-dark sm:flex">
          <ErrorOutlineRoundedIcon fontSize="small" />
        </span>
      ) : item.kind === 'activity' ? (
        <span className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-surface text-ink-soft sm:flex">
          <EventNoteRoundedIcon fontSize="small" />
        </span>
      ) : (
        <img src={place!.coverUrl} alt="" className="hidden h-10 w-10 flex-shrink-0 rounded-lg object-cover sm:block" />
      )}

      <div className="min-w-0 flex-1">
        {/* Màn hẹp: cho tên xuống 2 dòng thay vì cắt còn vài chữ. */}
        <p
          className={`m-0 line-clamp-2 break-words text-[13.5px] font-semibold leading-snug sm:line-clamp-1 sm:truncate ${
            missingPlace ? 'text-coral-dark' : 'text-ink'
          }`}
        >
          {title}
        </p>
        {subtitle && <p className="m-0 truncate text-[11.5px] text-ink-soft">{subtitle}</p>}
        {noteShown && (
          <p className="m-0 mt-1 line-clamp-2 rounded-md bg-amber-tint/70 px-1.5 py-0.5 text-[11.5px] leading-snug text-ink sm:hidden">
            {note}
          </p>
        )}
      </div>

      {noteShown && (
        <Tooltip title={<span className="whitespace-pre-wrap">{note}</span>} placement="top-end" arrow>
          <div className="hidden w-[38%] max-w-[260px] flex-shrink-0 items-start gap-1.5 self-center rounded-lg border border-amber/50 bg-amber-tint/60 px-2 py-1.5 sm:flex">
            <StickyNote2OutlinedIcon sx={{ fontSize: 14 }} className="mt-px flex-shrink-0 text-amber-dark" />
            <p className="m-0 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-snug text-ink">{note}</p>
          </div>
        </Tooltip>
      )}

      {editable && (
        <>
          {/* Tay nắm kéo: chỉ từ sm trở lên — trên điện thoại dùng menu "Chuyển
              sang ngày…" (kéo bằng ngón tay dễ lẫn với cuộn trang). */}
          <Tooltip
            title={dragLocked ? t('itinerary.step2.dragLockedHint') : ''}
            disableHoverListener={!dragLocked}
            placement="left"
            arrow
          >
            <span
              {...(dragLocked ? {} : listeners)}
              {...(dragLocked ? {} : attributes)}
              aria-label={t('itinerary.item.dragHandle', { title })}
              onClick={(event) => event.stopPropagation()}
              className={`hidden flex-shrink-0 touch-none sm:inline-flex ${
                dragLocked ? 'cursor-not-allowed text-line' : 'cursor-grab text-ink-soft active:cursor-grabbing'
              }`}
            >
              <DragIndicatorRoundedIcon fontSize="small" />
            </span>
          </Tooltip>

          {/* Màn hẹp: hai nút xếp dọc để nhường chiều ngang cho tên mục. */}
          <div className="flex flex-shrink-0 flex-col items-center sm:flex-row">
            {onMove && moveTargets.length > 0 && (
              <IconButton
                size="small"
                aria-label={t('itinerary.item.actions', { title })}
                aria-haspopup="menu"
                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                  event.stopPropagation();
                  setMenuAnchor(event.currentTarget);
                }}
                sx={{ flexShrink: 0, width: 36, height: 36 }}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
            )}

            <IconButton
              size="small"
              aria-label={t('itinerary.item.remove', { title })}
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onRemove?.();
              }}
              sx={{ flexShrink: 0, width: 36, height: 36, '&:hover': { color: 'error.main' } }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </div>

          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            // Menu ở portal vẫn bubble theo cây React — đừng để click lọt lên dòng.
            onClick={(event) => event.stopPropagation()}
          >
            <ListSubheader sx={{ lineHeight: '32px', fontSize: 12 }}>{t('itinerary.item.moveTo')}</ListSubheader>
            {moveTargets.map((target) => (
              <MenuItem
                key={target.id ?? 'unscheduled'}
                sx={{ fontSize: 13.5 }}
                onClick={() => {
                  setMenuAnchor(null);
                  onMove?.(target.id);
                }}
              >
                {target.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </div>
  );
}
