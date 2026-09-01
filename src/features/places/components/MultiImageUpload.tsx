import { useRef, useState, type ChangeEvent } from 'react';
import { CircularProgress, IconButton } from '@mui/material';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'react-i18next';

interface MultiImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  error?: boolean;
  helperText?: string;
}

// See docs/features/place-search.md's "Image upload" — json-server's fixed
// 100 KiB request-body cap is why every upload is compressed client-side.
const MAX_DIMENSION = 480; // long edge, px — plenty for a card/detail thumbnail
const MIN_JPEG_QUALITY = 0.35;
const TARGET_DATA_URL_BYTES = 20 * 1024; // per image, after base64 encoding
const SAFE_TOTAL_BUDGET_BYTES = 85 * 1024; // headroom under the 100 KiB request-body cap
const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024; // decode safety, unrelated to the server limit

async function compressImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    // White backing so a transparent PNG doesn't turn black once flattened
    // to JPEG (canvas composites transparent pixels as black by default).
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let quality = 0.72;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    // Step quality down until the encoded size actually lands under budget.
    while (dataUrl.length > TARGET_DATA_URL_BYTES && quality > MIN_JPEG_QUALITY) {
      quality -= 0.12;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
  } finally {
    bitmap.close();
  }
}

// See docs/features/place-search.md's "Image upload" for why this stores a
// base64 data URL rather than a `URL.createObjectURL` blob URL.
export function MultiImageUpload({ value, onChange, error, helperText }: MultiImageUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sourceTooLarge, setSourceTooLarge] = useState(false);
  const [budgetReached, setBudgetReached] = useState(false);
  const [processingFailed, setProcessingFailed] = useState(false);

  async function handleFilesSelected(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const allFiles = Array.from(event.target.files ?? []);
    event.target.value = ''; // reset so picking the same file again still fires onChange

    if (allFiles.length === 0) {
      return;
    }

    setSourceTooLarge(allFiles.some((file) => file.size > MAX_SOURCE_FILE_BYTES));
    setBudgetReached(false);
    setProcessingFailed(false);

    const files = allFiles.filter((file) => file.size <= MAX_SOURCE_FILE_BYTES);
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    const added: string[] = [];
    let runningTotal = value.reduce((sum, url) => sum + url.length, 0);

    try {
      for (const file of files) {
        let dataUrl: string;
        try {
          dataUrl = await compressImageFile(file);
        } catch {
          setProcessingFailed(true);
          continue;
        }

        if (runningTotal + dataUrl.length > SAFE_TOTAL_BUDGET_BYTES) {
          setBudgetReached(true);
          break;
        }

        added.push(dataUrl);
        runningTotal += dataUrl.length;
      }
    } finally {
      setUploading(false);
    }

    if (added.length > 0) {
      onChange([...value, ...added]);
    }
  }

  function handleRemove(index: number): void {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className="m-0 mb-2 text-sm font-medium text-ink">
        {t('discover.form.imagesLabel')} <span className="text-coral">*</span>
      </p>

      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <div key={url} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-line">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <IconButton
              size="small"
              onClick={() => handleRemove(index)}
              aria-label={t('discover.form.removeImage') as string}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                padding: '2px',
                backgroundColor: 'rgba(255,255,255,0.9)',
                '&:hover': { backgroundColor: '#fff' },
              }}
            >
              <CloseRoundedIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-ink-soft transition hover:border-ocean hover:text-ocean disabled:cursor-wait disabled:opacity-60"
        >
          {uploading ? (
            <CircularProgress size={18} />
          ) : (
            <>
              <AddPhotoAlternateRoundedIcon fontSize="small" />
              <span className="text-[10px] font-medium">{t('discover.form.addImage')}</span>
            </>
          )}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFilesSelected} />

      {error && helperText && <p className="m-0 mt-1.5 text-xs text-coral-dark">{helperText}</p>}
      {sourceTooLarge && <p className="m-0 mt-1.5 text-xs text-coral-dark">{t('discover.form.imageTooLarge')}</p>}
      {budgetReached && <p className="m-0 mt-1.5 text-xs text-coral-dark">{t('discover.form.imageBudgetReached')}</p>}
      {processingFailed && <p className="m-0 mt-1.5 text-xs text-coral-dark">{t('discover.form.imageProcessingFailed')}</p>}
    </div>
  );
}
