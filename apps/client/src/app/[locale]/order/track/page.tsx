'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { PackageSearch } from 'lucide-react';
import { OrderService } from '@/services/api';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import { surfaceInputClass } from '@/lib/client-field-styles';
import {
  clientAccountStackClass,
  clientContentWideClass,
  clientElevatedCardClass,
  clientElevatedCardHeaderClass,
  clientFormLabelClass,
  clientHeroGradientOrbClass,
  clientHeroGradientOrbSecondaryClass,
  clientHeroGradientShellClass,
  clientPageShellClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';

export default function TrackOrderPage() {
  const router = useRouter();
  const locale = useLocale();
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!orderId.trim() || !phone.trim()) {
      setError('Enter order ID and phone number.');
      return;
    }
    setLoading(true);
    try {
      const data = await OrderService.trackOrder(orderId.trim(), phone.trim());
      if (typeof window !== 'undefined') {
        localStorage.setItem('last_order_phone', phone.trim());
      }
      router.push(`/${locale}/order/success?id=${encodeURIComponent(data.id)}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: unknown } }; message?: string };
      setError(String(err?.response?.data?.message ?? err?.message ?? 'Unable to track order'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <header className={clientHeroGradientShellClass}>
            <div className={clientHeroGradientOrbClass} aria-hidden />
            <div className={clientHeroGradientOrbSecondaryClass} aria-hidden />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">Order status</p>
                <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">Track your order</h1>
                <p className="mt-3 text-sm leading-relaxed text-white/75">
                  Use the order ID from your confirmation and the phone number you used at checkout. We will open your
                  live status page.
                </p>
              </div>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm lg:h-20 lg:w-20">
                <PackageSearch className="h-8 w-8 text-orange-200 lg:h-10 lg:w-10" aria-hidden />
              </div>
            </div>
          </header>

          <div className="mx-auto w-full max-w-2xl">
            <Card className={clientElevatedCardClass}>
              <CardHeader className={clientElevatedCardHeaderClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">Lookup</p>
                <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                  Find your order
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Both fields must match what you used when you placed the order.</p>
              </CardHeader>
              <CardContent className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
                <div className="grid gap-2">
                  <Label htmlFor="track-order-id" className={clientFormLabelClass}>
                    Order ID
                  </Label>
                  <Input
                    id="track-order-id"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="Paste your order ID"
                    className={surfaceInputClass}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="track-phone" className={clientFormLabelClass}>
                    Phone number
                  </Label>
                  <Input
                    id="track-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Same phone as checkout"
                    className={surfaceInputClass}
                    type="tel"
                    autoComplete="tel"
                  />
                </div>
                {error ? (
                  <p className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                    {error}
                  </p>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void submit()}
                  disabled={loading}
                  className="w-full rounded-full py-6 text-base font-bold shadow-md sm:py-5"
                >
                  {loading ? 'Checking…' : 'Track order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
