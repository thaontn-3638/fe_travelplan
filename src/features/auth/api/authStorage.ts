export function writeToStorage(key: string, value: string, remember: boolean): void {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  other.removeItem(key);
  target.setItem(key, value);
}

export function readFromStorage(key: string): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key);
}

export function removeFromStorage(key: string): void {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}
