import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import bcrypt from 'bcryptjs';
import { mockLogin, mockRegister } from '../authApi';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const EXISTING_USER_PASSWORD = 'password123';

const existingUser = {
  id: 'u1',
  email: 'admin@wanderplan.com',
  password: bcrypt.hashSync(EXISTING_USER_PASSWORD, 4),
  fullName: 'Admin User',
  phoneNumber: '+84901234567',
  mockToken: 'mock-jwt-token-12345',
};

describe('authApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('mockLogin', () => {
    it('returns a token and the public user on valid credentials', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([existingUser]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      const result = await mockLogin({ email: existingUser.email, password: EXISTING_USER_PASSWORD });

      expect(result.token).toBe(existingUser.mockToken);
      expect(result.user).toEqual({
        id: existingUser.id,
        email: existingUser.email,
        fullName: existingUser.fullName,
        phoneNumber: existingUser.phoneNumber,
      });
    });

    it('throws when no account matches the email', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await expect(mockLogin({ email: 'missing@x.com', password: 'x' })).rejects.toThrow(
        'No account found with this email.',
      );
    });

    it('throws on incorrect password', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([existingUser]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await expect(
        mockLogin({ email: existingUser.email, password: 'wrong-password' }),
      ).rejects.toThrow('Incorrect password.');
    });

    it('throws serverUnreachable when the network call fails', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.reject(new Error('network down'));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await expect(
        mockLogin({ email: existingUser.email, password: EXISTING_USER_PASSWORD }),
      ).rejects.toThrow('Unable to reach the authentication server.');
    });
  });

  describe('mockRegister', () => {
    it('throws when the email already exists', async () => {
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([existingUser]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await expect(
        mockRegister({ email: existingUser.email, password: 'x', fullName: 'New', phoneNumber: '000' }),
      ).rejects.toThrow('Email already exists.');
    });

    it('creates a new user and returns a token on success', async () => {
      let capturedBody: string | undefined;
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([]));
        if (url.endsWith('/users') && init?.method === 'POST') {
          capturedBody = init.body as string;
          return Promise.resolve(jsonResponse({}, true));
        }
        throw new Error(`unexpected fetch: ${url}`);
      });

      const result = await mockRegister({
        email: 'new@x.com',
        password: 'secret',
        fullName: 'New User',
        phoneNumber: '000',
      });

      expect(result.user.email).toBe('new@x.com');
      expect(result.token).toMatch(/^mock-jwt-token-/);

      const sentUser: { password: string } = JSON.parse(capturedBody ?? '{}');
      expect(sentUser.password).not.toBe('secret');
      await expect(bcrypt.compare('secret', sentUser.password)).resolves.toBe(true);
    });

    it('throws registrationFailed when the create request fails', async () => {
      fetchMock.mockImplementation((url: string, init?: RequestInit) => {
        if (url.includes('/authMessages')) return Promise.resolve(jsonResponse({}, false));
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([]));
        if (url.endsWith('/users') && init?.method === 'POST') return Promise.resolve(jsonResponse({}, false));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await expect(
        mockRegister({ email: 'new@x.com', password: 'secret', fullName: 'New User', phoneNumber: '000' }),
      ).rejects.toThrow('Unable to create account.');
    });
  });

  describe('auth messages caching', () => {
    it('fetches /authMessages once and reuses it across multiple login attempts', async () => {
      // Use a fresh module instance so this test's cache doesn't leak into the
      // other tests, which rely on /authMessages failing every time.
      vi.resetModules();
      const { mockLogin: freshMockLogin } = await import('../authApi');

      const sharedMessages = {
        accountNotFound: 'No account found with this email.',
        incorrectPassword: 'Incorrect password.',
        emailAlreadyExists: 'Email already exists.',
        serverUnreachable: 'Unable to reach the authentication server.',
        registrationFailed: 'Unable to create account.',
      };
      const authMessagesByLocale = { en: sharedMessages, ja: sharedMessages, vi: sharedMessages };

      let authMessagesCallCount = 0;
      fetchMock.mockImplementation((url: string) => {
        if (url.includes('/authMessages')) {
          authMessagesCallCount += 1;
          return Promise.resolve(jsonResponse(authMessagesByLocale, true));
        }
        if (url.includes('/users?email=')) return Promise.resolve(jsonResponse([existingUser]));
        throw new Error(`unexpected fetch: ${url}`);
      });

      await freshMockLogin({ email: existingUser.email, password: EXISTING_USER_PASSWORD });
      await freshMockLogin({ email: existingUser.email, password: EXISTING_USER_PASSWORD });

      expect(authMessagesCallCount).toBe(1);
    });
  });
});
