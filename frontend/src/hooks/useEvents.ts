import { useCallback, useEffect, useState } from "react";
import { getEvents, getEventStatistics, getVideoEvents } from "@/services/api/events";
import { MOCK_EVENTS } from "@/mocks/events";
import { useAppStore } from "@/store/appStore";
import type { BackendEventStatistics, BackendUrbanEvent } from "@/types/api";

export interface UseEventsFilters {
  videoId?: string;
  category?: string;
  eventType?: string;
  severity?: string;
  page?: number;
  limit?: number;
}

export function useEvents(filters?: UseEventsFilters) {
  const { demoMode, setBackendOnline } = useAppStore();
  const [events, setEvents] = useState<BackendUrbanEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [statistics, setStatistics] = useState<BackendEventStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (demoMode) {
      setTimeout(() => {
        let filtered = [...MOCK_EVENTS];
        if (filters?.videoId) {
          filtered = filtered.filter((e) => e.video_id === filters.videoId);
        }
        if (filters?.category && filters.category !== "all") {
          filtered = filtered.filter(
            (e) => e.category.toUpperCase() === filters.category!.toUpperCase()
          );
        }
        if (filters?.eventType && filters.eventType !== "all") {
          filtered = filtered.filter(
            (e) => e.event_type.toUpperCase() === filters.eventType!.toUpperCase()
          );
        }
        if (filters?.severity && filters.severity !== "all") {
          filtered = filtered.filter(
            (e) => e.severity.toUpperCase() === filters.severity!.toUpperCase()
          );
        }

        const byCat: Record<string, number> = {};
        const bySev: Record<string, number> = {};
        const byType: Record<string, number> = {};

        MOCK_EVENTS.forEach((e) => {
          byCat[e.category] = (byCat[e.category] || 0) + 1;
          bySev[e.severity] = (bySev[e.severity] || 0) + 1;
          byType[e.event_type] = (byType[e.event_type] || 0) + 1;
        });

        setEvents(filtered);
        setTotal(filtered.length);
        setStatistics({
          total_events: MOCK_EVENTS.length,
          by_category: byCat,
          by_severity: bySev,
          by_event_type: byType,
        });
        setLoading(false);
      }, 150);
      return;
    }

    try {
      let res;
      if (filters?.videoId) {
        res = await getVideoEvents(filters.videoId, {
          category: filters.category,
          event_type: filters.eventType,
          severity: filters.severity,
          page: filters.page,
          limit: filters.limit || 50,
        });
      } else {
        res = await getEvents({
          category: filters?.category,
          event_type: filters?.eventType,
          severity: filters?.severity,
          page: filters?.page,
          limit: filters?.limit || 50,
        });
      }

      setEvents(res.data);
      setTotal(res.total);
      setBackendOnline(true);

      // Fetch statistics
      try {
        const stats = await getEventStatistics(filters?.videoId);
        setStatistics(stats);
      } catch {
        // Non-critical
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "Failed to load events from backend.";
      setError(msg);
      setBackendOnline(false);

      // Fallback to mock
      setEvents(MOCK_EVENTS);
      setTotal(MOCK_EVENTS.length);
    } finally {
      setLoading(false);
    }
  }, [
    demoMode,
    filters?.videoId,
    filters?.category,
    filters?.eventType,
    filters?.severity,
    filters?.page,
    filters?.limit,
    setBackendOnline,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    total,
    statistics,
    loading,
    error,
    refresh: fetchEvents,
  };
}
