import { Navigate, Link as RouterLink } from 'react-router-dom';
import { Avatar, AvatarGroup, Button, Chip, Paper, Typography } from '@mui/material';
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded';
import FlightRoundedIcon from '@mui/icons-material/FlightRounded';
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import PaidRoundedIcon from '@mui/icons-material/PaidRounded';
import ExploreRoundedIcon from '@mui/icons-material/ExploreRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../features/auth/hooks/useAuth';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { TripRouteIllustration } from '../components/illustrations/TripRouteIllustration';

export default function WelcomePage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: <ExploreRoundedIcon sx={{ color: '#4F46E5' }} />,
      bgcolor: '#E0E7FF',
      title: t('welcome.feature1Title'),
      description: t('welcome.feature1Desc'),
    },
    {
      icon: <ViewKanbanRoundedIcon sx={{ color: '#0284C7' }} />,
      bgcolor: '#E0F2FE',
      title: t('welcome.feature2Title'),
      description: t('welcome.feature2Desc'),
    },
    {
      icon: <PaidRoundedIcon sx={{ color: '#B45309' }} />,
      bgcolor: '#FEF3C7',
      title: t('welcome.feature3Title'),
      description: t('welcome.feature3Desc'),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <style>{`
        @keyframes wanderplan-float {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50% { transform: translateY(-12px) rotate(-2deg); }
        }
      `}</style>

      <div
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl"
        style={{ background: '#C7D2FE', opacity: 0.5 }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full blur-3xl"
        style={{ background: '#BAE6FD', opacity: 0.5 }}
      />

      <div className="relative">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-2">
            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
              <FlightTakeoffRoundedIcon fontSize="small" />
            </Avatar>
            <Typography variant="h6" className="font-bold">
              WanderPlan
            </Typography>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button component={RouterLink} to="/login" variant="text">
              {t('auth.signIn')}
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 pb-24 pt-8 sm:pt-12">
          <div className="grid grid-cols-1 items-center gap-16 sm:grid-cols-2">
            <div className="text-center sm:text-left">
              <Typography
                variant="h2"
                component="h1"
                className="font-extrabold leading-tight"
                sx={{ fontSize: { xs: '2.25rem', sm: '3rem' } }}
              >
                {t('welcome.heroTitle')}
              </Typography>

              <Typography variant="h6" color="text.secondary" className="mt-5 font-normal">
                {t('welcome.heroSubtitle')}
              </Typography>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  {t('welcome.getStarted')}
                </Button>
                <Button component={RouterLink} to="/login" variant="outlined" size="large">
                  {t('auth.signIn')}
                </Button>
              </div>
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-sm">
              <TripRouteIllustration />

              <Paper
                elevation={0}
                className="absolute -bottom-6 -right-2 w-56 border border-slate-200 p-4 sm:-right-6"
                style={{ animation: 'wanderplan-float 6s ease-in-out infinite' }}
              >
                <div className="flex items-center justify-between">
                  <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: 12 } }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>A</Avatar>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>B</Avatar>
                    <Avatar sx={{ bgcolor: '#B45309' }}>C</Avatar>
                  </AvatarGroup>
                  <Chip
                    size="small"
                    icon={<StarRoundedIcon sx={{ color: '#F59E0B !important' }} />}
                    label="4.9"
                    sx={{ bgcolor: '#FEF3C7', fontWeight: 600 }}
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <FlightRoundedIcon fontSize="small" sx={{ color: 'primary.main' }} />
                    <Typography variant="caption" className="flex-1 font-medium">
                      Flight to Tokyo
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      08:00
                    </Typography>
                  </div>
                  <div className="flex items-center gap-2">
                    <LocationOnRoundedIcon fontSize="small" sx={{ color: 'secondary.main' }} />
                    <Typography variant="caption" className="flex-1 font-medium">
                      Tokyo Tower
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      16:00
                    </Typography>
                  </div>
                </div>
              </Paper>
            </div>
          </div>

          <div className="mt-24 grid w-full grid-cols-1 gap-6 sm:grid-cols-3">
            {features.map((feature) => (
              <Paper
                key={feature.title}
                elevation={0}
                className="flex flex-col items-center gap-3 border border-slate-200 p-6 text-center transition-shadow duration-200 hover:shadow-lg"
              >
                <Avatar sx={{ bgcolor: feature.bgcolor, width: 48, height: 48 }}>{feature.icon}</Avatar>
                <Typography variant="subtitle1" className="font-semibold">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Paper>
            ))}
          </div>
        </main>

        <footer className="pb-8 text-center">
          <Typography variant="caption" color="text.secondary">
            {t('welcome.footer')}
          </Typography>
        </footer>
      </div>
    </div>
  );
}
