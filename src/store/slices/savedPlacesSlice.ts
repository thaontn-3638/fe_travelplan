import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SavedPlace } from '../../types';

interface SavedPlacesState {
  items: SavedPlace[];
  // Which user's rows `items` holds, or null before the first fetch — see
  // useSavedPlaces.ts, the only place that reads/writes this.
  loadedForUserId: string | null;
}

const initialState: SavedPlacesState = {
  items: [],
  loadedForUserId: null,
};

const savedPlacesSlice = createSlice({
  name: 'savedPlaces',
  initialState,
  reducers: {
    setSavedPlaces(state, action: PayloadAction<{ userId: string; items: SavedPlace[] }>) {
      state.items = action.payload.items;
      state.loadedForUserId = action.payload.userId;
    },
    addSavedPlace(state, action: PayloadAction<SavedPlace>) {
      if (!state.items.some((item) => item.id === action.payload.id)) {
        state.items.push(action.payload);
      }
    },
    removeSavedPlaceRow(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
    // Called on logout, so a same-tab re-login re-fetches instead of reusing
    // the stale loadedForUserId cache.
    resetSavedPlaces(state) {
      state.items = [];
      state.loadedForUserId = null;
    },
  },
});

export const { setSavedPlaces, addSavedPlace, removeSavedPlaceRow, resetSavedPlaces } = savedPlacesSlice.actions;
export default savedPlacesSlice.reducer;
