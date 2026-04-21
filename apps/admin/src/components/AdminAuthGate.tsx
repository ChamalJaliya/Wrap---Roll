'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DataPanel } from '@wrap-roll/shared-ui';
import { AdminAuthService } from '../lib/auth';

type GateState = 'checking' | 'allowed';

export function AdminAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      const { session } = await AdminAuthService.getSession();
      if (!session) {
        router.replace(`/auth/signin?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }

      const { role } = await AdminAuthService.getUserRole();
      if (role !== 'ADMIN') {
        await AdminAuthService.signOut();
        router.replace('/auth/signin?error=forbidden');
        return;
      }

      if (mounted) {
        setState('allowed');
      }
    };

    verify();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (state !== 'allowed') {
    return (
      <div className="mx-auto flex min-h-[40vh] w-full max-w-md items-center justify-center px-4">
        <DataPanel className="w-full">
          <div className="flex items-center gap-3 rounded-xl border bg-white px-5 py-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium text-slate-600">Checking admin access...</span>
          </div>
        </DataPanel>
        </div>
    );
  }

  return <>{children}</>;
}
