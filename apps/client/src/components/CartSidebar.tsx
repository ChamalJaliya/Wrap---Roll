'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useClientStore } from '../store/useClientStore';
import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  EmptyState,
} from '@wrap-roll/shared-ui';
import { ShoppingBasket } from 'lucide-react';
import { CartLineBreakdown } from './CartLineBreakdown';

interface CartSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
  open,
  onOpenChange,
}) => {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('Cart');
  const { cart, removeFromCart, updateQuantity, getTotalPrice } = useClientStore();

  const handleCheckoutRedirect = () => {
    onOpenChange(false);
    router.push(`/${locale}/checkout`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex h-full w-full max-w-[460px] flex-col gap-0 border-l border-white/50 bg-white/95 p-0 backdrop-blur-xl sm:max-w-[460px]"
      >
        <SheetHeader className="space-y-0 border-b border-neutral-100 bg-white px-8 py-8 text-left">
          <SheetTitle className="font-display text-3xl font-black text-neutral-900">
            {t('title')}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto bg-neutral-50 px-6 py-8 scrollbar-hide">
          {cart.length === 0 ? (
            <EmptyState
              title={t('emptyTitle')}
              description={t('emptyDescription')}
              icon={ShoppingBasket}
              action={
                <Button variant="outline" size="lg" className="rounded-full px-10 font-black uppercase tracking-widest transition-all hover:bg-primary hover:text-white" onClick={() => onOpenChange(false)}>
                  {t('goBrowsing')}
                </Button>
              }
            />
          ) : (
            cart.map((item) => (
              <div
                key={item.cartId}
                className="flex gap-6 rounded-[var(--radius-2xl)] border border-neutral-100 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-x-1 hover:border-[hsl(var(--primary)/0.25)]"
              >
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-[90px] w-[90px] shrink-0 rounded-[var(--radius-xl)] object-cover shadow-sm"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="mb-2 flex items-start gap-2">
                    <CartLineBreakdown item={item} compact className="min-w-0 flex-1" />
                    <button
                      type="button"
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-50 text-lg text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
                      onClick={() => removeFromCart(item.cartId)}
                      title={t('remove')}
                    >
                      &times;
                    </button>
                  </div>

                  <div className="mt-auto flex items-center justify-start">
                    <div className="flex items-center gap-4 rounded-full bg-neutral-100 p-1">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm transition-all hover:scale-110 hover:bg-primary hover:text-white"
                        onClick={() =>
                          updateQuantity(item.cartId, item.quantity - 1)
                        }
                      >
                        -
                      </button>
                      <span className="min-w-6 text-center font-display text-sm font-black">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black shadow-sm transition-all hover:scale-110 hover:bg-primary hover:text-white"
                        onClick={() =>
                          updateQuantity(item.cartId, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="sticky bottom-0 border-t border-neutral-100 bg-white/80 p-8 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)] max-md:p-6">
            <div className="mb-6 flex justify-between font-display text-2xl font-black text-neutral-900">
              <span className="tracking-tight">{t('subtotal')}</span>
              <span className="text-primary">{t('currency')} {getTotalPrice().toLocaleString()}</span>
            </div>
            <Button
              variant="default"
              size="lg"
              className="w-full h-16 rounded-[var(--radius-2xl)] text-base font-black uppercase tracking-widest shadow-xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-transform"
              onClick={handleCheckoutRedirect}
            >
              {t('checkoutNow')}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
