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
  price: number;
  rating: number;
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
