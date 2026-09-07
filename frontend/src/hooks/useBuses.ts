import { useCallback, useEffect, useState } from "react";
import { createBus, deleteBus, getBuses, updateBus } from "@/services/api/buses";
import { MOCK_BUSES } from "@/mocks/buses";
import { useAppStore } from "@/store/appStore";
import type { BackendBus, BusCreatePayload, BusUpdatePayload } from "@/types/api";

export function useBuses(statusFilter?: string) {
  const { demoMode, setBackendOnline } = useAppStore();
  const [buses, setBuses] = useState<BackendBus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (demoMode) {
      setTimeout(() => {
        const filtered = statusFilter
          ? MOCK_BUSES.filter((b) => b.status === statusFilter)
          : MOCK_BUSES;
        setBuses(filtered);
        setLoading(false);
      }, 150);
      return;
    }

    try {
      const res = await getBuses({ status: statusFilter, limit: 100 });
      setBuses(res.data);
      setBackendOnline(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load buses from backend.";
      setError(msg);
      setBackendOnline(false);
      // Fallback to mock data on backend failure
      const filtered = statusFilter
        ? MOCK_BUSES.filter((b) => b.status === statusFilter)
        : MOCK_BUSES;
      setBuses(filtered);
    } finally {
      setLoading(false);
    }
  }, [demoMode, statusFilter, setBackendOnline]);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  const handleCreate = async (payload: BusCreatePayload) => {
    if (demoMode) {
      const newBus: BackendBus = {
        id: `demo-bus-${Date.now()}`,
        bus_number: payload.bus_number,
        registration_number: payload.registration_number,
        route_number: payload.route_number,
        status: payload.status || "ACTIVE",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setBuses((prev) => [newBus, ...prev]);
      return newBus;
    }
    const created = await createBus(payload);
    await fetchBuses();
    return created;
  };

  const handleUpdate = async (id: string, payload: BusUpdatePayload) => {
    if (demoMode) {
      setBuses((prev) =>
        prev.map((b) =>
          b.id === id ? { ...b, ...payload, updated_at: new Date().toISOString() } : b
        )
      );
      return buses.find((b) => b.id === id);
    }
    const updated = await updateBus(id, payload);
    await fetchBuses();
    return updated;
  };

  const handleDelete = async (id: string) => {
    if (demoMode) {
      setBuses((prev) => prev.filter((b) => b.id !== id));
      return;
    }
    await deleteBus(id);
    await fetchBuses();
  };

  return {
    buses,
    loading,
    error,
    refresh: fetchBuses,
    createBus: handleCreate,
    updateBus: handleUpdate,
    deleteBus: handleDelete,
  };
}
