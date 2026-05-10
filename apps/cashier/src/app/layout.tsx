import '@wrap-roll/shared-ui/src/app.css';
import './orders-scroll.css';
import { DOMAIN_ACCENT_CLASS } from '@wrap-roll/shared-ui';
import { DisableServiceWorker } from '../components/DisableServiceWorker';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'Wrap & Roll - Cashier POS',
  description: 'Smart Cashier Terminal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={DOMAIN_ACCENT_CLASS.cashier} suppressHydrationWarning>
        <DisableServiceWorker />
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}
