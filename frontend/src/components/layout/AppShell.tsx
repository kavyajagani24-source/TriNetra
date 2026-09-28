import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useStore } from "@/state/app-store";

export function AppShell({ children }: { children: ReactNode }) {
  const { demoMode, setDemoMode } = useStore();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-sans text-foreground antialiased">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {demoMode && (
          <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="font-bold">DEMO MODE ACTIVE:</span>
              <span className="truncate text-amber-800 dark:text-amber-300">
                Displaying curated benchmark dataset (Andheri West sample). Live video runs are saved to Live Mode.
              </span>
            </div>
            <button
              onClick={() => setDemoMode(false)}
              className="ml-3 shrink-0 inline-flex items-center gap-1 font-semibold underline hover:text-amber-950 dark:hover:text-white cursor-pointer"
            >
              Switch to Live Mode <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
        <TopBar />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background p-3 sm:p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
