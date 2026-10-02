import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Autocomplete, Chip, CircularProgress, TextField } from '@mui/material';
import type { Region, TripRegion } from '../../../types';
import { searchRegions } from '../../places/api/regionApi';
import { useDebounce } from '../../places/hooks/useDebounce';
import { palette } from '../../../theme/palette';

interface RegionMultiSelectProps {
  value: TripRegion[];
  onChange: (regions: TripRegion[]) => void;
  currentUserId: string;
  // id của nhãn bên ngoài (Bước 1) — để trình đọc màn hình đọc đúng tên ô.
  labelledBy?: string;
  error?: boolean;
  helperText?: string;
}

function toTripRegion(region: Region): TripRegion {
  return { id: region.id, name: region.name, country: region.country };
}

// Một chuyến đi có thể qua nhiều thành phố. Danh sách này cũng là bộ lọc mặc
// định cho tab "Tất cả địa điểm" ở Bước 2 (trip-board.md R8).
export function RegionMultiSelect({
  value,
  onChange,
  currentUserId,
  labelledBy,
  error = false,
  helperText,
}: RegionMultiSelectProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [options, setOptions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUserId) return;

    let cancelled = false;
    setLoading(true);

    searchRegions(debouncedQuery, currentUserId)
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, currentUserId]);

  // Autocomplete so sánh bằng tham chiếu nếu không có isOptionEqualToValue —
  // map value sang chính object trong options để chip hiển thị đúng.
  const selected = useMemo(
    () => value.map((region) => ({ ...region, source: 'catalog' as const })),
    [value],
  );

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      value={selected}
      loading={loading}
      filterSelectedOptions
      // Việc lọc đã làm ở searchRegions (khớp cả alias tiếng Nhật). Bộ lọc mặc
      // định của Autocomplete so khớp theo getOptionLabel = tên latin, nên gõ
      // "京都" sẽ bị nó loại sạch kết quả API vừa trả về.
      filterOptions={(options) => options}
      noOptionsText={t('itinerary.stepOne.cityNoResults')}
      getOptionLabel={(option) => option.name}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      onInputChange={(_, next) => setQuery(next)}
      onChange={(_, next) => onChange(next.map(toTripRegion))}
      renderOption={(props, option) => {
        const { key, ...rest } = props as typeof props & { key: string };
        return (
          <li key={key} {...rest}>
            <span className="text-[13.5px] font-semibold text-ink">{option.name}</span>
            {option.aliases && option.aliases.length > 0 && (
              <span className="ml-2 text-[12px] text-ink-soft">{option.aliases.join(' / ')}</span>
            )}
            {option.country && <span className="ml-2 text-[11.5px] text-ink-soft">{option.country}</span>}
          </li>
        );
      }}
      renderValue={(selectedRegions, getItemProps) =>
        selectedRegions.map((option, index) => {
          const { key, ...rest } = getItemProps({ index });
          return (
            <Chip
              key={key}
              {...rest}
              size="small"
              label={option.name}
              sx={{
                backgroundColor: palette.oceanTint,
                color: palette.oceanDark,
                border: `1px solid ${palette.ocean}`,
                fontWeight: 700,
                '& .MuiChip-deleteIcon': { color: palette.oceanDark },
              }}
            />
          );
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          error={error}
          helperText={helperText}
          placeholder={value.length === 0 ? (t('itinerary.stepOne.citySearchPlaceholder') ?? '') : ''}
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, 'aria-labelledby': labelledBy },
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={16} />}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
