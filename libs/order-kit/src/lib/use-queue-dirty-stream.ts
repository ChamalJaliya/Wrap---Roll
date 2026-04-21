'use client';

import { useEffect, useRef } from 'react';
import { buildQueueStreamUrl, runQueueDirtySseLoop } from './queue-dirty-stream';

export type UseQueueDirtyStreamOptions = {
  enabled: boolean;
  /** e.g. `/api/nest` or `https://api.example.com/api` — no trailing slash */
  apiBaseUrl: string;
  getAccessToken: () => Promise<string | null | undefined>;
  onDirty: () => void;
  debounceMs?: number;
  /** Reconnect delay after disconnect/error (ms). Default 4000. */
  reconnectMs?: number;
  onStatusChange?: (status: 'disabled' | 'connecting' | 'connected' | 'reconnecting') => void;
};

function sseDisabledByEnv(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env.NEXT_PUBLIC_QUEUE_SSE_ENABLED === '0';
}

/**
 * Subscribes to queue dirty SSE when `enabled`; no-op when disabled via env or `enabled` is false.
 * Reconnects after the stream ends or errors.
 */
export function useQueueDirtyStream(opts: UseQueueDirtyStreamOptions): void {
  const onDirtyRef = useRef(opts.onDirty);
  onDirtyRef.current = opts.onDirty;
  const getTokenRef = useRef(opts.getAccessToken);
  getTokenRef.current = opts.getAccessToken;

  useEffect(() => {
    if (!opts.enabled || sseDisabledByEnv()) {
      opts.onStatusChange?.('disabled');
      return;
    }

    const ac = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const streamUrl = buildQueueStreamUrl(opts.apiBaseUrl);
    const reconnectMs = opts.reconnectMs ?? 4000;
    let connectedOnce = false;

    const scheduleReconnect = () => {
      if (ac.signal.aborted) return;
      opts.onStatusChange?.('reconnecting');
      retryTimer = setTimeout(connect, reconnectMs);
    };

    const connect = () => {
      opts.onStatusChange?.(connectedOnce ? 'reconnecting' : 'connecting');
      void runQueueDirtySseLoop({
        streamUrl,
        getAccessToken: () => getTokenRef.current(),
        onDirty: () => onDirtyRef.current(),
        onOpen: () => {
          connectedOnce = true;
          opts.onStatusChange?.('connected');
        },
        onClose: () => {
          if (!ac.signal.aborted) scheduleReconnect();
        },
        signal: ac.signal,
        debounceMs: opts.debounceMs,
      }).catch(() => {
        if (!ac.signal.aborted) {
          scheduleReconnect();
        }
      });
    };

    connect();

    return () => {
      ac.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [opts.enabled, opts.apiBaseUrl, opts.debounceMs, opts.reconnectMs, opts.onStatusChange]);
}
