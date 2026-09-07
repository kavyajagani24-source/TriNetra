import { useStore, type DemoEvent } from "@/state/app-store";

export const DEMO_EVENTS: { kind: DemoEvent; label: string }[] = [
  { kind: "pothole", label: "Simulate new pothole detection" },
  { kind: "congestion", label: "Simulate congestion spike" },
  { kind: "waterlogging", label: "Simulate waterlogging alert" },
  { kind: "incident", label: "Simulate incident candidate" },
  { kind: "bus_offline", label: "Simulate bus going offline" },
  { kind: "verification", label: "Simulate repair verification" },
];

export function useStoreDemo() {
  const { demoEvent } = useStore();
  return { events: DEMO_EVENTS, fire: demoEvent };
}
