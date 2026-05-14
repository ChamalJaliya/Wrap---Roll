'use client';

import { AlertTriangle, RefreshCw, Wallet } from 'lucide-react';
import type { PaymentReconciliation } from '@wrap-roll/contracts';
import {
  DataPanel,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@wrap-roll/shared-ui';
import {
  ADMIN_ANALYTICS_POS_CARD_EVENTS_ACCENT,
  ADMIN_ANALYTICS_POS_CARD_TOTAL_ACCENT,
  adminAccentBorderStyle,
} from '../lib/admin-ui-contract';

function fmtCurrency(n: number) {
  return `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function CashReconciliationPanel({
  reconciliation,
  loading,
}: {
  reconciliation: PaymentReconciliation | null;
  loading: boolean;
}) {
  return (
    <DataPanel>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Wallet className="h-4 w-4 text-emerald-500" />
        <h3 className="text-base font-bold">Cash Reconciliation</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Today
        </span>
        {reconciliation && <span className="text-xs text-muted-foreground">{reconciliation.date}</span>}
      </div>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !reconciliation ? (
        <EmptyState title="No reconciliation data" description="Check API connectivity." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Expected Cash', value: fmtCurrency(reconciliation.expected_cash_total), accent: '#3b82f6' },
            { label: 'Collected Cash', value: fmtCurrency(reconciliation.collected_cash_total), accent: '#22c55e' },
            { label: 'POS Collected', value: fmtCurrency(reconciliation.cash_collected_by_pos), accent: '#f97316' },
            { label: 'Rider Collected', value: fmtCurrency(reconciliation.cash_collected_by_rider), accent: '#06b6d4' },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border bg-background p-3"
              style={adminAccentBorderStyle(item.accent)}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-sm font-black">{item.value}</p>
            </div>
          ))}

          <div
            className={`col-span-2 sm:col-span-4 flex items-center justify-between rounded-xl border px-4 py-3 ${
              Math.abs(reconciliation.variance) < 1
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            }`}
          >
            <div className="flex items-center gap-2">
              {Math.abs(reconciliation.variance) < 1 ? (
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✓ Balanced</span>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-bold text-red-700 dark:text-red-400">Variance Detected</span>
                </>
              )}
            </div>
            <span
              className={`text-sm font-black ${
                Math.abs(reconciliation.variance) < 1
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {reconciliation.variance >= 0 ? '+' : ''}
              {fmtCurrency(reconciliation.variance)}
            </span>
          </div>

          {reconciliation.cash_pending_count > 0 && (
            <div className="col-span-2 sm:col-span-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400">
                {reconciliation.cash_pending_count} uncollected cash order(s) totalling{' '}
                {fmtCurrency(reconciliation.cash_pending_amount)}
              </span>
            </div>
          )}

          <div className="col-span-2 sm:col-span-4 mt-4 border-t pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              POS card collections (standalone terminal)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                className="rounded-xl border bg-background p-3"
                style={adminAccentBorderStyle(ADMIN_ANALYTICS_POS_CARD_EVENTS_ACCENT)}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Recorded events</p>
                <p className="mt-1 text-sm font-black">{reconciliation.card_collection?.count ?? 0}</p>
              </div>
              <div
                className="rounded-xl border bg-background p-3"
                style={adminAccentBorderStyle(ADMIN_ANALYTICS_POS_CARD_TOTAL_ACCENT)}
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Total (order totals)
                </p>
                <p className="mt-1 text-sm font-black">{fmtCurrency(reconciliation.card_collection?.total_lkr ?? 0)}</p>
              </div>
            </div>
            {(reconciliation.card_collection?.events?.length ?? 0) > 0 ? (
              <div className="mt-3 max-h-56 overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Order</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Actor</TableHead>
                      <TableHead className="text-xs">Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reconciliation.card_collection?.events ?? []).map((ev) => (
                      <TableRow key={`${ev.order_id}-${ev.recorded_at}`}>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {new Date(ev.recorded_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="font-mono text-[11px]">{ev.order_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmtCurrency(ev.amount_lkr)}</TableCell>
                        <TableCell className="text-[11px]">{ev.actor_role ?? '—'}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-[11px] text-muted-foreground" title={ev.note ?? ''}>
                          {ev.note ?? '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">No card collection events for this date.</p>
            )}
          </div>
        </div>
      )}
    </DataPanel>
  );
}
