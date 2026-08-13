import type { User } from '../../../types';
import { readFromStorage, writeToStorage, removeFromStorage } from './authStorage';

const USER_STORAGE_KEY = 'wanderplan_current_user';

function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.phoneNumber === 'string'
  );
}

export function getStoredUser(): User | null {
  const raw = readFromStorage(USER_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function storeUser(user: User, remember: boolean): void {
  writeToStorage(USER_STORAGE_KEY, JSON.stringify(user), remember);
}

export function clearStoredUser(): void {
  removeFromStorage(USER_STORAGE_KEY);
}
