import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { CASHIER_ACCESS_COOKIE } from '../../../lib/authCookies';
import type { CashierOrderSyncPayload } from '@wrap-roll/contracts';
import { cashierPayloadToWrapOrder, normalizeOptionalPositiveMoney } from '@wrap-roll/order-kit';
import { normalizeCashierPhone, phoneDigits } from '../../../lib/phone';

const RAW_NEST_API_URL =
  process.env.NEST_API_URL ?? process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
const NEST_API_BASE = RAW_NEST_API_URL.endsWith('/api')
  ? RAW_NEST_API_URL
  : `${RAW_NEST_API_URL.replace(/\/+$/, '')}/api`;

export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get(CASHIER_ACCESS_COOKIE)?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const body = await req.json();
    const payload = body as CashierOrderSyncPayload;
    const idempotencyKey = req.headers.get('x-idempotency-key')?.trim() || undefined;
    const supervisorElevation =
      typeof payload.supervisorElevationToken === 'string'
        ? payload.supervisorElevationToken.trim()
        : '';

    const normalizedPhone = (() => {
      const d = phoneDigits(payload.customerPhone);
      const raw = normalizeCashierPhone(payload.customerPhone);
      return d.length > 0 ? raw : undefined;
    })();
    let wrapOrder: ReturnType<typeof cashierPayloadToWrapOrder>;
    try {
      const { supervisorElevationToken: _drop, ...restPayload } = payload;
      wrapOrder = cashierPayloadToWrapOrder(
        { ...restPayload, customerPhone: normalizedPhone },
        randomUUID,
      );
    } catch (mapErr) {
      const message = mapErr instanceof Error ? mapErr.message : 'Invalid cashier order payload';
      return NextResponse.json(
        { message, error: 'Bad Request', statusCode: 400 },
        { status: 400 },
      );
    }

    const mdProxy = normalizeOptionalPositiveMoney(payload.manualDiscountAmount);
    if (mdProxy !== undefined) {
      wrapOrder = {
        ...wrapOrder,
        pricing: {
          ...wrapOrder.pricing,
          manualDiscountAmount: mdProxy,
        },
      };
    }

    const upstreamRes = await fetch(`${NEST_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        ...(supervisorElevation ? { 'x-supervisor-elevation': supervisorElevation } : {}),
      },
      body: JSON.stringify(wrapOrder),
    });

    const responseText = await upstreamRes.text();

    if (!upstreamRes.ok) {
      const safeDetail =
        responseText.length > 800 ? `${responseText.slice(0, 800)}…` : responseText;
      console.error(
        `[/api/orders proxy] Upstream rejected order: ${upstreamRes.status}`,
        safeDetail,
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
          : { error: 'Upstream error', detail: responseText },
        { status: upstreamRes.status }
      );
    }

    let responseJson: unknown;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    return NextResponse.json(responseJson, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/orders proxy] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Internal proxy error', detail: message },
      { status: 500 }
    );
  }
}
