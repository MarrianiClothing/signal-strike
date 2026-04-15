// Stale-while-revalidate localStorage cache
// Usage: getCache("deals") → data | null, setCache("deals", data)

const PREFIX = "ss_";
const TTL_MS = 5 * 60 * 1000; // 5 minutes before considered stale (still shown, but refetch triggered)

interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}

export function clearCache(key: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

export function isStale(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return true;
    const entry: CacheEntry<unknown> = JSON.parse(raw);
    return Date.now() - entry.ts > TTL_MS;
  } catch {
    return true;
  }
}
