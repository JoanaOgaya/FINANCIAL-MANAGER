/**
 * apiClient — the ONE HTTP instance. Base URL from VITE_API_URL, bearer token,
 * normalised errors, and 401 handling (session cleared + registered listener notified).
 */
import axios, { AxiosError, type AxiosRequestConfig } from 'axios';

const SESSION_KEY = 'foms_session';

const baseURL: string = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  get isForbidden() { return this.status === 403; }
  get isNetwork() { return this.status === 0; }
}

// ── Session token storage (auth only; no business data) ──────────────
interface StoredSession { accessToken: string; refreshToken?: string }

export const session = {
  get(): StoredSession | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      return null;
    }
  },
  set(value: StoredSession) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); },
  clear() { sessionStorage.removeItem(SESSION_KEY); },
};

let unauthorizedListener: (() => void) | null = null;
export function onUnauthorized(listener: (() => void) | null) { unauthorizedListener = listener; }

const instance = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } });

instance.interceptors.request.use((config) => {
  const token = session.get()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

instance.interceptors.response.use(
  (res) => res,
  (err: AxiosError<{ message?: string; error?: string }>) => {
    const status = err.response?.status ?? 0;
    if (status === 401 && !err.config?.url?.includes('/auth/login')) {
      session.clear();
      unauthorizedListener?.();
    }
    const message =
      err.response?.data?.message ??
      err.response?.data?.error ??
      (status === 0 ? 'Unable to reach the server. Check your connection.' : err.message);
    return Promise.reject(new ApiError(message, status));
  },
);

/** Unwraps the `{ success, data }` envelope when the API uses it. */
function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) return (body as { data: T }).data;
  return body as T;
}

export const http = {
  get: async <T>(url: string, params?: object, config?: AxiosRequestConfig) => unwrap<T>((await instance.get(url, { ...config, params })).data),
  post: async <T>(url: string, body?: unknown, config?: AxiosRequestConfig) => unwrap<T>((await instance.post(url, body, config)).data),
  put: async <T>(url: string, body?: unknown) => unwrap<T>((await instance.put(url, body)).data),
  patch: async <T>(url: string, body?: unknown) => unwrap<T>((await instance.patch(url, body)).data),
  delete: async <T>(url: string) => unwrap<T>((await instance.delete(url)).data),
};

export const API_BASE_URL = baseURL;
