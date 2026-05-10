'use client';

import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  cn,
} from '@wrap-roll/shared-ui';
import { Delete, Equal } from 'lucide-react';

/** Values from the open order — tap to load the display for manual verification / split math. */
export type PosCalculatorQuickAmounts = {
  subtotal: number;
  tax: number;
  total: number;
  discount: number;
  deliveryFee: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quickAmounts?: PosCalculatorQuickAmounts | null;
  /** Short label, e.g. `#22998FF7` */
  orderHint?: string;
  /** Checkout VAT as fraction (e.g. `0.15`) — shown on the VAT apply chip; falls back to tax/subtotal when omitted. */
  vatRate?: number;
};

const cell = 'touch-manipulation min-h-[58px] h-[58px] w-full rounded-2xl text-2xl font-black shadow-sm active:scale-[0.97] sm:min-h-[64px] sm:h-[64px] sm:text-3xl';
const cellNum = cn(cell, 'bg-slate-100 text-foreground hover:bg-slate-200/90 border-0');
const cellOp = cn(
  cell,
  'border-2 border-slate-300 bg-white text-foreground hover:bg-slate-50',
);
const cellAction = cn(cell, 'border-2 border-slate-200 bg-white text-foreground hover:bg-slate-50');
const cellEquals = cn(
  cell,
  'bg-primary text-primary-foreground shadow-md hover:bg-primary/90 border-0',
);

const quickBtn =
  'touch-manipulation flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-orange-200/90 bg-gradient-to-b from-orange-50 to-amber-50/80 px-3 py-3 text-center shadow-sm transition active:scale-[0.98] hover:bg-orange-50 disabled:pointer-events-none disabled:opacity-40';

