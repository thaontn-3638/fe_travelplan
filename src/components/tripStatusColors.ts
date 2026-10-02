import type { TripStatus } from '../types';

export const STATUS_TEXT_CLASSES: Record<TripStatus, string> = {
  idea: 'text-idea-dark',
  planning: 'text-amber-dark',
  confirmed: 'text-ocean-dark',
  ongoing: 'text-coral-dark',
  settling: 'text-violet-dark',
  done: 'text-mint-dark',
};

export const STATUS_TINT_CLASSES: Record<TripStatus, string> = {
  idea: 'bg-idea-tint',
  planning: 'bg-amber-tint',
  confirmed: 'bg-ocean-tint',
  ongoing: 'bg-coral-tint',
  settling: 'bg-violet-tint',
  done: 'bg-mint-tint',
};

// Solid dot color per status — used by the itinerary list's timeline view.
export const STATUS_DOT_CLASSES: Record<TripStatus, string> = {
  idea: 'bg-idea-dark',
  planning: 'bg-amber-dark',
  confirmed: 'bg-ocean-dark',
  ongoing: 'bg-coral-dark',
  settling: 'bg-violet-dark',
  done: 'bg-mint-dark',
};
