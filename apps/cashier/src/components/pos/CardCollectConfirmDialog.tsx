'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@wrap-roll/shared-ui';
import { CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import {
  POS_CARD_COLLECTION_SUPERVISOR_SCOPE,
} from '@wrap-roll/contracts';
import {
  parseSupervisorChallengeResponse,
  readJsonUnknown,
} from '../../lib/supervisor-session';
import { useSupervisorStore } from '../../store/useSupervisorStore';

const SUPERVISOR_HEADER = 'x-supervisor-elevation';

export type CardCollectConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountDueLkr: number;
  /** Counter Pay now — confirm terminal then place order (no `mark-payment-received`). */
  onCheckoutConfirmed?: () => void | Promise<void>;
  /** Collect flow — PATCH payment on existing order. Omit when `onCheckoutConfirmed` is set. */
  orderId?: string;
  /** From settings `paymentConfig.pos.requireSupervisorForCardCollection` (collect flow only). */
  requireSupervisorElevation?: boolean;
  /** ADMIN session bypasses supervisor token server-side — hide PIN section. */
  bypassSupervisorAsAdmin?: boolean;
  isOnline?: boolean;
  fetchProtectedNest?: (url: string, init?: RequestInit) => Promise<Response>;
  /** Prefill supervisor email from manager tools. */
  supervisorEmailDefault?: string;
  /** Called with Nest response body after a successful PATCH (parent patches queue row). */
  onRecorded?: (orderId: string, responseBody: unknown) => void | Promise<void>;
};

