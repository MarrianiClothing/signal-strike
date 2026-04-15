"use client";
import { useState, useEffect, useRef } from "react";
import { getCache, setCache } from "@/lib/cache";

// Show cached data instantly, fetch fresh data in background
// Usage: const { data, loading } = useCachedFetch("deals", fetchDeals)
export function useCachedFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(() => getCache<T>(cacheKey));
  const [loading, setLoading] = useState(!getCache<T>(cacheKey));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await fetcherRef.current();
        if (!cancelled) {
          setData(fresh);
          setCache(cacheKey, fresh);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, setData };
}
