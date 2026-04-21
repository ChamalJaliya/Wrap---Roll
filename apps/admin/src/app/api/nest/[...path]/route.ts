import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ADMIN_ACCESS_COOKIE } from '../../../../lib/authCookies';

export const runtime = 'nodejs';

const BASE = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000/api').replace(
  /\/?$/,
  '',
);

const UPSTREAM_TIMEOUT_MS = (() => {
  const n = Number(process.env.API_PROXY_TIMEOUT_MS);
  if (!Number.isFinite(n) || n < 0) return 25_000;
  return Math.min(Math.max(n, 5_000), 120_000);
})();

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'trailer',
  'upgrade',
]);

function isQueueSsePath(pathParts: string[]): boolean {
  return pathParts.join('/') === 'orders/queue/stream';
}

function forwardResponseHeaders(upstream: Response, requestId: string): Headers {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'set-cookie' || HOP_BY_HOP.has(k)) return;
    out.append(key, value);
  });
  const cookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
  for (const c of cookies) {
    out.append('Set-Cookie', c);
  }
  if (!out.has('x-request-id')) {
    out.set('x-request-id', upstream.headers.get('x-request-id') ?? requestId);
  }
  return out;
}

function forwardSseResponseHeaders(upstream: Response, requestId: string): Headers {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'set-cookie') return;
    if (k === 'connection' || k === 'keep-alive' || k === 'upgrade' || k === 'trailer') return;
    out.append(key, value);
  });
  const cookies =
    typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : [];
  for (const c of cookies) {
    out.append('Set-Cookie', c);
  }
  if (!out.has('x-request-id')) {
    out.set('x-request-id', upstream.headers.get('x-request-id') ?? requestId);
  }
  return out;
}

function forwardHeaders(incoming: NextRequest, requestId: string): Headers {
  const h = new Headers();
  const ct = incoming.headers.get('content-type');
  if (ct) h.set('content-type', ct);
  const accept = incoming.headers.get('accept');
  if (accept) h.set('accept', accept);
  const auth = incoming.headers.get('authorization');
  const cookieToken = incoming.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  if (auth) h.set('authorization', auth);
  else if (cookieToken) h.set('authorization', `Bearer ${cookieToken}`);
  const acrh = incoming.headers.get('access-control-request-headers');
  if (acrh) h.set('access-control-request-headers', acrh);
  h.set('x-request-id', requestId);
  const corr = incoming.headers.get('x-correlation-id');
  if (corr) h.set('x-correlation-id', corr);
  return h;
}

function resolveRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ??
    request.headers.get('x-correlation-id') ??
    randomUUID()
  );
}

async function proxy(
  request: NextRequest,
  pathParts: string[],
): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const subPath = pathParts.length ? pathParts.join('/') : '';
  const targetUrl = `${BASE}/${subPath}${request.nextUrl.search}`;
  const sse = isQueueSsePath(pathParts);

  try {
    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders(request, requestId),
      cache: 'no-store',
      ...(sse ? {} : { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }),
    };
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      init.body = await request.arrayBuffer();
    }

    const res = await fetch(targetUrl, init);
    const out = sse ? forwardSseResponseHeaders(res, requestId) : forwardResponseHeaders(res, requestId);
    return new NextResponse(res.body, { status: res.status, headers: out });
  } catch (e) {
    const err = e instanceof Error ? e : null;
    const msg = err?.message ?? '';
    const timedOut =
      err?.name === 'TimeoutError' ||
      err?.name === 'AbortError' ||
      /aborted|timeout/i.test(msg);
    if (timedOut) {
      return NextResponse.json(
        { error: 'API upstream timeout', requestId },
        { status: 504, headers: { 'x-request-id': requestId } },
      );
    }
    const message = e instanceof Error ? e.message : 'Upstream unavailable';
    return NextResponse.json(
      { error: 'API proxy failed', detail: message, requestId },
      { status: 502, headers: { 'x-request-id': requestId } },
    );
  }
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function OPTIONS(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}

export async function HEAD(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxy(request, path ?? []);
}
