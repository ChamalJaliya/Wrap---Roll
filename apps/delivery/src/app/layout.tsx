import '@wrap-roll/shared-ui/src/app.css';
import { DOMAIN_ACCENT_CLASS } from '@wrap-roll/shared-ui';
import { Toaster } from 'sonner';

export const metadata = {
  title: 'Wrap & Roll | Delivery Dispatch',
  description: 'Courier Dispatch interface for Wrap & Roll',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={DOMAIN_ACCENT_CLASS.delivery}>
        <Toaster richColors position="top-right" />
        {children}
      </body>
    </html>
  );
}
