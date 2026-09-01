import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/uiSlice';
import authReducer from './slices/authSlice';
import savedPlacesReducer from './slices/savedPlacesSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
    savedPlaces: savedPlacesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
