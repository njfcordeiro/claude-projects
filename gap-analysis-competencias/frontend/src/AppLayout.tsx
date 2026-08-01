import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ShellBar } from './components/layout/ShellBar';
import { SideNav } from './components/layout/SideNav';
import { MobileNavDrawer } from './components/layout/MobileNavDrawer';

export function AppLayout() {
  const [drawerAberto, setDrawerAberto] = useState(false);

  return (
    <div className="app-shell flex h-screen flex-col">
      <div className="no-print">
        <ShellBar onMenuClick={() => setDrawerAberto(true)} />
      </div>
      <div className="no-print">
        <MobileNavDrawer aberto={drawerAberto} onClose={() => setDrawerAberto(false)} />
      </div>
      <div className="app-body flex flex-1 overflow-hidden">
        <div className="no-print">
          <SideNav />
        </div>
        <main className="app-main flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
