import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Badge,
  Divider,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import BookmarkRoundedIcon from '@mui/icons-material/BookmarkRounded';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleSidebar, setSearchQuery } from '../store/slices/uiSlice';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useSavedPlaces } from '../features/places/hooks/useSavedPlaces';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { getInitials } from '../utils/formatters';
import { hexToRgba, palette } from '../theme/palette';

const SIDEBAR_WIDTH = 248;

interface NavItemConfig {
  labelKey: string;
  icon: ReactNode;
  path?: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  { labelKey: 'nav.dashboard', icon: <DashboardRoundedIcon fontSize="small" />, path: '/dashboard' },
  { labelKey: 'nav.itinerary', icon: <CalendarMonthRoundedIcon fontSize="small" /> },
  { labelKey: 'nav.discover', icon: <ExploreRoundedIcon fontSize="small" />, path: '/discover' },
  { labelKey: 'nav.settlement', icon: <PaidRoundedIcon fontSize="small" /> },
  { labelKey: 'nav.settings', icon: <SettingsRoundedIcon fontSize="small" /> },
];

export default function DashboardLayout() {
  const dispatch = useAppDispatch();
  const isSidebarOpen = useAppSelector((state) => state.ui.isSidebarOpen);
  const searchQuery = useAppSelector((state) => state.ui.searchQuery);
  const { user, logout } = useAuth();
  const { count: savedPlacesCount } = useSavedPlaces(user?.id ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const isMenuOpen = Boolean(menuAnchor);

  const searchPlaceholderKey = location.pathname === '/discover' ? 'discover.searchPlaceholder' : 'nav.searchPlaceholder';

  // Clears the shared search-query slice on route change so it doesn't leak between pages.
  useEffect(() => {
    dispatch(setSearchQuery(''));
  }, [location.pathname, dispatch]);

  const handleLogout = (): void => {
    setMenuAnchor(null);
    logout();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <div style={{ width: SIDEBAR_WIDTH }} className="flex h-full flex-col bg-navy px-5 py-7">
      <div className="mb-9 flex items-center gap-2.5">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-coral text-lg text-white">
          ✈
        </div>
        <span className="font-display text-lg font-bold text-white">WanderPlan</span>
      </div>

      <List className="flex flex-col gap-1 p-0">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === location.pathname;

          return (
            <ListItemButton
              key={item.labelKey}
              disabled={!item.path}
              onClick={() => item.path && navigate(item.path)}
              title={!item.path ? (t('nav.comingSoon') as string) : undefined}
              sx={{
                borderRadius: 2.5,
                color: isActive ? palette.amber : palette.navySoft,
                backgroundColor: isActive ? hexToRgba(palette.amber, 0.16) : 'transparent',
                '&:hover': {
                  backgroundColor: isActive ? hexToRgba(palette.amber, 0.16) : hexToRgba(palette.white, 0.08),
                },
                '&.Mui-disabled': { color: palette.navyMuted, opacity: 1 },
              }}
            >
              <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                slotProps={{ primary: { sx: { fontWeight: 500, fontSize: 14 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <button
        type="button"
        disabled
        title={t('nav.comingSoon') as string}
        className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-semibold text-white transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-90"
      >
        ＋ {t('nav.newTrip')}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <Drawer
        variant={isDesktop ? 'persistent' : 'temporary'}
        open={isSidebarOpen}
        onClose={() => dispatch(toggleSidebar())}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { border: 'none' } } }}
      >
        {sidebarContent}
      </Drawer>

      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin-left] duration-300 ease-in-out"
        style={{ marginLeft: isDesktop && isSidebarOpen ? SIDEBAR_WIDTH : 0 }}
      >
        <AppBar position="sticky">
          <Toolbar className="flex justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <IconButton
                onClick={() => dispatch(toggleSidebar())}
                edge="start"
                aria-label="Toggle sidebar"
                className="flex-shrink-0"
              >
                <MenuIcon />
              </IconButton>

              <TextField
                size="small"
                placeholder={t(searchPlaceholderKey) ?? ''}
                value={searchQuery}
                onChange={(event) => dispatch(setSearchQuery(event.target.value))}
                className="min-w-0 flex-1 sm:w-[300px] sm:flex-none"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '11px',
                    backgroundColor: palette.white,
                    fontSize: '13.5px',
                  },
                  '& .Mui-disabled': {
                    WebkitTextFillColor: palette.ink,
                  },
                }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchRoundedIcon fontSize="small" className="text-ink-soft" />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label={t('common.close') as string}
                          onClick={() => dispatch(setSearchQuery(''))}
                        >
                          <ClearRoundedIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </div>

            <div className="flex flex-shrink-0 items-center gap-1">
              <IconButton
                onClick={() => navigate('/discover?saved=true')}
                aria-label={t('nav.savedPlaces') as string}
                title={t('nav.savedPlaces') as string}
              >
                <Badge badgeContent={savedPlacesCount} color="secondary" max={99}>
                  <BookmarkRoundedIcon />
                </Badge>
              </IconButton>

              <LanguageSwitcher />

              <IconButton
                onClick={(event: MouseEvent<HTMLElement>) => setMenuAnchor(event.currentTarget)}
                aria-label={t('nav.accountMenu') as string}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
              >
                <Avatar
                  sx={{
                    width: 38,
                    height: 38,
                    bgcolor: 'primary.main',
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: '"Space Grotesk", sans-serif',
                  }}
                >
                  {getInitials(user?.fullName ?? '?')}
                </Avatar>
              </IconButton>
            </div>

            <Menu anchorEl={menuAnchor} open={isMenuOpen} onClose={() => setMenuAnchor(null)}>
              <div className="px-4 py-2">
                <Typography variant="body2" className="font-semibold">
                  {user?.fullName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </div>
              <Divider />
              <MenuItem onClick={handleLogout} className="gap-2">
                <LogoutRoundedIcon fontSize="small" />
                {t('nav.logout')}
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <main className="flex-1 bg-surface p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
