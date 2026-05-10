'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
} from '@wrap-roll/shared-ui';
import { Banknote, Coins, RotateCcw } from 'lucide-react';

/** Re-export for cashier imports (`page.tsx`); implementation lives in `@wrap-roll/order-kit`. */
export { appendCashTenderAuditToNote } from '@wrap-roll/order-kit';

const LKR_NOTES = [5000, 1000, 500, 100] as const;
const LKR_SMALL = [50, 20, 10] as const;

function greedyChange(amount: number, denominations: number[]): Array<{ v: number; n: number }> {
  const out: Array<{ v: number; n: number }> = [];
  let left = Math.round(amount * 100) / 100;
  if (left <= 0) return out;
  for (const d of denominations) {
    if (left < d - 1e-9) continue;
    const n = Math.floor((left + 1e-9) / d);
    if (n > 0) {
      out.push({ v: d, n });
      left = Math.round((left - n * d) * 100) / 100;
    }
  }
  return out;
}

const DENOMS_DESC = [5000, 1000, 500, 100, 50, 20, 10, 5];

export type CashTenderPurpose = 'record_collection' | 'place_order';

/** Passed on confirm — use for payment notes / audits (mark-payment-received). */
export type CashTenderConfirmDetail = {
  amountDue: number;
  cashReceived: number;
  changeReturned: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Exact total due (matches order total). */
  amountDue: number;
  /**
   * Called after staff confirms with tender math. Pay-now can ignore `detail`;
   * collection flows should attach {@link appendCashTenderAuditToNote} to the API note.
   */
  onConfirmCollection?: (detail: CashTenderConfirmDetail) => void | Promise<void>;
  confirmLabel?: string;
  /**
   * `record_collection` — existing order, mark cash collected.
   * `place_order` — counter Pay now: same till UX, then submit paid order (no PATCH).
   */
  purpose?: CashTenderPurpose;
  /** Overrides the label above the big amount (default depends on `purpose`). */
  amountDueLabel?: string;
};

