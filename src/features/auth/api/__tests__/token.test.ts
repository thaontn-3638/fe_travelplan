import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredToken, storeToken, clearStoredToken, hasStoredToken } from '../token';

const TOKEN_STORAGE_KEY = 'wanderplan_auth_token';

describe('token storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns null when no token is stored', () => {
    expect(getStoredToken()).toBeNull();
    expect(hasStoredToken()).toBe(false);
  });

  it('stores a remembered token in localStorage only', () => {
    storeToken('abc123', true);
    expect(getStoredToken()).toBe('abc123');
    expect(hasStoredToken()).toBe(true);
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('stores a non-remembered token in sessionStorage only', () => {
    storeToken('abc123', false);
    expect(getStoredToken()).toBe('abc123');
    expect(hasStoredToken()).toBe(true);
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('clears a stored token from both storage areas', () => {
    storeToken('abc123', true);
    clearStoredToken();
    expect(getStoredToken()).toBeNull();
    expect(hasStoredToken()).toBe(false);
  });

  it('treats an empty string as no token', () => {
    storeToken('', true);
    expect(getStoredToken()).toBeNull();
    expect(hasStoredToken()).toBe(false);
  });

  it('treats an expired token as no token', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify({ value: 'abc123', expiresAt: Date.now() - 1000 }));
    expect(getStoredToken()).toBeNull();
    expect(hasStoredToken()).toBe(false);
  });

  it('treats malformed stored data as no token', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'not-json');
    expect(getStoredToken()).toBeNull();
  });
});
