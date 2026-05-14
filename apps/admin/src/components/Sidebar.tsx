'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BarChart2,
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu as MenuIcon,
  Package,
  Percent,
  Sandwich,
  ScrollText,
  Settings,
  Star,
  Tag,
  Users,
  UserRound,
} from 'lucide-react';
import { Button, cn, SidebarClock } from '@wrap-roll/shared-ui';
import { AdminAuthService } from '../lib/auth';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Menu', href: '/menu', icon: MenuIcon },
  { name: 'Analytics', href: '/analytics', icon: BarChart2 },
  { name: 'Orders', href: '/orders', icon: ListOrdered },
  { name: 'Activity', href: '/activity', icon: ScrollText },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Customers', href: '/customers', icon: UserRound },
  { name: 'Coupons', href: '/coupons', icon: Tag },
  { name: 'Dish reviews', href: '/dish-reviews', icon: Star },
  { name: 'Tax & delivery', href: '/pricing', icon: Percent },
  { name: 'Staff', href: '/staff', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function navActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminWordmark({ sessionEmail }: { sessionEmail: string | null }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <div
        className="mt-1 h-[2.75rem] w-1 shrink-0 rounded-full bg-gradient-to-b from-primary to-[hsl(22_88%_44%)] shadow-sm"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="font-display text-[15px] font-black leading-[1.15] tracking-tight">
          <span className="text-primary">Wrap</span>
          <span className="text-foreground"> &amp; Roll</span>
        </p>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Admin</p>
        <p
          className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground"
          title={sessionEmail ?? 'Admin session'}
        >
          {sessionEmail ?? 'Admin session'}
        </p>
      </div>
    </div>
  );
}

type SidebarProps = {
  onLogout?: () => void | Promise<void>;
};

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AdminAuthService.getCurrentUser().then(({ user }) => {
      if (!cancelled) setSessionEmail(user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside
      className={cn(
        'sticky top-0 z-40 flex h-screen max-h-screen shrink-0 touch-manipulation flex-col self-start overflow-x-hidden overflow-y-hidden border-r border-border/80 bg-white shadow-sm transition-[width] duration-200 ease-out',
        collapsed ? 'w-[88px] px-2 py-4' : 'w-[320px] px-3 py-4',
      )}
    >
      {!collapsed ? (
        <div className="mb-4 shrink-0 rounded-2xl border border-border/70 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <AdminWordmark sessionEmail={sessionEmail} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 touch-manipulation rounded-xl text-slate-600 hover:bg-slate-100 hover:text-foreground"
              onClick={() => setCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </Button>
          </div>
          <div className="mt-3 border-t border-border/50 pt-3">
            <SidebarClock />
          </div>
        </div>
      ) : (
        <div className="mb-4 flex shrink-0 flex-col items-center gap-3">
          <div
            className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(22_88%_44%)] shadow-md ring-1 ring-black/[0.06]"
            title="Wrap & Roll Admin"
            aria-label="Wrap & Roll Admin"
          >
            <Sandwich className="h-[26px] w-[26px] text-primary-foreground" strokeWidth={2.35} aria-hidden />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 touch-manipulation rounded-xl text-slate-600 hover:bg-slate-100 hover:text-foreground"
            onClick={() => setCollapsed(false)}
            title="Expand sidebar"
            aria-label="Expand sidebar — show full navigation labels"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2.25} aria-hidden />
          </Button>
          <SidebarClock compact />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-0 pb-1 [-webkit-overflow-scrolling:touch]">
        <nav
          className={cn(
            'flex shrink-0 flex-col',
            collapsed ? 'items-center space-y-3 px-0' : 'space-y-2 rounded-2xl border border-border/50 bg-white p-2 shadow-sm',
          )}
          aria-label="Primary navigation"
        >
          {navItems.map((item) => {
            const active = navActive(pathname, item.href);
            const Icon = item.icon;
            const activeCls = active
              ? 'bg-primary !text-primary-foreground shadow-sm ring-2 ring-inset ring-white/25 [&_svg]:!text-primary-foreground'
              : 'text-slate-800 hover:bg-slate-100 active:bg-slate-200/80 [&_svg]:text-slate-800';

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                title={collapsed ? item.name : undefined}
                className={cn(
                  'touch-manipulation rounded-2xl text-base font-semibold transition active:scale-[0.97]',
                  collapsed
                    ? `flex h-[52px] w-[52px] shrink-0 items-center justify-center ${activeCls}`
                    : `flex min-h-[52px] w-full max-w-full items-center gap-3 px-3 py-2.5 text-left active:scale-[0.99] ${activeCls}`,
                )}
              >
                <span className={cn('flex shrink-0 items-center justify-center', collapsed ? '' : 'w-9')}>
                  <Icon size={22} strokeWidth={active ? 2.25 : 2} aria-hidden />
                </span>
                {collapsed ? null : <span className="min-w-0 flex-1 leading-snug">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="relative z-10 mt-auto shrink-0 border-t border-border/80 bg-white pt-4">
        <button
          type="button"
          onClick={() => void onLogout?.()}
          title={collapsed ? 'Logout' : undefined}
          aria-label={collapsed ? 'Logout' : undefined}
          className={cn(
            'relative flex w-full touch-manipulation items-center rounded-2xl font-semibold text-slate-700 transition hover:bg-red-500/10 hover:text-red-600 active:scale-[0.99]',
            collapsed ? 'h-[52px] justify-center px-0 py-2' : 'min-h-[52px] gap-3 px-3 py-2.5 text-left',
          )}
        >
          <LogOut className="relative z-[1] h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          {collapsed ? null : <span className="leading-snug">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
