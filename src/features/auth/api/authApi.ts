import bcrypt from 'bcryptjs';
import type { User } from '../../../types';
import { isNonEmptyString } from '../../../utils/typeGuards';
import i18n, { SUPPORTED_LANGUAGES, isSupportedLanguage } from '../../../i18n';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
const BCRYPT_SALT_ROUNDS = 10;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
}

export interface AuthResult {
  token: string;
  user: User;
}

interface StoredUser {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  mockToken: string;
}

interface AuthMessages {
  accountNotFound: string;
  incorrectPassword: string;
  emailAlreadyExists: string;
  serverUnreachable: string;
  registrationFailed: string;
}

const DEFAULT_AUTH_MESSAGES: AuthMessages = {
  accountNotFound: 'No account found with this email.',
  incorrectPassword: 'Incorrect password.',
  emailAlreadyExists: 'Email already exists.',
  serverUnreachable: 'Unable to reach the authentication server.',
  registrationFailed: 'Unable to create account.',
};

function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.email) &&
    isNonEmptyString(candidate.password) &&
    isNonEmptyString(candidate.fullName) &&
    isNonEmptyString(candidate.phoneNumber) &&
    isNonEmptyString(candidate.mockToken)
  );
}

function isStoredUserArray(value: unknown): value is StoredUser[] {
  return Array.isArray(value) && value.every(isStoredUser);
}

function isAuthMessages(value: unknown): value is AuthMessages {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    isNonEmptyString(candidate.accountNotFound) &&
    isNonEmptyString(candidate.incorrectPassword) &&
    isNonEmptyString(candidate.emailAlreadyExists) &&
    isNonEmptyString(candidate.serverUnreachable) &&
    isNonEmptyString(candidate.registrationFailed)
  );
}

function isAuthMessagesByLocale(value: unknown): value is Record<string, AuthMessages> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return SUPPORTED_LANGUAGES.every((language) => isAuthMessages(candidate[language]));
}

function toPublicUser(stored: StoredUser): User {
  return {
    id: stored.id,
    email: stored.email,
    fullName: stored.fullName,
    phoneNumber: stored.phoneNumber,
  };
}

// Error copy is owned by the backend (one message set per locale, fetched and cached
// once per session — not on every login/register submit). The client just picks the
// active locale from the cached map.
let cachedMessagesByLocale: Record<string, AuthMessages> | null = null;
let inFlightMessagesRequest: Promise<Record<string, AuthMessages> | null> | null = null;

async function loadAuthMessagesByLocale(): Promise<Record<string, AuthMessages> | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/authMessages`);

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return isAuthMessagesByLocale(data) ? data : null;
  } catch {
    return null;
  }
}

async function getAuthMessagesByLocale(): Promise<Record<string, AuthMessages> | null> {
  if (cachedMessagesByLocale) {
    return cachedMessagesByLocale;
  }

  if (!inFlightMessagesRequest) {
    inFlightMessagesRequest = loadAuthMessagesByLocale().finally(() => {
      inFlightMessagesRequest = null;
    });
  }

  const result = await inFlightMessagesRequest;

  if (result) {
    cachedMessagesByLocale = result;
  }

  return result;
}

async function getAuthMessages(): Promise<AuthMessages> {
  const byLocale = await getAuthMessagesByLocale();

  if (!byLocale) {
    return DEFAULT_AUTH_MESSAGES;
  }

  const currentLanguage = isSupportedLanguage(i18n.language) ? i18n.language : 'en';
  return byLocale[currentLanguage];
}

async function findUserByEmail(email: string, messages: AuthMessages): Promise<StoredUser | null> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/users?email=${encodeURIComponent(email)}`);
  } catch {
    throw new Error(messages.serverUnreachable);
  }

  if (!response.ok) {
    throw new Error(messages.serverUnreachable);
  }

  const data: unknown = await response.json();

  if (!isStoredUserArray(data)) {
    throw new Error(messages.serverUnreachable);
  }

  return data[0] ?? null;
}

export async function mockLogin(credentials: LoginInput): Promise<AuthResult> {
  const messages = await getAuthMessages();
  const user = await findUserByEmail(credentials.email, messages);

  if (!user) {
    throw new Error(messages.accountNotFound);
  }

  const passwordMatches = await bcrypt.compare(credentials.password, user.password);

  if (!passwordMatches) {
    throw new Error(messages.incorrectPassword);
  }

  return { token: user.mockToken, user: toPublicUser(user) };
}

export async function mockRegister(input: RegisterInput): Promise<AuthResult> {
  const messages = await getAuthMessages();
  const existingUser = await findUserByEmail(input.email, messages);

  if (existingUser) {
    throw new Error(messages.emailAlreadyExists);
  }

  const mockToken = `mock-jwt-token-${crypto.randomUUID()}`;
  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  const newUser: StoredUser = {
    id: `u_${crypto.randomUUID()}`,
    email: input.email,
    password: hashedPassword,
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    mockToken,
  };

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
  } catch {
    throw new Error(messages.serverUnreachable);
  }

  if (!response.ok) {
    throw new Error(messages.registrationFailed);
  }

  return { token: mockToken, user: toPublicUser(newUser) };
}
