import { useAppStore } from "@/store/appStore";

export function useDemoMode() {
  const { demoMode, setDemoMode, toggleDemoMode, backendOnline } = useAppStore();

  return {
    isDemoMode: demoMode,
    backendOnline,
    enableDemoMode: () => setDemoMode(true),
    disableDemoMode: () => setDemoMode(false),
    toggleDemoMode,
  };
}
