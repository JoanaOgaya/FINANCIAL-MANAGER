/**
 * useQuery — minimal data-fetching hook with a shared cache.
 * Keys follow "<domain>:<params>" so `invalidateQueries('invoices')` refetches every invoices query.
 * The cache is wiped on logout/user switch via `clearQueryCache()`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

const cache = new Map<string, unknown>();
const active = new Set<{ key: string; refetch: () => void }>();

/** Refetch every mounted query whose key starts with one of the prefixes (all queries when none given). */
export function invalidateQueries(...prefixes: string[]): void {
  active.forEach((q) => {
    if (prefixes.length === 0 || prefixes.some((p) => q.key.startsWith(p))) q.refetch();
  });
}

export function clearQueryCache(): void {
  cache.clear();
}

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | null;
  /** True only while there is no data yet. */
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export function useQuery<T>(key: string, fetcher: () => Promise<T>, options: { enabled?: boolean } = {}): QueryResult<T> {
  const { enabled = true } = options;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const seq = useRef(0);
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; fetching: boolean }>(() => ({
    data: cache.get(key) as T | undefined,
    error: null,
    fetching: enabled,
  }));

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, fetching: true }));
    try {
      const data = await fetcherRef.current();
      if (id !== seq.current) return;
      cache.set(key, data);
      setState({ data, error: null, fetching: false });
    } catch (e) {
      if (id !== seq.current) return;
      setState((s) => ({ data: s.data, error: e as Error, fetching: false }));
    }
  }, [key]);

  useEffect(() => {
    if (!enabled) return undefined;
    setState({ data: cache.get(key) as T | undefined, error: null, fetching: true });
    void run();
    const entry = { key, refetch: () => void run() };
    active.add(entry);
    return () => {
      active.delete(entry);
      seq.current += 1;
    };
  }, [key, enabled, run]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.fetching && state.data === undefined,
    isFetching: state.fetching,
    refetch: () => void run(),
  };
}