export function CashTenderDialog({
  open,
  onOpenChange,
  amountDue,
  onConfirmCollection,
  confirmLabel,
  purpose = 'record_collection',
  amountDueLabel,
}: Props) {
  const [tenderStr, setTenderStr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTenderStr('');
  }, [open, amountDue]);

  const tenderNum = useMemo(() => {
    const n = parseFloat(String(tenderStr).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  }, [tenderStr]);

  const change = Math.max(0, tenderNum - amountDue);
  const shortBy = tenderNum > 0 && tenderNum < amountDue ? amountDue - tenderNum : 0;
  const changeBreakdown = useMemo(() => greedyChange(change, DENOMS_DESC), [change]);

  const resolvedConfirmLabel =
    confirmLabel ??
    (purpose === 'place_order' ? 'Place order' : 'Record cash payment');

  const resolvedAmountLabel =
    amountDueLabel ??
    (purpose === 'place_order' ? 'Total due (this cart)' : 'Amount due');

  const busyLabel = purpose === 'place_order' ? 'Placing…' : 'Recording…';

  const addToTender = (add: number) => {
    setTenderStr((s) => {
      const cur = parseFloat(String(s).replace(/,/g, ''));
      const base = Number.isFinite(cur) ? cur : 0;
      return (base + add).toFixed(2);
    });
  };

  const setExactDue = () => setTenderStr(amountDue.toFixed(2));

  const chipClass =
    'touch-manipulation active:scale-[0.97] min-h-[52px] rounded-xl border border-slate-200 bg-white px-4 text-base font-black tabular-nums shadow-sm transition hover:border-primary/35 hover:bg-primary/[0.06]';

  const chipSmallClass =
    'touch-manipulation active:scale-[0.97] min-h-[48px] min-w-[4.5rem] rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold tabular-nums hover:bg-slate-100';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pos-touch-scroll max-h-[min(92vh,720px)] gap-0 overflow-y-auto rounded-[28px] border-2 border-border/80 p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-background px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-black tracking-tight sm:text-2xl">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Banknote className="h-7 w-7" aria-hidden />
            </span>
            Cash &amp; change
          </DialogTitle>
          <DialogDescription className="text-left text-base leading-snug text-muted-foreground">
            {purpose === 'place_order' ? (
              <>
                Tap amounts to add to <strong className="text-foreground">cash received</strong>. Same
                till helper as <strong className="text-foreground">Cash &amp; change</strong> on Orders —
                confirm change, then place this cart as paid.
              </>
            ) : (
              <>
                Tap amounts to add to <strong className="text-foreground">cash received</strong>. We show
                change before you record payment.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] to-background p-4 sm:p-5">
            <p className="text-sm font-bold uppercase tracking-[0.12em] text-primary/90">
              {resolvedAmountLabel}
            </p>
            <p className="mt-2 font-display text-4xl font-black tabular-nums tracking-tight text-foreground sm:text-[2.75rem]">
              Rs {amountDue.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-foreground" htmlFor="tender-input">
              Cash received from customer
            </label>
            <div className="flex gap-2">
              <input
                id="tender-input"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
                className="min-h-[56px] flex-1 touch-manipulation rounded-xl border border-slate-200 bg-white px-4 text-center text-2xl font-black tabular-nums outline-none ring-offset-background focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 sm:text-3xl"
                placeholder="0.00"
                value={tenderStr}
                onChange={(e) => setTenderStr(e.target.value)}
              />
              <button
                type="button"
                title="Clear amount"
                aria-label="Clear cash received amount"
                className="inline-flex min-h-[56px] min-w-[56px] shrink-0 touch-manipulation items-center justify-center rounded-xl border border-slate-200 bg-muted/50 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-95"
                onClick={() => setTenderStr('')}
              >
                <RotateCcw className="h-6 w-6" aria-hidden />
              </button>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Quick add — notes (LKR)
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LKR_NOTES.map((v) => (
                <button key={v} type="button" className={chipClass} onClick={() => addToTender(v)}>
                  +{v.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
              {LKR_SMALL.map((v) => (
                <button key={v} type="button" className={chipSmallClass} onClick={() => addToTender(v)}>
                  +{v}
                </button>
              ))}
              <button
                type="button"
                className={cn(
                  chipSmallClass,
                  'min-w-[7rem] border-primary/40 bg-primary/15 font-black text-primary hover:bg-primary/25',
                )}
                onClick={setExactDue}
              >
                Exact due
              </button>
            </div>
          </div>

          <div
            className={cn(
              'rounded-xl border-2 p-4 sm:p-5',
              shortBy > 0
                ? 'border-amber-400 bg-amber-50'
                : tenderNum > 0
                  ? 'border-emerald-300 bg-emerald-50/90'
                  : 'border-slate-200 bg-slate-50/80',
            )}
          >
            {shortBy > 0 ? (
              <p className="text-lg font-bold text-amber-950">
                Still short by{' '}
                <span className="font-display text-2xl font-black tabular-nums">Rs {shortBy.toFixed(2)}</span>
              </p>
            ) : (
              <>
                <p className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-900/80">
                  Change to return
                </p>
                <p className="mt-2 font-display text-4xl font-black tabular-nums text-emerald-950 sm:text-[2.75rem]">
                  Rs {change.toFixed(2)}
                </p>
                {change > 0 && changeBreakdown.length > 0 ? (
                  <div className="mt-4 border-t border-emerald-200/90 pt-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                      <Coins className="h-5 w-5 shrink-0" aria-hidden />
                      Bills &amp; coins to hand back
                    </p>
                    <ul className="mt-3 space-y-2 text-base font-semibold text-emerald-950">
                      {changeBreakdown.map(({ v, n }) => (
                        <li key={v} className="flex justify-between gap-4 rounded-xl bg-white/70 px-3 py-2">
                          <span>Rs {v.toLocaleString()}</span>
                          <span className="tabular-nums">× {n}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <details className="group rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
            <summary className="cursor-pointer list-none text-base font-bold outline-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex min-h-12 w-full touch-manipulation items-center justify-between gap-2 rounded-xl py-2">
                Till / drawer tips
                <span className="text-muted-foreground transition group-open:rotate-180">▼</span>
              </span>
            </summary>
            <ul className="mt-2 space-y-2 pb-2 pl-1 text-base leading-relaxed">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                Count large notes first; hand change with bills on top.
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                Card payments: use the terminal — no physical change.
              </li>
            </ul>
          </details>

          {onConfirmCollection ? (
            <Button
              type="button"
              className="min-h-[56px] w-full touch-manipulation rounded-xl py-6 text-lg font-black shadow-lg transition active:scale-[0.99] sm:min-h-[60px] sm:text-xl"
              disabled={busy || shortBy > 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirmCollection({
                    amountDue,
                    cashReceived: tenderNum,
                    changeReturned: change,
                  });
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? busyLabel : resolvedConfirmLabel}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
