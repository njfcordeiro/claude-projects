import { Outlet } from 'react-router-dom';
import { ShellBar } from './components/layout/ShellBar';
import { SideNav } from './components/layout/SideNav';

export function AppLayout() {
  return (
    <div className="app-shell flex h-screen flex-col">
      <div className="no-print">
        <ShellBar />
      </div>
      <div className="app-body flex flex-1 overflow-hidden">
        <div className="no-print">
          <SideNav />
        </div>
        <main className="app-main flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
