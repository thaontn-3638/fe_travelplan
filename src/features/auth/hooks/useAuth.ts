import { useCallback, useEffect } from 'react';
import type { User } from '../../../types';
import { mockLogin, mockRegister, type LoginInput, type RegisterInput } from '../api/authApi';
import { clearStoredToken, hasStoredToken, storeToken } from '../api/token';
import { clearStoredUser, storeUser } from '../api/session';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { setUser, clearUser, expireSession, acknowledgeSessionExpired } from '../../../store/slices/authSlice';

interface UseAuthResult {
  isAuthenticated: boolean;
  user: User | null;
  sessionExpired: boolean;
  login: (credentials: LoginInput, rememberMe?: boolean) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  dismissSessionExpired: () => void;
}

export function useAuth(): UseAuthResult {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const sessionExpired = useAppSelector((state) => state.auth.sessionExpired);
  const isTokenValid = hasStoredToken();

  // Self-heal: if the token was deleted or expired out from under a cached
  // session (e.g. manual localStorage edit), drop the stale user and flag it
  // as an expired session instead of leaving the app half-authenticated.
  useEffect(() => {
    if (user !== null && !isTokenValid) {
      clearStoredUser();
      dispatch(expireSession());
    }
  }, [user, isTokenValid, dispatch]);

  const login = useCallback(
    async (credentials: LoginInput, rememberMe = true): Promise<void> => {
      const result = await mockLogin(credentials);
      storeToken(result.token, rememberMe);
      storeUser(result.user, rememberMe);
      dispatch(setUser(result.user));
    },
    [dispatch],
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<void> => {
      const result = await mockRegister(input);
      storeToken(result.token, true);
      storeUser(result.user, true);
      dispatch(setUser(result.user));
    },
    [dispatch],
  );

  const logout = useCallback((): void => {
    clearStoredToken();
    clearStoredUser();
    dispatch(clearUser());
  }, [dispatch]);

  const dismissSessionExpired = useCallback((): void => {
    dispatch(acknowledgeSessionExpired());
  }, [dispatch]);

  return {
    isAuthenticated: user !== null && isTokenValid,
    user,
    sessionExpired,
    login,
    register,
    logout,
    dismissSessionExpired,
  };
}
