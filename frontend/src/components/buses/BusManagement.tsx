import { useState } from "react";
import {
  Bus,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Clock,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { useBuses } from "@/hooks/useBuses";
import type { BackendBus } from "@/types/api";
import { formatDate } from "@/utils/formatters";

export function BusManagement() {
  const { buses, loading, error, refreshBuses, createBus, updateBus, removeBus } = useBuses();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editingBus, setEditingBus] = useState<BackendBus | null>(null);
  const [deletingBus, setDeletingBus] = useState<BackendBus | null>(null);

  // Form states for register/edit
  const [formData, setFormData] = useState({
    bus_number: "",
    license_plate: "",
    route_number: "",
    status: "active",
  });
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      bus_number: "",
      license_plate: "",
      route_number: "",
      status: "active",
    });
  };

  const handleOpenRegister = () => {
    resetForm();
    setIsRegisterOpen(true);
  };

  const handleOpenEdit = (bus: BackendBus) => {
    setEditingBus(bus);
    setFormData({
      bus_number: bus.bus_number,
      license_plate: bus.license_plate || "",
      route_number: bus.route_number || "",
      status: bus.status,
    });
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.bus_number.trim()) {
      toast.error("Bus number is required");
      return;
    }
    try {
      setSubmitting(true);
      await createBus({
        bus_number: formData.bus_number.trim(),
        license_plate: formData.license_plate.trim() || undefined,
        route_number: formData.route_number.trim() || undefined,
        status: formData.status,
      });
      toast.success(`Bus ${formData.bus_number} registered successfully`);
      setIsRegisterOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to register bus");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBus) return;
    try {
      setSubmitting(true);
      await updateBus(editingBus.id, {
        license_plate: formData.license_plate.trim() || undefined,
        route_number: formData.route_number.trim() || undefined,
        status: formData.status,
      });
      toast.success(`Bus ${editingBus.bus_number} updated`);
      setEditingBus(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to update bus");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBus) return;
    try {
      setSubmitting(true);
      await removeBus(deletingBus.id);
      toast.success(`Bus ${deletingBus.bus_number} removed`);
      setDeletingBus(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Failed to delete bus");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBuses = buses.filter((bus) => {
    const matchesSearch =
      bus.bus_number.toLowerCase().includes(search.toLowerCase()) ||
      (bus.license_plate && bus.license_plate.toLowerCase().includes(search.toLowerCase())) ||
      (bus.route_number && bus.route_number.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || bus.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const activeCount = buses.filter((b) => b.status === "active").length;
  const maintenanceCount = buses.filter((b) => b.status === "maintenance").length;
  const inactiveCount = buses.filter((b) => b.status === "inactive").length;

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Total Sensing Fleet</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-foreground">{buses.length}</span>
            <Bus className="h-4 w-4 text-primary" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Active Units</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-emerald-500">{activeCount}</span>
            <Radio className="h-4 w-4 text-emerald-500" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Under Maintenance</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-amber-500">{maintenanceCount}</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Inactive / Standby</span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold tracking-tight text-muted-foreground">{inactiveCount}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by bus number, plate, route..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-border bg-card py-1.5 pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[12px]">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshBuses}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenRegister}
            className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Bus
          </button>
        </div>
      </div>

      {/* Bus Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading && buses.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-[12px] text-muted-foreground">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading bus registry...
          </div>
        ) : filteredBuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Bus className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-[13px] font-medium text-foreground">No buses found</p>
            <p className="text-[11px] text-muted-foreground">
              {search ? "No buses match your filter query." : "Register your first transit bus to begin mobile video sensing."}
            </p>
            {!search && (
              <button
                onClick={handleOpenRegister}
                className="mt-3 inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Register Bus
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-[12px]">
            <thead className="border-b border-border bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Bus Number</th>
                <th className="px-3 py-2">License Plate</th>
                <th className="px-3 py-2">Assigned Route</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Registered At</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBuses.map((bus) => (
                <tr key={bus.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded bg-primary/10 text-primary">
                        <Bus className="h-3.5 w-3.5" />
                      </span>
                      {bus.bus_number}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {bus.license_plate || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-foreground">
                    {bus.route_number ? `Route ${bus.route_number}` : <span className="text-muted-foreground italic">Unassigned</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        bus.status === "active"
                          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          : bus.status === "maintenance"
                            ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          bus.status === "active"
                            ? "bg-emerald-500"
                            : bus.status === "maintenance"
                              ? "bg-amber-500"
                              : "bg-muted-foreground"
                        }`}
                      />
                      {bus.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {formatDate(bus.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(bus)}
                        title="Edit Bus"
                        className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingBus(bus)}
                        title="Delete Bus"
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Register Bus Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-[14px] font-semibold text-foreground">Register Sensing Bus</h3>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegisterSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Bus Number / Identifier <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BUS-014 or DL-1PC-4021"
                  value={formData.bus_number}
                  onChange={(e) => setFormData({ ...formData, bus_number: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  License Plate Registration
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL-1PC-4021"
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Assigned Route
                </label>
                <input
                  type="text"
                  placeholder="e.g. 534A or Outer Ring"
                  value={formData.route_number}
                  onChange={(e) => setFormData({ ...formData, route_number: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="active">Active (Online Sensing)</option>
                  <option value="maintenance">Under Maintenance</option>
                  <option value="inactive">Inactive / Standby</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="rounded border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Registering..." : "Register Bus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Bus Modal */}
      {editingBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-[14px] font-semibold text-foreground">
                Edit Bus: {editingBus.bus_number}
              </h3>
              <button
                onClick={() => setEditingBus(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  License Plate Registration
                </label>
                <input
                  type="text"
                  placeholder="e.g. DL-1PC-4021"
                  value={formData.license_plate}
                  onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">
                  Assigned Route
                </label>
                <input
                  type="text"
                  placeholder="e.g. 534A"
                  value={formData.route_number}
                  onChange={(e) => setFormData({ ...formData, route_number: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full rounded border border-border bg-secondary/30 px-3 py-1.5 text-[12px] text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="active">Active (Online Sensing)</option>
                  <option value="maintenance">Under Maintenance</option>
                  <option value="inactive">Inactive / Standby</option>
                </select>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingBus(null)}
                  className="rounded border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
            <h3 className="text-[14px] font-semibold text-foreground">Confirm Bus Removal</h3>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Are you sure you want to remove bus <strong className="text-foreground">{deletingBus.bus_number}</strong>?
              Historical video runs and detected events will remain preserved in audit logs.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBus(null)}
                className="rounded border border-border px-3 py-1.5 text-[12px] text-muted-foreground hover:bg-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="rounded bg-destructive px-3 py-1.5 text-[12px] font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {submitting ? "Removing..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