export function CardCollectConfirmDialog({
  open,
  onOpenChange,
  orderId = '',
  amountDueLkr,
  requireSupervisorElevation = false,
  bypassSupervisorAsAdmin = false,
  isOnline = true,
  fetchProtectedNest,
  supervisorEmailDefault = '',
  onRecorded,
  onCheckoutConfirmed,
}: CardCollectConfirmDialogProps) {
  const isCheckout = typeof onCheckoutConfirmed === 'function';
  const [terminalApproved, setTerminalApproved] = useState(false);
  const [terminalRef, setTerminalRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [challengeBusy, setChallengeBusy] = useState(false);
  const [supervisorEmail, setSupervisorEmail] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');

  const cardCollectionElevation = useSupervisorStore((s) => s.cardCollectionElevation);
  const setCardCollectionElevation = useSupervisorStore((s) => s.setCardCollectionElevation);
  const getValidCardCollectionElevation = useSupervisorStore(
    (s) => s.getValidCardCollectionElevation,
  );

  useEffect(() => {
    if (open) {
      setTerminalApproved(false);
      setTerminalRef('');
      setBusy(false);
      setSupervisorPin('');
      setSupervisorEmail((prev) => (prev.trim() ? prev : supervisorEmailDefault.trim()));
    }
  }, [open, amountDueLkr, orderId, supervisorEmailDefault]);

  const needSupervisorUi =
    !isCheckout && requireSupervisorElevation && !bypassSupervisorAsAdmin && isOnline;

  const supervisorReady = useMemo(() => {
    if (!needSupervisorUi) return true;
    return Boolean(getValidCardCollectionElevation()?.token);
  }, [needSupervisorUi, getValidCardCollectionElevation, cardCollectionElevation?.token]);

  const verifySupervisor = async () => {
    const email = supervisorEmail.trim();
    const pin = supervisorPin;
    if (!email || !pin) {
      toast.error('Enter supervisor email and PIN.');
      return;
    }
    setChallengeBusy(true);
    try {
      const res = await fetchProtectedNest!('/api/nest/supervisor/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorEmail: email,
          pin,
          scope: POS_CARD_COLLECTION_SUPERVISOR_SCOPE,
        }),
      });
      const raw = await readJsonUnknown(res);
      const parsed = parseSupervisorChallengeResponse(raw);
      if (!res.ok || !parsed.ok) {
        const fallback = !res.ok
          ? `Supervisor authentication failed (${res.status})`
          : 'Supervisor authentication failed';
        toast.error(fallback);
        setCardCollectionElevation(null);
        return;
      }
      setCardCollectionElevation({
        token: parsed.elevationToken,
        expiresAt: parsed.expiresAt,
      });
      setSupervisorPin('');
      toast.success('Manager approved for card collection.');
    } catch {
      toast.error('Could not reach supervisor service.');
      setCardCollectionElevation(null);
    } finally {
      setChallengeBusy(false);
    }
  };

  const recordPayment = async () => {
    if (!terminalApproved) {
      toast.error('Confirm that the terminal approved this amount.');
      return;
    }
    if (needSupervisorUi && !supervisorReady) {
      toast.error('Verify supervisor email and PIN first.');
      return;
    }
    if (isCheckout) {
      setBusy(true);
      try {
        await onCheckoutConfirmed?.();
        onOpenChange(false);
      } finally {
        setBusy(false);
      }
      return;
    }
    const noteParts = ['Collected via card at cashier handoff'];
    const ref = terminalRef.trim();
    if (ref) noteParts.push(`Terminal ref: ${ref}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const elev = getValidCardCollectionElevation();
    if (needSupervisorUi && elev?.token) {
      headers[SUPERVISOR_HEADER] = elev.token;
    }

    setBusy(true);
    try {
      const res = await fetchProtectedNest!(`/api/nest/orders/${orderId}/mark-payment-received`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          method: 'card',
          note: noteParts.join(' · '),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(String(err?.message ?? 'Could not record card payment'));
        return;
      }
      const body = await res.json().catch(() => null);
      toast.success('Card payment collected.');
      await onRecorded!(orderId, body);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  /** Matches cashier sidebar / Cash & change: `Rs 2863.50` (no comma — avoids layout shift). */
  const fmtLkr = (n: number) => `Rs ${n.toFixed(2)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden rounded-[28px] border-2 border-border/80 p-0 shadow-2xl sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-background px-5 pb-4 pt-5 sm:px-7 sm:pb-5 sm:pt-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-black tracking-tight sm:text-2xl">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <CreditCard className="h-6 w-6" aria-hidden />
            </span>
            <span className="leading-tight">
              {isCheckout ? 'Confirm card (Pay now)' : 'Record card payment'}
            </span>
          </DialogTitle>
          <DialogDescription className="text-left text-base leading-snug text-muted-foreground">
            {isCheckout ? (
              <>
                Same discipline as collecting on an order — run the terminal first, confirm approval for
                this total, then the order is placed as paid.
              </>
            ) : (
              <>
                Run the sale on your bank terminal first. This step only updates{' '}
                <span className="font-semibold text-foreground">Wrap & Roll</span> after the terminal
                shows approved.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
          <div className="rounded-2xl border-2 border-primary/25 bg-gradient-to-br from-primary/[0.08] to-background px-5 py-5 text-center sm:px-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary/90">
              {isCheckout ? 'Total due (this cart)' : 'Amount to match on terminal'}
            </p>
            <p className="mt-2 font-display text-4xl font-black tabular-nums tracking-tight text-foreground sm:text-[2.75rem]">
              {fmtLkr(amountDueLkr)}
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3.5 touch-manipulation">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 shrink-0 accent-primary"
              checked={terminalApproved}
              onChange={(e) => setTerminalApproved(e.target.checked)}
            />
            <span className="text-sm font-semibold leading-snug">
              The terminal showed <strong>approved</strong> for this amount (or I corrected the
              terminal to match).
            </span>
          </label>

          <div className="grid gap-2">
            <Label htmlFor="card-terminal-ref" className="text-xs font-semibold">
              Terminal / auth reference (optional)
            </Label>
            <Input
              id="card-terminal-ref"
              value={terminalRef}
              onChange={(e) => setTerminalRef(e.target.value)}
              placeholder="e.g. auth code, batch ID — helps audits"
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>

          {needSupervisorUi ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-3 py-3 dark:bg-amber-950/20">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-950 dark:text-amber-200">
                Manager approval required
              </p>
              {!isOnline ? (
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  Connect to the internet to verify a supervisor.
                </p>
              ) : (
                <>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label className="text-[11px]">Supervisor email</Label>
                      <Input
                        value={supervisorEmail}
                        onChange={(e) => setSupervisorEmail(e.target.value)}
                        type="email"
                        autoComplete="username"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px]">PIN</Label>
                      <Input
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        type="password"
                        autoComplete="current-password"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={challengeBusy}
                      onClick={() => void verifySupervisor()}
                    >
                      {challengeBusy ? 'Verifying…' : 'Verify manager'}
                    </Button>
                    {supervisorReady ? (
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        Approved for this session
                      </span>
                    ) : (
                      <span className="text-xs text-amber-900/90 dark:text-amber-100/90">
                        Required before recording card payment.
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : requireSupervisorElevation && bypassSupervisorAsAdmin ? (
            <p className="text-xs text-muted-foreground">
              Admin session — supervisor PIN is not required to record card payment.
            </p>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3 border-t border-border/50 pt-5">
            <Button
              type="button"
              variant="outline"
              className="min-h-12 rounded-xl px-6 font-semibold shadow-sm transition active:scale-[0.99]"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !terminalApproved ||
                (needSupervisorUi && (!supervisorReady || !isOnline))
              }
              onClick={() => void recordPayment()}
              className="min-h-12 min-w-[140px] rounded-xl px-6 font-bold shadow-md transition active:scale-[0.99]"
            >
              {busy ? (isCheckout ? 'Placing…' : 'Recording…') : isCheckout ? 'Place order' : 'Record in POS'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
