'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BarChart2,
  ChevronLeft,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ListOrdered,
  ScrollText,
  Bell,
  Package,
  Percent,
  Settings,
  Tag,
  Users,
  UserRound,
} from 'lucide-react';

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
  { name: 'Tax & delivery', href: '/pricing', icon: Percent },
  { name: 'Staff', href: '/staff', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

type SidebarProps = {
  onLogout?: () => void | Promise<void>;
};

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`min-h-screen border-r border-slate-800 bg-[#07122E] text-slate-200 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
    >
      <div className="flex h-20 items-center justify-between border-b border-slate-800 px-5">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-white">
            W&R
          </div>
          {!isCollapsed ? <h1 className="text-2xl font-extrabold text-white">Admin</h1> : null}
        </div>
        <button
          type="button"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`group flex items-center rounded-xl px-3 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-primary/20 text-white ring-1 ring-primary/40'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              } ${isCollapsed ? 'justify-center' : 'gap-3'}`}
            >
              <item.icon className="h-5 w-5 shrink-0 transition-transform group-hover:scale-110" />
              {!isCollapsed ? <span className="font-medium">{item.name}</span> : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={() => void onLogout?.()}
          className={`flex w-full items-center rounded-xl px-3 py-3 text-slate-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 ${isCollapsed ? 'justify-center' : 'gap-3'}`}
          title={isCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed ? <span className="font-medium">Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
