import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types';
import { getStoredUser } from '../../features/auth/api/session';

interface AuthState {
  user: User | null;
  sessionExpired: boolean;
}

const initialState: AuthState = {
  user: getStoredUser(),
  sessionExpired: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.sessionExpired = false;
    },
    clearUser(state) {
      state.user = null;
    },
    expireSession(state) {
      state.user = null;
      state.sessionExpired = true;
    },
    acknowledgeSessionExpired(state) {
      state.sessionExpired = false;
    },
  },
});

export const { setUser, clearUser, expireSession, acknowledgeSessionExpired } = authSlice.actions;
export default authSlice.reducer;
