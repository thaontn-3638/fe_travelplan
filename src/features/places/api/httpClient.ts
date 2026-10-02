// Shared by placeApi.ts and regionApi.ts.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Lỗi kỹ thuật có kiểu riêng để UI dịch ra câu dễ hiểu (utils/errorMessages.ts)
// thay vì in thẳng "Request failed (500)." cho người dùng.
export class NetworkError extends Error {
  constructor() {
    super('Unable to reach the mock server.');
    this.name = 'NetworkError';
  }
}

export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed (${status}).`);
    this.name = 'HttpError';
  }
}

export class ResponseShapeError extends Error {
  constructor() {
    super('Unexpected response shape.');
    this.name = 'ResponseShapeError';
  }
}

export async function requestJson<T>(
  url: string,
  isValid: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch {
    throw new NetworkError();
  }

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  const data: unknown = await response.json();

  if (!isValid(data)) {
    throw new ResponseShapeError();
  }

  return data;
}

// Danh sách: một bản ghi hỏng (ví dụ ai đó sửa tay db.json, hoặc một bản ghi
// lưu dở) KHÔNG được làm sập cả màn hình của mọi người dùng. Bỏ qua bản ghi
// không hợp lệ và ghi cảnh báo ra console để còn lần ra; chỉ báo lỗi khi bản
// thân response không phải là mảng.
export async function requestList<T>(
  url: string,
  isItem: (value: unknown) => value is T,
  init?: RequestInit,
): Promise<T[]> {
  const rows = await requestJson(url, (value: unknown): value is unknown[] => Array.isArray(value), init);
  const valid = rows.filter(isItem);
  if (valid.length !== rows.length) {
    const bad = rows.filter((row) => !isItem(row)).map((row) => (row as { id?: unknown } | null)?.id ?? '?');
    console.warn(`[api] Skipped ${bad.length} invalid record(s) from ${url}:`, bad);
  }
  return valid;
}
