'use client';

import { usePathname, useRouter } from 'next/navigation';
import { AppShell } from '@wrap-roll/shared-ui';
import { Sidebar } from './Sidebar';
import { AdminAuthGate } from './AdminAuthGate';
import { AdminAuthService } from '../lib/auth';

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthRoute = pathname.startsWith('/auth');

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <AdminAuthGate>
      <AppShell
        sidebar={
          <Sidebar
            onLogout={async () => {
              await AdminAuthService.signOut();
              router.replace('/auth/signin');
            }}
          />
        }
      >
        {children}
      </AppShell>
    </AdminAuthGate>
  );
}
