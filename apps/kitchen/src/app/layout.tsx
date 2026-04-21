import '@wrap-roll/shared-ui/src/app.css';
import { DOMAIN_ACCENT_CLASS } from '@wrap-roll/shared-ui';

export const metadata = {
  title: 'Wrap & Roll | Kitchen Display System',
  description: 'Kitchen Display System for Wrap & Roll',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={DOMAIN_ACCENT_CLASS.kitchen}>{children}</body>
    </html>
  );
}
