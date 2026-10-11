/**
 * realtime — WebSocket client with a polling fallback.
 *  - VITE_WS_URL may be absolute (ws://host/ws) or relative (/ws); relative values resolve
 *    against the current host so it works on localhost and a LAN IP unchanged.
 *  - If the socket is unavailable, `onEvent({ topic: '*' })` fires every VITE_POLL_INTERVAL_MS.
 *  - Server messages: JSON `{ "topic": "invoices" }` (or an array of topics).
 */
import { session } from './apiClient';

export interface RealtimeEvent { topic: string }
type Listener = (event: RealtimeEvent) => void;

const POLL_MS = Math.min(15000, Math.max(10000, Number(import.meta.env.VITE_POLL_INTERVAL_MS) || 15000));
const RECONNECT_MS = 5000;

function resolveWsUrl(): string | null {
  const raw: string | undefined = import.meta.env.VITE_WS_URL;
  if (!raw) return null;
  if (/^wss?:\/\//i.test(raw)) return raw;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

export function connectRealtime(listener: Listener): () => void {
  let socket: WebSocket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const startPolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => listener({ topic: '*' }), POLL_MS);
  };
  const stopPolling = () => {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  };

  const open = () => {
    const url = resolveWsUrl();
    if (!url || closed) { startPolling(); return; }
    try {
      const token = session.get()?.accessToken;
      socket = new WebSocket(token ? `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}` : url);
    } catch {
      startPolling();
      return;
    }
    socket.onopen = () => { stopPolling(); };
    socket.onmessage = (msg) => {
      try {
        const data = JSON.parse(String(msg.data)) as { topic?: string | string[] };
        const topics = Array.isArray(data.topic) ? data.topic : [data.topic ?? '*'];
        topics.forEach((topic) => listener({ topic }));
      } catch {
        listener({ topic: '*' });
      }
    };
    socket.onclose = () => {
      socket = null;
      if (closed) return;
      startPolling();
      retryTimer = setTimeout(open, RECONNECT_MS);
    };
    socket.onerror = () => socket?.close();
  };

  open();

  return () => {
    closed = true;
    stopPolling();
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
