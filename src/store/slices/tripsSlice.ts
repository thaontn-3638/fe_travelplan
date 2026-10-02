import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Trip } from '../../types';

interface TripsState {
  items: Trip[];
  loaded: boolean;
}

const initialState: TripsState = {
  items: [],
  loaded: false,
};

const tripsSlice = createSlice({
  name: 'trips',
  initialState,
  reducers: {
    setTrips(state, action: PayloadAction<Trip[]>) {
      state.items = action.payload;
      state.loaded = true;
    },
    upsertTrip(state, action: PayloadAction<Trip>) {
      const index = state.items.findIndex((trip) => trip.id === action.payload.id);
      if (index === -1) {
        state.items.unshift(action.payload);
      } else {
        state.items[index] = action.payload;
      }
    },
    removeTrip(state, action: PayloadAction<string>) {
      state.items = state.items.filter((trip) => trip.id !== action.payload);
    },
    // Called on logout, so a same-tab re-login re-fetches instead of reusing stale data.
    resetTrips(state) {
      state.items = [];
      state.loaded = false;
    },
  },
});

export const { setTrips, upsertTrip, removeTrip, resetTrips } = tripsSlice.actions;
export default tripsSlice.reducer;
