import { differenceInCalendarDays, isAfter, isSameDay, isSameMonth, parseISO } from 'date-fns';
import type { TripSummary } from './types';

export function getTripsThisMonthCount(trips: TripSummary[], now: Date): number {
  return trips.filter((trip) => isSameMonth(parseISO(trip.startDate), now)).length;
}

export function getTotalBudget(trips: TripSummary[]): number {
  return trips.reduce((sum, trip) => sum + (trip.budget ?? 0), 0);
}

function getUpcomingTrips(trips: TripSummary[], now: Date): TripSummary[] {
  return trips
    .filter((trip) => (trip.status === 'planning' || trip.status === 'confirmed') && isAfter(parseISO(trip.startDate), now))
    .sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
}

export function getFeaturedTrip(trips: TripSummary[], now: Date): TripSummary | null {
  const [nextUpcoming] = getUpcomingTrips(trips, now);
  if (nextUpcoming) {
    return nextUpcoming;
  }

  return trips.find((trip) => trip.status === 'ongoing') ?? null;
}

export function getNextTripCountdownDays(trips: TripSummary[], now: Date): number | null {
  const [nextUpcoming] = getUpcomingTrips(trips, now);
  return nextUpcoming ? differenceInCalendarDays(parseISO(nextUpcoming.startDate), now) : null;
}

export interface GreetingHighlights {
  endingToday: TripSummary | null;
  pendingSettlement: TripSummary | null;
}

export function getGreetingHighlights(trips: TripSummary[], now: Date): GreetingHighlights {
  return {
    endingToday: trips.find((trip) => trip.status === 'ongoing' && isSameDay(parseISO(trip.endDate), now)) ?? null,
    pendingSettlement: trips.find((trip) => trip.status === 'settling') ?? null,
  };
}

// Search against the trip's canonical `name` — never against a translated
// display string. `name` is locale-independent (matches `Trip.name` on the
// real model), so results stay stable across UI language switches.
export function searchTripsByName(trips: TripSummary[], query: string): TripSummary[] {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return trips.filter((trip) => trip.name.toLowerCase().includes(normalized));
}
