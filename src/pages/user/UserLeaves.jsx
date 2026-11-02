import { useEffect, useState } from "react";
import { CalendarRange, Plus, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import api from "../../services/api";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border-amber-200/50",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  rejected: "bg-rose-50 text-rose-700 border-rose-200/50",
};

export default function UserLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get("/leaves");
      setLeaves(res.data?.leaves || []);
    } catch (err) {
      setError("Failed to load leave history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.startDate || !formData.endDate || !formData.reason.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/leaves", formData);
      setSuccess("Leave request submitted successfully.");
      setFormData({ startDate: "", endDate: "", reason: "" });
      fetchLeaves();
    } catch (err) {
      setError(err.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            User Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Leave Management
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3.5 text-sm font-medium text-emerald-800">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Apply Leave Form */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-1">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <CalendarRange size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Apply for Leave</h3>
              <p className="text-xs text-slate-400">Submit new leave request</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Reason</label>
              <textarea
                rows="3"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Briefly state your reason..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600 resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 h-11 rounded-2xl bg-violet-600 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 active:scale-95 disabled:opacity-50"
            >
              <Plus size={18} />
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>

        {/* Leave History List */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">My Leave History</h3>
            <span className="rounded-full bg-violet-50 px-3.5 py-1 text-xs font-bold text-violet-700">
              {leaves.length} Requests
            </span>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-16 w-full animate-pulse rounded-2xl bg-slate-50" />
              ))}
            </div>
          ) : leaves.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12 text-center">
              <AlertCircle size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">No leave requests found</p>
              <p className="mt-1 text-xs text-slate-400">Your submitted requests will appear here.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {leaves.map((leave) => (
                <div
                  key={leave._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">
                        {leave.startDate} to {leave.endDate}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                          statusStyles[leave.status]
                        }`}
                      >
                        {leave.status === "pending" && <Clock size={12} />}
                        {leave.status === "approved" && <CheckCircle2 size={12} />}
                        {leave.status === "rejected" && <XCircle size={12} />}
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{leave.reason}</p>
                    {leave.adminRemark && (
                      <p className="text-xs text-violet-600 font-medium">
                        Remark: {leave.adminRemark}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}