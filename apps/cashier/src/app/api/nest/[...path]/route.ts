import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { CASHIER_ACCESS_COOKIE } from '../../../../lib/authCookies';

export const runtime = 'nodejs';

const BASE = (process.env.API_PROXY_TARGET || 'http://127.0.0.1:4000/api').replace(
  /\/?$/,
  '',
);

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
  if (!out.has('x-request-id')) out.set('x-request-id', requestId);
  return out;
}

/** Preserve chunked encoding for long-lived SSE through the proxy. */
function forwardSseResponseHeaders(upstream: Response, requestId: string): Headers {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === 'set-cookie') return;
    if (k === 'connection' || k === 'keep-alive' || k === 'upgrade' || k === 'trailer') return;
    out.append(key, value);
  });
  if (!out.has('x-request-id')) out.set('x-request-id', requestId);
  return out;
}

function forwardHeaders(incoming: NextRequest, requestId: string): Headers {
  const h = new Headers();
  const ct = incoming.headers.get('content-type');
  if (ct) h.set('content-type', ct);
  const accept = incoming.headers.get('accept');
  if (accept) h.set('accept', accept);
  const auth = incoming.headers.get('authorization');
  const cookieToken = incoming.cookies.get(CASHIER_ACCESS_COOKIE)?.value;
  if (auth) h.set('authorization', auth);
  else if (cookieToken) h.set('authorization', `Bearer ${cookieToken}`);
  h.set('x-request-id', requestId);
  return h;
}

async function proxy(request: NextRequest, pathParts: string[]) {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const subPath = pathParts.length ? pathParts.join('/') : '';
  const targetUrl = `${BASE}/${subPath}${request.nextUrl.search}`;
  const sse = isQueueSsePath(pathParts);
  try {
    const init: RequestInit = {
      method: request.method,
      headers: forwardHeaders(request, requestId),
      cache: 'no-store',
      ...(sse ? {} : { signal: AbortSignal.timeout(25_000) }),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      init.body = await request.arrayBuffer();
    }
    const res = await fetch(targetUrl, init);
    const headers = sse ? forwardSseResponseHeaders(res, requestId) : forwardResponseHeaders(res, requestId);
    return new NextResponse(res.body, {
      status: res.status,
      headers,
    });
  } catch (e) {
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

