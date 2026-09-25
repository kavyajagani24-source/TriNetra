import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-slate-100 p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
