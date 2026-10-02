import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MenuItem, TextField } from '@mui/material';
import { CATEGORY_KEYS, type CategoryKey } from '../../places/utils';
import { CATEGORY_COLOR_CLASSES } from '../utils/categoryColors';
import { isSubmitEnter } from '../../../utils/keyboard';

export interface ActivityInput {
  title: string;
  note?: string;
  category: CategoryKey;
}

interface AddActivityFormProps {
  onSubmit: (input: ActivityInput) => void;
}

// Hoạt động tự do: item không gắn với Place nào (kind: 'activity') — di chuyển,
// nghỉ ngơi, ăn tối tuỳ chọn... Chi phí dự trù gom hết về Bước 4 nên không nhập
// ở đây (trip-board.md R7).
export function AddActivityForm({ onSubmit }: AddActivityFormProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<CategoryKey>('other');

  function reset(): void {
    setTitle('');
    setNote('');
    setCategory('other');
    setOpen(false);
  }

  function submit(): void {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }

    onSubmit({ title: trimmed, note: note.trim() || undefined, category });
    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[40px] rounded-xl border border-dashed border-line text-[12.5px] font-semibold text-ink-soft transition hover:border-ocean hover:text-ocean-dark"
      >
        ＋ {t('itinerary.step2.addActivity')}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-ocean bg-ocean-tint/40 p-3">
      <TextField
        autoFocus
        size="small"
        value={title}
        placeholder={t('itinerary.step2.activityTitlePlaceholder') ?? ''}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (isSubmitEnter(event)) submit();
          if (event.key === 'Escape') reset();
        }}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
        <TextField
          size="small"
          value={note}
          placeholder={t('itinerary.step2.activityNotePlaceholder') ?? ''}
          onChange={(event) => setNote(event.target.value)}
        />
        <TextField
          select
          size="small"
          value={category}
          label={t('itinerary.step2.activityType')}
          onChange={(event) => setCategory(event.target.value as CategoryKey)}
        >
          {CATEGORY_KEYS.map((key) => (
            <MenuItem key={key} value={key} sx={{ fontSize: 13.5, gap: 1 }}>
              <span className={`h-2 w-2 rounded-full ${CATEGORY_COLOR_CLASSES[key].dot}`} />
              {t(`discover.category.${key}`)}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink"
        >
          {t('itinerary.detail.cancel')}
        </button>
        <button
          type="button"
          disabled={!title.trim()}
          onClick={submit}
          className="rounded-lg bg-ocean px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {t('itinerary.step2.addActivitySubmit')}
        </button>
      </div>
    </div>
  );
}
