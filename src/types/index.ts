export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
}

export interface Place {
  id: string;
  title: string;
  coverUrl: string;
  price?: number;
  rating?: number; // undefined = not yet rated (new custom places)
  address: string;
  lat?: number;
  lng?: number;
  region: string; // province/city, e.g. "Kyoto" — grouping + search
  country?: string;
  category?: string; // restaurant | hotel | attraction | ...
  description?: string;
  images?: string[]; // gallery for the detail carousel; falls back to [coverUrl] when absent
  aliases?: string[]; // alternate-language search terms, e.g. a Japanese name
  source: 'catalog' | 'custom';
  isPublic?: boolean; // only meaningful when source = 'custom'; default false
  createdBy?: string; // userId; only when source = 'custom'
  createdAt?: string; // ISO date; only when source = 'custom'
  savedCount: number; // default 0 — total times ever added to a saved list
}

export interface SavedPlace {
  id: string;
  userId: string;
  placeId: string;
  addedAt: string;
}

export interface Region {
  id: string;
  name: string;
  country?: string;
  aliases?: string[]; // alternate-language names, e.g. a Japanese name
  source: 'catalog' | 'custom';
  createdBy?: string; // userId; only when source = 'custom'
}

interface BaseActivity {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  cost: number;
}

export interface FlightActivity extends BaseActivity {
  type: 'flight';
  flightNo: string;
}

export interface PlaceActivity extends BaseActivity {
  type: 'place';
  placeId: string;
}

export type Activity = FlightActivity | PlaceActivity;

export interface TripDay {
  id: string;
  date: string;
  activities: Activity[];
}

export interface Trip {
  id: string;
  name: string;
  budget: number;
  days: TripDay[];
}
