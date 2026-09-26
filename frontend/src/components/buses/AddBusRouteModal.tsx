import { useState } from "react";
import { Plus, Route as RouteIcon, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/state/app-store";

interface AddBusRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (routeData: {
    routeName: string;
    startPoint: string;
    destination: string;
    waypoints: string;
    description?: string;
    assignedBuses: string;
    status: "active" | "inactive";
  }) => void;
}

export function AddBusRouteModal({ isOpen, onClose, onSuccess }: AddBusRouteModalProps) {
  const { buses } = useStore();

  const [routeName, setRouteName] = useState("");
  const [startPoint, setStartPoint] = useState("");
  const [destination, setDestination] = useState("");
  const [waypoints, setWaypoints] = useState("");
  const [description, setDescription] = useState("");
  const [assignedBuses, setAssignedBuses] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Required fields validation
    if (!routeName.trim()) {
      setErrorMessage("Route Number / Name is required.");
      return;
    }
    if (!startPoint.trim()) {
      setErrorMessage("Starting Point is required.");
      return;
    }
    if (!destination.trim()) {
      setErrorMessage("Destination is required.");
      return;
    }
    if (!waypoints.trim()) {
      setErrorMessage("Stops / Waypoints are required.");
      return;
    }
    if (!status) {
      setErrorMessage("Route Status is required.");
      return;
    }

    const newRoute = {
      routeName: routeName.trim(),
      startPoint: startPoint.trim(),
      destination: destination.trim(),
      waypoints: waypoints.trim(),
      description: description.trim(),
      assignedBuses: assignedBuses.trim(),
      status,
    };

    if (onSuccess) {
      onSuccess(newRoute);
    }

    toast.success(`Bus Route "${newRoute.routeName}" added successfully!`);

    // Reset fields
    setRouteName("");
    setStartPoint("");
    setDestination("");
    setWaypoints("");
    setDescription("");
    setAssignedBuses("");
    setStatus("active");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded bg-blue-600/10 text-blue-700">
              <RouteIcon className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add New Bus Route</h3>
              <p className="text-[11px] text-slate-500">Configure new transit corridor monitoring route</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 font-medium">
            {errorMessage}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Route Number / Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Route Number / Name *
              </label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Route B5 (WEH Express)"
                className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Route Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 outline-none focus:border-blue-600"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Starting Point */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Starting Point *
              </label>
              <input
                type="text"
                value={startPoint}
                onChange={(e) => setStartPoint(e.target.value)}
                placeholder="e.g. Andheri Depot"
                className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            {/* Destination */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Destination *
              </label>
              <input
                type="text"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Bandra Terminus"
                className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Stops / Waypoints */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Stops / Waypoints (comma-separated) *
            </label>
            <input
              type="text"
              value={waypoints}
              onChange={(e) => setWaypoints(e.target.value)}
              placeholder="e.g. WEH Junction, Mahim Causeway, Linking Road"
              className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Assigned Buses */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Assigned Bus(es)
            </label>
            <input
              type="text"
              value={assignedBuses}
              onChange={(e) => setAssignedBuses(e.target.value)}
              placeholder="e.g. BUS-042, BUS-017, BUS-031"
              className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Description (Optional) */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Route Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Operational details or corridor notes..."
              className="w-full rounded border border-slate-300 bg-slate-50 p-2 text-slate-800 placeholder-slate-400 outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-700 hover:bg-blue-800 text-white text-xs flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Route
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
