import { Outlet } from 'react-router-dom';
import { ShellBar } from './components/layout/ShellBar';
import { SideNav } from './components/layout/SideNav';

export function AppLayout() {
  return (
    <div className="flex h-screen flex-col">
      <ShellBar />
      <div className="flex flex-1 overflow-hidden">
        <SideNav />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
