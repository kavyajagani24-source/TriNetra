import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bus as BusIcon,
  Camera,
  Clock,
  Eye,
  Film,
  MapPin,
  Radio,
  Satellite,
  ShieldAlert,
  Signal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/app-store";
import type { Bus } from "@/types";

interface BusDetailDrawerProps {
  bus: Bus | null;
  onClose: () => void;
}

export function BusDetailDrawer({ bus, onClose }: BusDetailDrawerProps) {
  const { selectBus, issues, incidents } = useStore();
  const navigate = useNavigate();

  if (!bus) return null;

  // Compute bus observations & incidents
  const busIssues = issues.filter((i) => i.busCount > 0 && i.status !== "resolved");
  const busIncidents = incidents.filter((inc) => inc.evidence.busId === bus.id);

  const handleViewOnMap = () => {
    selectBus(bus.id);
    onClose();
    navigate({ to: "/city-map" });
  };

  const handleViewProcessing = () => {
    onClose();
    navigate({ to: "/videos" });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl animate-in slide-in-from-right duration-250">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <BusIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Bus Unit {bus.id}</h2>
                <span className="font-mono text-xs text-blue-300">Route {bus.route}</span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Radio className="h-3.5 w-3.5 text-emerald-400" />
                {bus.operator}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close bus drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Status Bar */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Operational Status:</span>
              <span
                className={`font-semibold uppercase px-2 py-0.5 rounded text-[11px] ${
                  bus.status === "active"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : bus.status === "idle"
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-slate-100 text-slate-700 border border-slate-300"
                }`}
              >
                {bus.status}
              </span>
            </div>
            <div className="text-xs font-mono text-slate-600 flex items-center gap-1">
              <Signal className="h-3.5 w-3.5 text-emerald-600" />
              <span>GPS {bus.gps}</span>
            </div>
          </div>

          {/* Telemetry Grid */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Satellite className="h-4 w-4 text-blue-600" />
              Telemetry & Sensor Telemetry
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Current Speed</span>
                <span className="font-semibold text-slate-800 font-mono">{bus.speedKph} km/h</span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Cameras Online</span>
                <span className="font-semibold text-slate-800">
                  {bus.camerasOnline} / {bus.camerasTotal} active
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">GPS Coordinates</span>
                <span className="font-mono text-slate-800">
                  {bus.position.lat.toFixed(4)}, {bus.position.lng.toFixed(4)}
                </span>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50/50 p-2.5">
                <span className="text-slate-500 block text-[11px]">Last Communication</span>
                <span className="font-mono text-slate-800">{bus.lastPacket}</span>
              </div>
            </div>
          </div>

          {/* Camera Channels Array */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-slate-600" />
              Onboard Multi-Camera Array
            </h3>
            <div className="grid grid-cols-5 gap-1.5">
              {["Front", "Rear", "Left", "Right", "Cabin"].map((cam, i) => (
                <div
                  key={cam}
                  className="rounded border border-slate-200 bg-slate-900 p-2 text-center text-white flex flex-col items-center justify-between min-h-[60px]"
                >
                  <span className="text-[10px] text-slate-300 font-medium uppercase">{cam}</span>
                  <span
                    className={`h-2 w-2 rounded-full mt-1 ${
                      i < bus.camerasOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
                    }`}
                  />
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                    {i < bus.camerasOnline ? "REC" : "OFF"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Detections & Recent Activity */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-blue-600" />
              Today&apos;s Detections & Observations
            </h3>
            <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
              {bus.recentObservations.map((obs, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{obs.type}</span>
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                      {(obs.confidence * 100).toFixed(0)}% conf
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">{obs.at}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Incidents Detected */}
          {busIncidents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                AI Incidents Generated by Unit
              </h3>
              <div className="space-y-1.5">
                {busIncidents.map((inc) => (
                  <div key={inc.id} className="rounded border border-amber-200 bg-amber-50/50 p-2.5 text-xs text-amber-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">{inc.type} ({inc.id})</span>
                      <span className="text-[11px] text-slate-600">{inc.location}</span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold">{inc.at}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              onClick={handleViewOnMap}
              className="bg-blue-700 hover:bg-blue-800 text-white text-xs flex items-center justify-center gap-1"
            >
              <MapPin className="h-3.5 w-3.5" />
              View on Map
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleViewProcessing}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs flex items-center justify-center gap-1"
            >
              <Film className="h-3.5 w-3.5 text-blue-600" />
              View Processing
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-slate-600 hover:bg-slate-200 text-xs flex items-center justify-center gap-1"
            >
              Close
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
