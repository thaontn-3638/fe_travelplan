import type { ReactNode } from 'react';
import { Avatar, Typography } from '@mui/material';
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded';

interface AuthHeaderProps {
  title: ReactNode;
  subtitle: ReactNode;
}

export function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
        <FlightTakeoffRoundedIcon fontSize="small" />
      </Avatar>
      <div>
        <Typography variant="h5" component="h1" className="font-bold">
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" className="mt-1">
          {subtitle}
        </Typography>
      </div>
    </div>
  );
}
