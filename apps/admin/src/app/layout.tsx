import '@wrap-roll/shared-ui/src/app.css';
import { DOMAIN_ACCENT_CLASS } from '@wrap-roll/shared-ui';
import { AdminLayoutShell } from '../components/AdminLayoutShell';
import { Providers } from '../components/Providers';

export const metadata = {
  title: 'Wrap & Roll | Admin Management Dashboard',
  description: 'Management dashboard for Wrap & Roll restaurant operations.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={DOMAIN_ACCENT_CLASS.admin} suppressHydrationWarning>
        <Providers>
          <AdminLayoutShell>{children}</AdminLayoutShell>
        </Providers>
      </body>
    </html>
  );
}
