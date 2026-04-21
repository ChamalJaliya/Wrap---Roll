'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { OrderService } from '@/services/api';
import { Button, Input, Label, PageHeroHeader } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import {
  clientContentWideClass,
  clientGlassPanelFlatClass,
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
    } catch (e: any) {
      setError(
        String(e?.response?.data?.message ?? e?.message ?? 'Unable to track order'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <PageHeroHeader
          title="Track Your Order"
          subtitle="Enter your order ID and checkout phone number."
        />
        <div className="mx-auto max-w-2xl">
          <div className={cn(clientGlassPanelFlatClass, 'space-y-4')}>
            <h2 className={cn(clientSectionTitleClass, 'text-xl text-neutral-900')}>
              Order Lookup
            </h2>
            <div className="grid gap-2">
              <Label>Order ID</Label>
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Paste your order ID"
              />
            </div>
            <div className="grid gap-2">
              <Label>Phone Number</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Use the phone used at checkout"
              />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button onClick={submit} disabled={loading} className="w-full">
              {loading ? 'Checking...' : 'Track order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
