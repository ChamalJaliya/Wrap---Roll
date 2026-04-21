import type { ReactNode } from 'react';

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  return (
    <div className="app-shell">
      {sidebar}
      <main className="main-content">{children}</main>
    </div>
  );
}
