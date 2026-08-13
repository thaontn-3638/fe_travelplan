import type { Activity, FlightActivity, PlaceActivity } from '../types';

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isFlightActivity(activity: Activity): activity is FlightActivity {
  return activity.type === 'flight';
}

export function isPlaceActivity(activity: Activity): activity is PlaceActivity {
  return activity.type === 'place';
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
