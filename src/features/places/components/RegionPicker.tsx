import { useEffect, useMemo, useState } from 'react';
import { Autocomplete, CircularProgress, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Region } from '../../../types';
import { createRegion, searchRegions } from '../api/regionApi';
import { useDebounce } from '../hooks/useDebounce';

interface RegionPickerProps {
  value: string;
  onChange: (regionName: string) => void;
  currentUserId: string;
  error?: boolean;
  helperText?: string;
}

const CREATE_NEW_OPTION = '__create_new_region__';

// See docs/features/place-search.md's "Region search".
export function RegionPicker({ value, onChange, currentUserId, error, helperText }: RegionPickerProps) {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value);
  const debouncedInput = useDebounce(inputValue, 300);
  const [options, setOptions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentUserId) return undefined;

    let cancelled = false;
    setLoading(true);

    searchRegions(debouncedInput, currentUserId)
      .then((regions) => {
        if (!cancelled) setOptions(regions);
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
  }, [debouncedInput, currentUserId]);

  const trimmedInput = inputValue.trim();
  const hasExactMatch = options.some((region) => region.name.toLowerCase() === trimmedInput.toLowerCase());
  const optionLabels = useMemo(() => options.map((region) => region.name), [options]);
  const listOptions = trimmedInput && !hasExactMatch ? [...optionLabels, CREATE_NEW_OPTION] : optionLabels;

  async function handleChange(newValue: string | null): Promise<void> {
    if (!newValue) {
      onChange('');
      return;
    }

    if (newValue === CREATE_NEW_OPTION) {
      setCreating(true);
      try {
        const created = await createRegion(trimmedInput, currentUserId);
        setInputValue(created.name);
        onChange(created.name);
      } finally {
        setCreating(false);
      }
      return;
    }

    onChange(newValue);
  }

  return (
    <Autocomplete
      freeSolo
      options={listOptions}
      value={value || null}
      inputValue={inputValue}
      loading={loading || creating}
      onInputChange={(_, newInput) => setInputValue(newInput)}
      onChange={(_, newValue) => void handleChange(newValue)}
      getOptionLabel={(option) => (option === CREATE_NEW_OPTION ? '' : option)}
      renderOption={(props, option) => (
        <li {...props} key={option}>
          {option === CREATE_NEW_OPTION ? t('discover.form.createRegionOption', { name: trimmedInput }) : option}
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          required
          label={t('discover.form.regionLabel')}
          placeholder={t('discover.form.regionPlaceholder') ?? ''}
          error={error}
          helperText={helperText}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading || creating ? <CircularProgress color="inherit" size={16} /> : null}
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
