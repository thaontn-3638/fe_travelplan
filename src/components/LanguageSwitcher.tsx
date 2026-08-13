import { useState, type MouseEvent } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../i18n';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  ja: '日本語',
  vi: 'Tiếng Việt',
};

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleSelect = (language: SupportedLanguage): void => {
    void i18n.changeLanguage(language);
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        onClick={(event: MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)}
        aria-label="Change language"
      >
        <TranslateRoundedIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {SUPPORTED_LANGUAGES.map((language) => {
          const isActive = i18n.language === language;

          return (
            <MenuItem key={language} onClick={() => handleSelect(language)} selected={isActive}>
              {isActive && (
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <CheckRoundedIcon fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={!isActive}>{LANGUAGE_LABELS[language]}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
