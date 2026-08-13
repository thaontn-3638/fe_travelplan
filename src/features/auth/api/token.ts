import { isNonEmptyString } from '../../../utils/typeGuards';
import { readFromStorage, writeToStorage, removeFromStorage } from './authStorage';

const TOKEN_KEY = 'wanderplan_auth_token';
const REMEMBERED_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SESSION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredToken {
  value: string;
  expiresAt: number;
}

function isStoredToken(value: unknown): value is StoredToken {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return isNonEmptyString(candidate.value) && typeof candidate.expiresAt === 'number';
}

export function getStoredToken(): string | null {
  const raw = readFromStorage(TOKEN_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isStoredToken(parsed) || parsed.expiresAt <= Date.now()) {
      removeFromStorage(TOKEN_KEY);
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

export function storeToken(token: string, remember: boolean): void {
  const ttl = remember ? REMEMBERED_TOKEN_TTL_MS : SESSION_TOKEN_TTL_MS;
  const stored: StoredToken = { value: token, expiresAt: Date.now() + ttl };
  writeToStorage(TOKEN_KEY, JSON.stringify(stored), remember);
}

export function clearStoredToken(): void {
  removeFromStorage(TOKEN_KEY);
}

export function hasStoredToken(): boolean {
  return getStoredToken() !== null;
}
