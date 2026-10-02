import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IconButton, MenuItem, Snackbar, TextField, Tooltip } from '@mui/material';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ChildCareRoundedIcon from '@mui/icons-material/ChildCareRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { Traveler } from '../../../types';
import { getInitials } from '../../../utils/formatters';
import { isSubmitEnter } from '../../../utils/keyboard';

const AVATAR_COLORS = ['bg-ocean', 'bg-coral', 'bg-mint', 'bg-violet', 'bg-amber-dark', 'bg-navy'];

interface TravelerManagerProps {
  value: Traveler[];
  onChange: (next: Traveler[]) => void;
  // Thành viên đã xuất hiện trong ít nhất một khoản chi — không cho xoá, vì xoá
  // là làm hỏng lịch sử chi tiêu một cách âm thầm (trip-budget.md S9).
  lockedIds?: string[];
  // Tài khoản đang đăng nhập — để gắn "Là tôi" cho đúng một thành viên.
  currentUserId?: string;
  // Chỉ chủ trip mới xoá được thành viên (xoá người đã gắn tài khoản là thu hồi
  // quyền xem của họ). Thành viên khác vẫn thêm / đổi tên được.
  canRemoveMembers?: boolean;
}

// Thành viên "local": chỉ cần một cái tên, không cần tài khoản. Sau này mời
// được user thật thì chỉ gắn thêm `userId` vào bản ghi đã có, lịch sử chi tiêu
// giữ nguyên (trip-budget.md D4).
export function TravelerManager({
  value,
  onChange,
  lockedIds = [],
  currentUserId = '',
  canRemoveMembers = true,
}: TravelerManagerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const adults = value.filter((traveler) => !traveler.isChild && !traveler.leftGroup);
  // Mỗi tài khoản gắn với tối đa một thành viên trong một trip.
  const meLinked = currentUserId !== '' && value.some((traveler) => traveler.userId === currentUserId);

  // Xoá một người lớn đang là "người chi trả" của bé nào đó thì phải gỡ luôn
  // liên kết, nếu không `guardianId` sẽ trỏ vào người không còn tồn tại.
  function withoutTraveler(id: string): Traveler[] {
    return value
      .filter((other) => other.id !== id)
      .map((other) => (other.guardianId === id ? { ...other, guardianId: undefined } : other));
  }

  function orphanedChildrenOf(id: string): Traveler[] {
    return value.filter((other) => other.isChild && other.guardianId === id);
  }

  function patch(id: string, next: Partial<Traveler>): void {
    onChange(value.map((traveler) => (traveler.id === id ? { ...traveler, ...next } : traveler)));
  }

  function add(): void {
    const name = draft.trim();
    if (name === '') {
      return;
    }

    onChange([
      ...value,
      {
        id: crypto.randomUUID(),
        fullName: name,
        initials: getInitials(name),
        colorClass: AVATAR_COLORS[value.length % AVATAR_COLORS.length]!,
      },
    ]);
    setDraft('');
  }

  return (
    <div className="flex flex-col gap-2">
      {value.map((traveler) => {
        const locked = lockedIds.includes(traveler.id);

        return (
          <div
            key={traveler.id}
            className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${
              traveler.leftGroup ? 'border-dashed border-line bg-surface opacity-70' : 'border-line bg-white'
            }`}
          >
            <span
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full font-display text-[11px] font-bold text-white ${traveler.colorClass}`}
            >
              {traveler.initials}
            </span>

            <TextField
              size="small"
              variant="standard"
              value={traveler.fullName ?? ''}
              placeholder={t('itinerary.travelers.namePlaceholder') ?? ''}
              onChange={(event) =>
                patch(traveler.id, {
                  fullName: event.target.value,
                  initials: getInitials(event.target.value || '?'),
                })
              }
              sx={{ minWidth: 120, flex: 1 }}
            />

            {traveler.userId && traveler.userId === currentUserId ? (
              <span className="flex items-center gap-1">
                <span className="rounded-full bg-ocean-tint px-2 py-0.5 text-[11px] font-bold text-ocean-dark">
                  {t('itinerary.travelers.you')}
                </span>
                <button
                  type="button"
                  onClick={() => patch(traveler.id, { userId: undefined })}
                  className="text-[11px] font-semibold text-ink-soft underline-offset-2 hover:underline"
                >
                  {t('itinerary.travelers.unlinkMe')}
                </button>
              </span>
            ) : traveler.userId ? (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                {t('itinerary.travelers.linkedAccount')}
              </span>
            ) : (
              !meLinked &&
              currentUserId !== '' &&
              !traveler.isChild && (
                <Tooltip title={t('itinerary.travelers.thisIsMeHint')}>
                  <button
                    type="button"
                    onClick={() => patch(traveler.id, { userId: currentUserId })}
                    className="rounded-lg border border-line bg-white px-2 py-1 text-[11.5px] font-semibold text-ink-soft transition hover:border-ocean hover:text-ocean-dark"
                  >
                    {t('itinerary.travelers.thisIsMe')}
                  </button>
                </Tooltip>
              )
            )}

            {/* Đã dính khoản chi thì không đổi người lớn ⇄ trẻ em: trẻ không ứng
                tiền, nên đổi một người trả tiền thành trẻ sẽ chuyển số dư của họ
                sang người giám hộ và khoản chi đó không sửa được nữa. */}
            <label
              title={locked ? (t('itinerary.travelers.lockedHint') ?? '') : undefined}
              className={`flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft ${locked ? 'opacity-60' : ''}`}
            >
              <input
                type="checkbox"
                disabled={locked}
                checked={Boolean(traveler.isChild)}
                onChange={(event) =>
                  patch(traveler.id, {
                    isChild: event.target.checked,
                    guardianId: event.target.checked ? traveler.guardianId : undefined,
                  })
                }
              />
              <ChildCareRoundedIcon sx={{ fontSize: 15 }} />
              {t('itinerary.travelers.isChild')}
            </label>

            {traveler.isChild && (
              <TextField
                select
                size="small"
                value={traveler.guardianId ?? ''}
                label={t('itinerary.travelers.guardian')}
                onChange={(event) => patch(traveler.id, { guardianId: event.target.value || undefined })}
                sx={{ minWidth: 170 }}
              >
                <MenuItem value="">{t('itinerary.travelers.guardianShared')}</MenuItem>
                {adults.map((adult) => (
                  <MenuItem key={adult.id} value={adult.id}>
                    {adult.fullName ?? adult.initials}
                  </MenuItem>
                ))}
              </TextField>
            )}

            {!canRemoveMembers && !locked ? (
              <Tooltip title={t('itinerary.travelers.ownerOnlyRemove')}>
                <span className="flex h-8 w-8 items-center justify-center text-ink-soft/60" aria-label={t('itinerary.travelers.ownerOnlyRemove')}>
                  <LockOutlinedIcon sx={{ fontSize: 16 }} />
                </span>
              </Tooltip>
            ) : locked ? (
              // Đã có chi tiêu thì không xoá được — nhưng vẫn phải có đường ra
              // cho người đã rời nhóm giữa chuyến (S9).
              <Tooltip title={t('itinerary.travelers.lockedHint')}>
                <button
                  type="button"
                  onClick={() => patch(traveler.id, { leftGroup: !traveler.leftGroup })}
                  className={`rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition ${
                    traveler.leftGroup
                      ? 'border-line bg-surface text-ink-soft'
                      : 'border-line bg-white text-ink-soft hover:border-ocean hover:text-ocean-dark'
                  }`}
                >
                  {traveler.leftGroup
                    ? t('itinerary.travelers.rejoin')
                    : t('itinerary.travelers.leave')}
                </button>
              </Tooltip>
            ) : (
              <IconButton
                size="small"
                aria-label={t('itinerary.travelers.remove')}
                onClick={() => {
                  const orphans = orphanedChildrenOf(traveler.id);
                  onChange(withoutTraveler(traveler.id));
                  if (orphans.length > 0) {
                    setNotice(
                      t('itinerary.travelers.guardianCleared', {
                        names: orphans.map((child) => child.fullName ?? child.initials).join(', '),
                      }),
                    );
                  }
                }}
              >
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <TextField
          size="small"
          value={draft}
          placeholder={t('itinerary.travelers.addPlaceholder') ?? ''}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (isSubmitEnter(event)) {
              event.preventDefault();
              add();
            }
          }}
          sx={{ flex: 1 }}
        />
        <button
          type="button"
          onClick={add}
          disabled={draft.trim() === ''}
          className="rounded-xl border border-ocean bg-white px-3 py-2 text-[13px] font-semibold text-ocean-dark transition disabled:cursor-not-allowed disabled:border-line disabled:text-ink-soft"
        >
          ＋ {t('itinerary.travelers.add')}
        </button>
      </div>

      <p className="m-0 text-[12px] text-ink-soft">{t('itinerary.travelers.hint')}</p>

      <Snackbar
        open={notice !== null}
        autoHideDuration={6000}
        onClose={() => setNotice(null)}
        message={notice ?? ''}
      />
    </div>
  );
}
