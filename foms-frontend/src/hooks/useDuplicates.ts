/**
 * useDuplicates.ts — hooks for the Duplicate Detection pages.
 *  - Scope (?scope=all|own|liquidation) comes from roleAccess; the backend enforces it.
 *    The frontend never re-filters or re-scores rows.
 *  - Shared filter/search/pagination state (sent as query params).
 *  - Realtime: refetches on 'aiDuplicates' events (WebSocket, polling fallback), so the Head
 *    Accountant's "For Review" queue updates when an Accountant decides, and vice versa.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  duplicatesService,
  type DuplicateFlagItem,
  type DuplicateQuery,
  type ReviewHistoryItem,
  type UniqueDocumentItem,
} from '../services/duplicates.service';
import type { Paged } from '../types/entities';
import { getDuplicateScope } from '../utils/roleAccess';
import { lockedQueueStatus } from '../utils/duplicateWorkflow';
import { connectRealtime } from '../services/realtime';

export const DUPLICATE_TOPIC = 'aiDuplicates';

interface Filters {
  search: string;
  /** Status filter (flags) or decision filter (history) or document type (unique docs). */
  filter: string;
  dateFrom: string;
  dateTo: string;
}

const EMPTY: Filters = { search: '', filter: '', dateFrom: '', dateTo: '' };

function useDuplicateList<T>(
  fetcher: (q: DuplicateQuery) => Promise<Paged<T>>,
  filterParam: 'status' | 'documentType',
  options: { pageSize?: number; lockedFilter?: string; initialStatus?: string } = {},
) {
  const { user } = useAuth();
  const scope = getDuplicateScope(user?.role);
  const lockedFilter = options.lockedFilter ?? options.initialStatus;

  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(options.pageSize ?? 10);
  const [draft, setDraft] = useState<Filters>(() => ({
    search: '',
    filter: options.initialStatus ?? '',
    dateFrom: '',
    dateTo: '',
  }));
  const [applied, setApplied] = useState<Filters>(() => ({
    search: '',
    filter: options.initialStatus ?? '',
    dateFrom: '',
    dateTo: '',
  }));

  const fetchList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher({
        scope,
        page,
        pageSize,
        search: applied.search || undefined,
        [filterParam]: (lockedFilter || applied.filter) ? (lockedFilter || applied.filter) : undefined,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
      });
      setItems(res.items ?? []);
      setTotal(res.total ?? res.items?.length ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load records'));
      setItems([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [scope, page, pageSize, applied, filterParam, lockedFilter, fetcher]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(
    () =>
      connectRealtime(({ topic }) => {
        if (topic === '*' || topic === DUPLICATE_TOPIC) void fetchList();
      }),
    [fetchList],
  );

  const setField = (key: keyof Filters) => (value: string) => setDraft((d) => ({ ...d, [key]: value }));

  return {
    items,
    total,
    isLoading,
    error,
    refetch: fetchList,
    page,
    setPage,
    pageSize,
    setPageSize,
    search: draft.search,
    setSearch: setField('search'),
    filter: draft.filter,
    setFilter: setField('filter'),
    // Aliases for compatibility with page components
    statusFilter: draft.filter,
    setStatusFilter: setField('filter'),
    docTypeFilter: draft.filter,
    setDocTypeFilter: (value: string) => {
      setDraft((d) => ({ ...d, filter: value }));
      setApplied((a) => ({ ...a, filter: value }));
      setPage(1);
    },
    decisionFilter: draft.filter,
    setDecisionFilter: setField('filter'),
    dateFrom: draft.dateFrom,
    setDateFrom: setField('dateFrom'),
    dateTo: draft.dateTo,
    setDateTo: setField('dateTo'),
    applyFilters: () => {
      setPage(1);
      setApplied(draft);
    },
    resetFilters: () => {
      setDraft(EMPTY);
      setPage(1);
      setApplied(EMPTY);
    },
    scope,
    lockedFilter,
  };
}

/** Flagged Duplicates. Head Accountant's queue is locked to PENDING_REVIEW ("For Review"). */
export function useFlaggedDuplicates(options: { pageSize?: number; initialStatus?: string } = {}) {
  const { user } = useAuth();
  return useDuplicateList<DuplicateFlagItem>(duplicatesService.flagged, 'status', {
    ...options,
    lockedFilter: lockedQueueStatus(user?.role) ?? options.initialStatus,
  });
}

export function useUniqueDocuments(options: { pageSize?: number } = {}) {
  return useDuplicateList<UniqueDocumentItem>(duplicatesService.uniqueDocuments, 'documentType', options);
}

export function useReviewHistory(options: { pageSize?: number } = {}) {
  return useDuplicateList<ReviewHistoryItem>(duplicatesService.reviewHistory, 'status', options);
}
