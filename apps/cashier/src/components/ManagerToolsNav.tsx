'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Shield, ChevronDown } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@wrap-roll/shared-ui';
import { toast } from 'sonner';
import {
  isElevationExpired,
  parseSupervisorChallengeResponse,
  readJsonUnknown,
} from '../lib/supervisor-session';
import { useSupervisorStore } from '../store/useSupervisorStore';

type Props = {
  drawerCollapsed: boolean;
  isOnline: boolean;
  fetchProtectedNest: (url: string, init?: RequestInit) => Promise<Response>;
};

/** Sidebar: supervisor sign-in + session status only. Privileged controls render in-context (checkout, etc.). */
export function ManagerToolsNav({ drawerCollapsed, isOnline, fetchProtectedNest }: Props) {
  const elevation = useSupervisorStore((s) => s.elevation);
  const setElevation = useSupervisorStore((s) => s.setElevation);
  const clearExpiredElevation = useSupervisorStore((s) => s.clearExpiredElevation);
  const setSupervisorPinInput = useSupervisorStore((s) => s.setSupervisorPinInput);
  const supervisorEmailInput = useSupervisorStore((s) => s.supervisorEmailInput);
  const setSupervisorEmailInput = useSupervisorStore((s) => s.setSupervisorEmailInput);
  const supervisorPinInput = useSupervisorStore((s) => s.supervisorPinInput);

  const sessionActive = Boolean(elevation && !isElevationExpired(elevation));

  useLayoutEffect(() => {
    clearExpiredElevation();
  }, [elevation, clearExpiredElevation]);

  const [challengeLoading, setChallengeLoading] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const challengeAbortRef = useRef<AbortController | null>(null);

  useLayoutEffect(
    () => () => {
      challengeAbortRef.current?.abort();
    },
    [],
  );

  const endManagerSession = () => {
    setElevation(null);
    toast.success('Manager session ended.');
  };

  const handleSupervisorChallenge = async () => {
    const email = supervisorEmailInput.trim();
    const pin = supervisorPinInput;
    if (!email || !pin) {
      toast.error('Enter supervisor email and PIN.');
      return;
    }
    if (!isOnline) {
      toast.error('Connect to the internet to verify supervisor.');
      return;
    }
    challengeAbortRef.current?.abort();
    const ac = new AbortController();
    challengeAbortRef.current = ac;
    setChallengeLoading(true);
    try {
      const res = await fetchProtectedNest('/api/nest/supervisor/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorEmail: email,
          pin,
          scope: 'privileged_operations',
        }),
        signal: ac.signal,
      });
      const raw = await readJsonUnknown(res);
      const parsed = parseSupervisorChallengeResponse(raw);
      if (!res.ok || !parsed.ok) {
        const fallback = !res.ok
          ? `Supervisor authentication failed (${res.status})`
          : 'Supervisor authentication failed';
        const msg =
          !parsed.ok &&
          typeof parsed.message === 'string' &&
          parsed.message.trim()
            ? parsed.message.trim()
            : fallback;
        toast.error(msg);
        setElevation(null);
        return;
      }
      setElevation({
        token: parsed.elevationToken,
        expiresAt: parsed.expiresAt,
      });
      setSupervisorPinInput('');
      toast.success('Supervisor unlocked.');
      setDialogOpen(false);
      setUnlockOpen(false);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      toast.error('Could not reach supervisor service');
      setElevation(null);
    } finally {
      setChallengeLoading(false);
    }
  };

  const unlockFields = (
    <div className="grid gap-3">
      <input
        type="email"
        className="h-12 touch-manipulation rounded-xl border border-input bg-background px-3 text-base shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        placeholder="Supervisor email"
        value={supervisorEmailInput}
        onChange={(e) => {
          setSupervisorEmailInput(e.target.value);
          setElevation(null);
        }}
        autoComplete="off"
        disabled={challengeLoading}
      />
      <input
        type="password"
        className="h-12 touch-manipulation rounded-xl border border-input bg-background px-3 text-base shadow-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        placeholder="PIN"
        value={supervisorPinInput}
        onChange={(e) => {
          setSupervisorPinInput(e.target.value);
          setElevation(null);
        }}
        autoComplete="new-password"
        disabled={challengeLoading}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="min-h-12 w-full touch-manipulation text-base font-semibold"
        disabled={
          challengeLoading || !supervisorEmailInput.trim() || !supervisorPinInput || !isOnline
        }
        onClick={() => void handleSupervisorChallenge()}
      >
        {challengeLoading ? '…' : 'Unlock'}
      </Button>
      {!isOnline ? (
        <p className="text-[10px] text-muted-foreground">Requires network.</p>
      ) : null}
    </div>
  );

  const sessionPanel =
    sessionActive && elevation ? (
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900/90">
            Session
          </span>
          <span className="text-[11px] tabular-nums text-emerald-800">
            Until{' '}
            {elevation.expiresAt ? new Date(elevation.expiresAt).toLocaleTimeString() : '—'}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed text-emerald-900/80">
          Privileged actions appear next to where they apply — e.g. manual discount on checkout. More tools will follow
          the same pattern.
        </p>
      </div>
    ) : null;

  const managerDialog = (
    <>
      <div className="border-b border-border/70 bg-muted/30 px-6 pb-4 pt-6 sm:px-7 sm:pb-5 sm:pt-7">
        <DialogHeader className="space-y-1.5 pr-10 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">
            {sessionActive ? 'Manager session' : 'Manager'}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            {sessionActive
              ? 'You are signed in. Use supervisor controls on checkout and other screens when available.'
              : 'Sign in with supervisor credentials to unlock privileged actions on this device.'}
          </DialogDescription>
        </DialogHeader>
      </div>
      <div className="space-y-4 px-6 py-5 sm:px-7 sm:py-6">
        {!sessionActive ? unlockFields : sessionPanel}
        {sessionActive ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={endManagerSession}
          >
            End manager session
          </Button>
        ) : null}
      </div>
    </>
  );

  if (drawerCollapsed) {
    return (
      <>
        <div className="px-0 pb-1 pt-2">
          <button
            type="button"
            className={`relative flex min-h-[52px] w-full touch-manipulation items-center justify-center rounded-2xl transition active:scale-[0.99] ${
              sessionActive
                ? 'bg-emerald-100 text-emerald-900 shadow-sm hover:bg-emerald-200/90'
                : 'text-slate-700 hover:bg-muted'
            }`}
            title={sessionActive ? 'Manager session active' : 'Manager sign-in'}
            aria-label={sessionActive ? 'Manager session active' : 'Manager sign-in'}
            onClick={() => setDialogOpen(true)}
          >
            <Shield size={22} strokeWidth={2} aria-hidden />
            {sessionActive ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            ) : null}
          </button>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-2xl border-border/80 p-0 shadow-xl sm:max-w-[420px]">
            {managerDialog}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="border-t border-border/80 pb-2 pt-4">
      {!sessionActive ? (
        <div className="rounded-2xl border border-border/80 bg-muted/25">
          <button
            type="button"
            className="flex min-h-[52px] w-full touch-manipulation items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-base font-semibold text-slate-800 outline-none transition hover:bg-muted/50 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-expanded={unlockOpen}
            onClick={() => setUnlockOpen((v) => !v)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Shield size={22} className="shrink-0 text-slate-600" aria-hidden />
              <span className="truncate">Manager</span>
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${unlockOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {unlockOpen ? (
            <div className="border-t border-border/60 px-3 pb-4 pt-3">{unlockFields}</div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/60 px-4 py-3 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Shield size={22} className="text-emerald-800" aria-hidden />
            <span className="text-sm font-bold uppercase tracking-wide text-emerald-900">Manager</span>
            <span className="ml-auto rounded-full bg-emerald-600/15 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              Active
            </span>
          </div>
          <p className="text-xs leading-relaxed text-emerald-900/80">
            Checkout and other screens show privileged tools while this session is active.
          </p>
          <p className="mt-2 text-xs tabular-nums text-emerald-800">
            Until{' '}
            {elevation?.expiresAt ? new Date(elevation.expiresAt).toLocaleTimeString() : '—'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 min-h-11 w-full touch-manipulation text-sm font-semibold"
            onClick={endManagerSession}
          >
            End manager session
          </Button>
        </div>
      )}
    </div>
  );
}
