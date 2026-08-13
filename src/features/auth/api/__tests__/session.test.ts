import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredUser, storeUser, clearStoredUser } from '../session';
import type { User } from '../../../../types';

const SESSION_STORAGE_KEY = 'wanderplan_current_user';

const user: User = {
  id: 'u1',
  email: 'test@example.com',
  fullName: 'Test User',
  phoneNumber: '0123456789',
};

describe('session storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns null when no user is stored', () => {
    expect(getStoredUser()).toBeNull();
  });

  it('stores a remembered user in localStorage only', () => {
    storeUser(user, true);
    expect(getStoredUser()).toEqual(user);
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('stores a non-remembered user in sessionStorage only', () => {
    storeUser(user, false);
    expect(getStoredUser()).toEqual(user);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clears a stored user from both storage areas', () => {
    storeUser(user, true);
    clearStoredUser();
    expect(getStoredUser()).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, '{not-json');
    expect(getStoredUser()).toBeNull();
  });

  it('returns null when the stored shape does not match User', () => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: 'u1' }));
    expect(getStoredUser()).toBeNull();
  });
});
