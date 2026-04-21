/**
 * SSE client for `GET /orders/queue/stream` (Nest `text/event-stream`).
 * Uses `fetch` + ReadableStream so `Authorization` and cookies can be used together.
 */

export type QueueDirtySsePayload = {
  rev?: number;
  orderId?: string;
  type?: string;
  ts?: number;
};

export function buildQueueStreamUrl(apiBase: string): string {
  const b = apiBase.replace(/\/$/, '');
  return `${b}/orders/queue/stream`;
}

export type RunQueueDirtySseLoopOptions = {
  streamUrl: string;
  /** Return JWT; if null/undefined, cookie-only same-origin requests still work for proxied apps. */
  getAccessToken: () => Promise<string | null | undefined>;
  onDirty: () => void;
  onOpen?: () => void;
  onClose?: () => void;
  signal: AbortSignal;
  debounceMs?: number;
};

export async function runQueueDirtySseLoop(options: RunQueueDirtySseLoopOptions): Promise<void> {
  const debounceMs = options.debounceMs ?? 400;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      options.onDirty();
    }, debounceMs);
  };

  const token = await options.getAccessToken();
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const relative = options.streamUrl.startsWith('/');
  const res = await fetch(options.streamUrl, {
    headers,
    credentials: relative ? 'include' : 'omit',
    cache: 'no-store',
    signal: options.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`queue SSE failed: ${res.status}`);
  }
  options.onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      if (options.signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const t = line.trimEnd();
        if (t.startsWith('data:')) {
          const payload = t.slice(5).trimStart();
          // Heartbeats use empty `data:` — do not refetch queues on those (was polling every ~5–25s).
          if (payload.length === 0) continue;
          try {
            JSON.parse(payload) as QueueDirtySsePayload;
          } catch {
            /* ignore non-JSON */
          }
          schedule();
        }
      }
    }
  } finally {
    if (debounceTimer) clearTimeout(debounceTimer);
    options.onClose?.();
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
