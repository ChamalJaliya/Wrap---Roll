import { NextRequest, NextResponse } from 'next/server';
import { CASHIER_ACCESS_COOKIE } from '../../../../../lib/authCookies';

export const runtime = 'nodejs';

/** Must match `apps/cashier/src/app/api/orders/route.ts` so PATCH hits the same Nest as POST. */
const RAW_NEST_API_URL =
  process.env.NEST_API_URL ?? process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
const NEST_API_BASE = RAW_NEST_API_URL.endsWith('/api')
  ? RAW_NEST_API_URL
  : `${RAW_NEST_API_URL.replace(/\/+$/, '')}/api`;

type RouteCtx = { params: Promise<{ orderId: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const { orderId } = await ctx.params;
    const id = String(orderId ?? '').trim();
    if (!id) {
      return NextResponse.json({ message: 'Missing order id', statusCode: 400 }, { status: 400 });
    }

    const accessToken = req.cookies.get(CASHIER_ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 });
    }

    const body = await req.arrayBuffer();
    const upstreamRes = await fetch(`${NEST_API_BASE}/orders/${encodeURIComponent(id)}/line-items`, {
      method: 'PATCH',
      headers: {
        'Content-Type': req.headers.get('content-type') ?? 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });

    const responseText = await upstreamRes.text();

    if (!upstreamRes.ok) {
      console.error(
        `[/api/orders/.../line-items proxy] Upstream ${upstreamRes.status}:`,
        responseText.slice(0, 500),
      );
      let detail: unknown = responseText;
      try {
        detail = JSON.parse(responseText);
      } catch {
        /* keep text */
      }
      return NextResponse.json(
        typeof detail === 'object' && detail !== null
          ? detail
          : { message: 'Upstream error', detail: responseText },
        { status: upstreamRes.status },
      );
    }

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    return NextResponse.json(responseJson, { status: upstreamRes.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/orders/.../line-items proxy] Unexpected error:', err);
    return NextResponse.json(
      { message: 'Internal proxy error', detail: message },
      { status: 500 },
    );
  }
}
