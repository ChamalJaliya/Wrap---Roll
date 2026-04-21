import axios from 'axios';

function stringifyNestMessage(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw.every((x) => typeof x === 'string')) {
    return raw.join(' ');
  }
  return undefined;
}

/** User-facing message for failed API calls (Axios errors are not `Error` instances). */
export function formatApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ERR_NETWORK') {
      return (
        'Cannot reach the API. Start the Nest server (port 4000). On a physical device, set EXPO_PUBLIC_API_URL ' +
        'to your computer\'s LAN IP (not 127.0.0.1). Android emulator uses 10.0.2.2 automatically.'
      );
    }
    const data = err.response?.data as Record<string, unknown> | undefined;
    const fromMessage = stringifyNestMessage(data?.message);
    const fromError = typeof data?.error === 'string' ? data.error : undefined;
    const fromDetail = typeof data?.detail === 'string' ? data.detail : undefined;
    const detail = fromMessage || fromError || fromDetail || err.message;
    return detail || 'Request failed';
  }
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Something went wrong';
}
