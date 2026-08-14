export type TripStatus = 'idea' | 'planning' | 'confirmed' | 'ongoing' | 'settling' | 'done';

export type TripIcon = 'landmark' | 'beach' | 'lantern' | 'settlement' | 'noodles' | 'ski';

export interface Traveler {
  initials: string;
  colorClass: string;
}

export interface TripSummary {
  id: string;
  /** Canonical, locale-independent name (matches `Trip.name` on the real model) — search against this, never against a translated display string. */
  name: string;
  translationKey: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  travelers: Traveler[];
  extraTravelers: number;
  budget: number | null;
  spent: number;
  icon: TripIcon;
}
