import { ReactNode } from 'react';

interface DashboardLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function DashboardLayout({ sidebar, children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <main className="flex-1 overflow-y-auto bg-page-bg">
        {children}
      </main>
    </div>
  );
}
