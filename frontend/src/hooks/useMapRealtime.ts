/**
 * UrbanEye AI — useMapRealtime Hook
 *
 * WebSocket streaming subscriber for real-time fleet bus telemetry and event alerts.
 * Features exponential backoff reconnection and non-blocking offline resilience.
 */

import { useEffect, useRef } from "react";
import { useMapStore } from "@/store/mapStore";
import { BACKEND_URL } from "@/config/env";
import type { RealtimeMapMessage } from "@/types/map";

interface UseMapRealtimeProps {
  onBusUpdate?: (busData: any) => void;
  onEventCreated?: (eventData: any) => void;
  enabled?: boolean;
}

export function useMapRealtime({
  onBusUpdate,
  onEventCreated,
  enabled = true,
}: UseMapRealtimeProps = {}) {
  const setRealtimeStatus = useMapStore((s) => s.setRealtimeStatus);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const busUpdateRef = useRef(onBusUpdate);
  const eventCreatedRef = useRef(onEventCreated);

  busUpdateRef.current = onBusUpdate;
  eventCreatedRef.current = onEventCreated;

  useEffect(() => {
    if (!enabled) {
      setRealtimeStatus("OFFLINE");
      return;
    }

    // Convert http(s) URL to ws(s)
    const wsBase = BACKEND_URL.replace(/^http/, "ws");
    const wsUrl = `${wsBase}/api/v1/map/ws/map`;

    function connect() {
      try {
        setRealtimeStatus(reconnectAttempts.current === 0 ? "OFFLINE" : "RECONNECTING");
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
          setRealtimeStatus("LIVE");
          reconnectAttempts.current = 0;
        };

        ws.onmessage = (event) => {
          try {
            const message: RealtimeMapMessage = JSON.parse(event.data);
            if (message.type === "BUS_LOCATION_UPDATED" && busUpdateRef.current) {
              busUpdateRef.current(message.payload);
            } else if (message.type === "EVENT_CREATED" && eventCreatedRef.current) {
              eventCreatedRef.current(message.payload);
            }
          } catch {
            // Ignore malformed ping/pong
          }
        };

        ws.onclose = () => {
          setRealtimeStatus("OFFLINE");
          // Schedule exponential backoff reconnect: 2s, 4s, 8s, up to 30s max
          const delay = Math.min(30000, Math.pow(2, reconnectAttempts.current) * 2000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        setRealtimeStatus("OFFLINE");
      }
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
      setRealtimeStatus("OFFLINE");
    };
  }, [enabled, onBusUpdate, onEventCreated, setRealtimeStatus]);

  return {};
}