function fmtRs(n: number): string {
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

/** Effective VAT % for labels: POS setting first, else inferred from line amounts. */
function resolveVatPercentDisplay(
  vatRate: number | undefined,
  subtotal: number,
  tax: number,
): string | null {
  let pct: number | null = null;
  if (vatRate != null && Number.isFinite(vatRate) && vatRate >= 0 && vatRate <= 1) {
    pct = vatRate * 100;
  } else if (subtotal > 0 && tax >= 0 && Number.isFinite(tax)) {
    pct = (tax / subtotal) * 100;
  }
  if (pct == null || !Number.isFinite(pct)) return null;
  const rounded = Math.round(pct * 1000) / 1000;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Register-style calculator — large keys for touch use (split bills, quick math).
 */
export function PosCalculatorDialog({
  open,
  onOpenChange,
  quickAmounts,
  orderHint,
  vatRate,
}: Props) {
  const [display, setDisplay] = useState('0');
  const [buffer, setBuffer] = useState<string | null>(null);
  const [op, setOp] = useState<'+' | '-' | '*' | '/' | null>(null);
  const [fresh, setFresh] = useState(true);

  const num = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  const applyOp = (a: number, b: number, o: typeof op): number => {
    if (o === '+') return a + b;
    if (o === '-') return a - b;
    if (o === '*') return a * b;
    if (o === '/') return b === 0 ? 0 : a / b;
    return b;
  };

  const pressDigit = (d: string) => {
    if (d === '.') {
      if (fresh) {
        setDisplay('0.');
        setFresh(false);
        return;
      }
      if (display.includes('.')) return;
      setDisplay((s) => s + '.');
      return;
    }
    if (fresh) {
      setDisplay(d);
      setFresh(false);
    } else {
      setDisplay((s) => (s === '0' && d !== '0' ? d : s + d));
    }
  };

  const pressOp = (next: typeof op) => {
    const n = num(display);
    if (buffer === null) {
      setBuffer(String(n));
    } else if (op) {
      const a = num(buffer);
      const r = applyOp(a, n, op);
      setBuffer(String(r));
      setDisplay(String(Math.round(r * 1e6) / 1e6));
    } else {
      setBuffer(String(n));
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => {
    if (buffer === null || !op) return;
    const a = num(buffer);
    const b = num(display);
    const r = applyOp(a, b, op);
    setDisplay(String(Math.round(r * 1e6) / 1e6));
    setBuffer(null);
    setOp(null);
    setFresh(true);
  };

  /**
   * % key — POS-friendly rules:
   * - After + or −: replace entry with (buffer × entry ÷ 100), i.e. that **percent of** the first amount (then = adds/subtracts it).
   * - After × or ÷: replace entry with entry ÷ 100 (use 15 → 0.15 as a factor).
   * - Otherwise: divide display by 100 (15 → 0.15).
   */
  const pressPercent = () => {
    const n = num(display);
    if (buffer !== null && op !== null) {
      const b = num(buffer);
      if (op === '+' || op === '-') {
        const portion = Math.round(((b * n) / 100) * 1e6) / 1e6;
        setDisplay(String(portion));
        setFresh(true);
        return;
      }
      if (op === '*' || op === '/') {
        const factor = Math.round((n / 100) * 1e6) / 1e6;
        setDisplay(String(factor));
        setFresh(true);
        return;
      }
    }
    const divided = Math.round((n / 100) * 1e6) / 1e6;
    setDisplay(String(divided));
    setFresh(true);
  };

  const clearAll = () => {
    setDisplay('0');
    setBuffer(null);
    setOp(null);
    setFresh(true);
  };

  const backspace = () => {
    if (fresh) return;
    if (display.length <= 1) {
      setDisplay('0');
      setFresh(true);
    } else {
      setDisplay((s) => s.slice(0, -1));
    }
  };

  /** Load a stored order amount into the display (clears pending op — same as starting a new number). */
  const applyQuickAmount = (value: number) => {
    if (!Number.isFinite(value)) return;
    setDisplay(fmtRs(value));
    setBuffer(null);
    setOp(null);
    setFresh(true);
  };

  const showDiscount = quickAmounts && quickAmounts.discount > 0;
  const showDelivery = quickAmounts && quickAmounts.deliveryFee > 0;

  const vatPctLabel =
    quickAmounts != null
      ? resolveVatPercentDisplay(vatRate, quickAmounts.subtotal, quickAmounts.tax)
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(92dvh,820px)] flex-col gap-0 overflow-hidden rounded-[28px] border-2 border-border/80 p-0 shadow-2xl sm:max-w-md">
        <DialogHeader className="shrink-0 border-b border-border/60 bg-muted/30 px-5 pb-4 pt-5 sm:px-6">
          <DialogTitle className="text-xl font-black sm:text-2xl">Calculator</DialogTitle>
          <DialogDescription className="sr-only">Calculator</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-8 pt-4 sm:px-6">
          <div className="space-y-4">
          {quickAmounts ? (
            <div className="rounded-2xl border border-orange-200/70 bg-orange-50/40 px-3 py-3 sm:px-4">
              <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-orange-900/80">
                Apply from order{orderHint ? ` ${orderHint}` : ''}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-3">
                <button type="button" className={quickBtn} onClick={() => applyQuickAmount(quickAmounts.subtotal)}>
                  <span className="text-[11px] font-black uppercase tracking-wide text-orange-950">Subtotal</span>
                  <span className="font-display text-xl font-black tabular-nums leading-tight text-orange-950">
                    Rs {fmtRs(quickAmounts.subtotal)}
                  </span>
                </button>
                <button type="button" className={quickBtn} onClick={() => applyQuickAmount(quickAmounts.tax)}>
                  <span className="text-[11px] font-black uppercase tracking-wide text-orange-950">
                    {vatPctLabel != null ? <>VAT ({vatPctLabel}%)</> : 'VAT'}
                  </span>
                  <span className="font-display text-xl font-black tabular-nums leading-tight text-orange-950">
                    Rs {fmtRs(quickAmounts.tax)}
                  </span>
                </button>
                <button type="button" className={quickBtn} onClick={() => applyQuickAmount(quickAmounts.total)}>
                  <span className="text-[11px] font-black uppercase tracking-wide text-orange-950">Total</span>
                  <span className="font-display text-xl font-black tabular-nums leading-tight text-orange-950">
                    Rs {fmtRs(quickAmounts.total)}
                  </span>
                </button>
              </div>
              {showDiscount || showDelivery ? (
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  {showDiscount ? (
                    <button
                      type="button"
                      className={quickBtn}
                      onClick={() => applyQuickAmount(quickAmounts.discount)}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wide text-orange-950">Discount</span>
                      <span className="font-display text-xl font-black tabular-nums leading-tight text-orange-950">
                        Rs {fmtRs(quickAmounts.discount)}
                      </span>
                    </button>
                  ) : null}
                  {showDelivery ? (
                    <button
                      type="button"
                      className={quickBtn}
                      onClick={() => applyQuickAmount(quickAmounts.deliveryFee)}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wide text-orange-950">Delivery</span>
                      <span className="font-display text-xl font-black tabular-nums leading-tight text-orange-950">
                        Rs {fmtRs(quickAmounts.deliveryFee)}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div
            className="flex min-h-[5.5rem] flex-col justify-center rounded-2xl border-4 border-slate-200 bg-slate-50 px-4 py-4 text-right sm:min-h-[6rem]"
            aria-live="polite"
          >
            {buffer !== null && op ? (
              <p className="mb-1 truncate text-lg font-bold tabular-nums text-muted-foreground sm:text-xl">
                {buffer} {op}
              </p>
            ) : null}
            <p className="font-display text-4xl font-black tabular-nums leading-none tracking-tight text-foreground sm:text-5xl">
              {display}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 sm:gap-3.5">
            <Button type="button" variant="outline" className={cellAction} onClick={clearAll}>
              AC
            </Button>
            <Button type="button" variant="outline" className={cellAction} onClick={backspace}>
              <Delete className="mx-auto h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cellOp}
              title="With + or −: percent of first amount. With × or ÷: divide entry by 100. Alone: divide display by 100."
              aria-label="Percent"
              onClick={pressPercent}
            >
              %
            </Button>
            <Button type="button" variant="outline" className={cellOp} onClick={() => pressOp('/')}>
              ÷
            </Button>

            {(['7', '8', '9'] as const).map((d) => (
              <Button key={d} type="button" variant="secondary" className={cellNum} onClick={() => pressDigit(d)}>
                {d}
              </Button>
            ))}
            <Button type="button" variant="outline" className={cellOp} onClick={() => pressOp('*')}>
              ×
            </Button>

            {(['4', '5', '6'] as const).map((d) => (
              <Button key={d} type="button" variant="secondary" className={cellNum} onClick={() => pressDigit(d)}>
                {d}
              </Button>
            ))}
            <Button type="button" variant="outline" className={cellOp} onClick={() => pressOp('-')}>
              −
            </Button>

            {(['1', '2', '3'] as const).map((d) => (
              <Button key={d} type="button" variant="secondary" className={cellNum} onClick={() => pressDigit(d)}>
                {d}
              </Button>
            ))}
            <Button type="button" variant="outline" className={cellOp} onClick={() => pressOp('+')}>
              +
            </Button>

            <Button
              type="button"
              variant="secondary"
              className={cn(cellNum, 'col-span-2')}
              onClick={() => pressDigit('0')}
            >
              0
            </Button>
            <Button type="button" variant="secondary" className={cellNum} onClick={() => pressDigit('.')}>
              .
            </Button>
            <Button type="button" className={cellEquals} onClick={equals}>
              <Equal className="mx-auto h-8 w-8 sm:h-9 sm:w-9" strokeWidth={2.5} aria-hidden />
            </Button>
          </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
