/**
 * useMutation — wraps a service call with loading state, success/error toast,
 * and a refetch of affected queries (dashboard, sidebar badges and notifications always refresh).
 */
import { useCallback, useState } from 'react';
import { useToast } from '../components/ToastContext';
import { invalidateQueries } from './useQuery';

const ALWAYS_REFRESH = ['dashboard', 'navBadges', 'notifications'];

export interface UseMutationOptions<TResult> {
  successMessage?: string | ((result: TResult) => string);
  errorTitle?: string;
  /** Query-key prefixes to refetch on success, e.g. ['invoices']. */
  invalidate?: string[];
  onSuccess?: (result: TResult) => void;
}

export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: UseMutationOptions<TResult> = {},
) {
  const { triggerToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { successMessage, errorTitle = 'Action failed', invalidate = [], onSuccess } = options;

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    setIsLoading(true);
    try {
      const result = await fn(...args);
      if (successMessage) {
        triggerToast('success', 'Success', typeof successMessage === 'function' ? successMessage(result) : successMessage);
      }
      invalidateQueries(...invalidate, ...ALWAYS_REFRESH);
      onSuccess?.(result);
      return result;
    } catch (e) {
      triggerToast('error', errorTitle, e instanceof Error ? e.message : 'Something went wrong.');
      return undefined;
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, successMessage, errorTitle, onSuccess, triggerToast]);

  return { mutate, isLoading };
}
