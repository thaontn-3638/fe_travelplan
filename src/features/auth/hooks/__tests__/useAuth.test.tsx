import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { useAuth } from '../useAuth';
import * as authApi from '../../api/authApi';
import { getStoredToken, clearStoredToken } from '../../api/token';
import { getStoredUser } from '../../api/session';
import authReducer from '../../../../store/slices/authSlice';
import type { User } from '../../../../types';

function renderUseAuth() {
  const store = configureStore({ reducer: { auth: authReducer } });

  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return renderHook(() => useAuth(), { wrapper: Wrapper });
}

const testUser: User = {
  id: 'u1',
  email: 'test@example.com',
  fullName: 'Test User',
  phoneNumber: '0123456789',
};

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unauthenticated with no stored session', () => {
    const { result } = renderUseAuth();

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('updates state and storage after a successful login', async () => {
    vi.spyOn(authApi, 'mockLogin').mockResolvedValue({ token: 'tok-1', user: testUser });
    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.login({ email: testUser.email, password: 'secret' });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
    expect(getStoredToken()).toBe('tok-1');
    expect(getStoredUser()).toEqual(testUser);
  });

  it('updates state and storage after a successful registration', async () => {
    vi.spyOn(authApi, 'mockRegister').mockResolvedValue({ token: 'tok-2', user: testUser });
    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.register({
        email: testUser.email,
        password: 'secret',
        fullName: testUser.fullName,
        phoneNumber: testUser.phoneNumber,
      });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
  });

  it('keeps state unauthenticated when login fails', async () => {
    vi.spyOn(authApi, 'mockLogin').mockRejectedValue(new Error('Incorrect password.'));
    const { result } = renderUseAuth();

    await expect(
      act(async () => {
        await result.current.login({ email: testUser.email, password: 'wrong' });
      }),
    ).rejects.toThrow('Incorrect password.');

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('clears state and storage on logout without flagging sessionExpired', async () => {
    vi.spyOn(authApi, 'mockLogin').mockResolvedValue({ token: 'tok-1', user: testUser });
    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.login({ email: testUser.email, password: 'secret' });
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpired).toBe(false);
    expect(getStoredToken()).toBeNull();
    expect(getStoredUser()).toBeNull();
  });

  it('self-heals and flags sessionExpired when the token is removed while a user session is cached', async () => {
    vi.spyOn(authApi, 'mockLogin').mockResolvedValue({ token: 'tok-1', user: testUser });
    const { result, rerender } = renderUseAuth();

    await act(async () => {
      await result.current.login({ email: testUser.email, password: 'secret' });
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate the token disappearing without going through logout()
    // (manual localStorage edit, expiry, etc.)
    clearStoredToken();

    act(() => {
      rerender();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.sessionExpired).toBe(true);
    expect(getStoredUser()).toBeNull();

    act(() => {
      result.current.dismissSessionExpired();
    });

    expect(result.current.sessionExpired).toBe(false);
  });

  it('stores the session in sessionStorage only when rememberMe is false', async () => {
    vi.spyOn(authApi, 'mockLogin').mockResolvedValue({ token: 'tok-1', user: testUser });
    const { result } = renderUseAuth();

    await act(async () => {
      await result.current.login({ email: testUser.email, password: 'secret' }, false);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem('wanderplan_auth_token')).not.toBeNull();
    expect(localStorage.getItem('wanderplan_auth_token')).toBeNull();
  });
});
