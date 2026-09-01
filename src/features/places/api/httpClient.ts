// Shared by placeApi.ts and regionApi.ts.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function requestJson<T>(
  url: string,
  isValid: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('Unable to reach the mock server.');
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const data: unknown = await response.json();

  if (!isValid(data)) {
    throw new Error('Unexpected response shape.');
  }

  return data;
}
