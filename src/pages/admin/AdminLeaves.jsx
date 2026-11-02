import { useEffect, useState } from "react";
import { CalendarRange, Clock, CheckCircle2, XCircle, AlertCircle, Check, X } from "lucide-react";
import api from "../../services/api";

const statusStyles = {
  pending: "bg-amber-50 text-amber-700 border-amber-200/50",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/50",
  rejected: "bg-rose-50 text-rose-700 border-rose-200/50",
};

export default function AdminLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [remarkModal, setRemarkModal] = useState(null); // { id, status }
  const [adminRemark, setAdminRemark] = useState("");

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get("/leaves");
      setLeaves(res.data?.leaves || []);
    } catch (err) {
      setError("Failed to load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleStatusUpdate = async (id, status) => {
    try {
      setProcessingId(id);
      setError("");
      await api.patch(`/leaves/${id}/status`, {
        status,
        adminRemark,
      });
      setRemarkModal(null);
      setAdminRemark("");
      fetchLeaves();
    } catch (err) {
      setError(err.message || "Failed to update leave status.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-3xl p-6 shadow-xs border border-slate-100">
        <div>
          <span className="text-xs font-bold tracking-wider text-violet-600 uppercase">
            Admin Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            Leave Requests Control
          </h1>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Leave Requests Table Card */}
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs sm:p-7">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <CalendarRange size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">All Team Leave Requests</h3>
              <p className="text-xs text-slate-400">Review and manage employee leaves</p>
            </div>
          </div>
          <span className="rounded-full bg-violet-50 px-3.5 py-1 text-xs font-bold text-violet-700">
            {leaves.length} Total
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
            <p className="mt-1 text-xs text-slate-400">Team leave requests will appear here.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {leaves.map((leave) => {
              const userName = leave.user?.name || "Unknown User";
              const userEmail = leave.user?.email || "";

              return (
                <div
                  key={leave._id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition-colors hover:bg-slate-50"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">{userName}</span>
                      <span className="text-xs text-slate-400">({userEmail})</span>
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
                    <p className="text-xs font-semibold text-violet-600">
                      Duration: {leave.startDate} to {leave.endDate}
                    </p>
                    <p className="text-xs text-slate-600">Reason: {leave.reason}</p>
                    {leave.adminRemark && (
                      <p className="text-xs text-slate-500 italic">
                        Remark: {leave.adminRemark}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {leave.status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRemarkModal({ id: leave._id, status: "approved" })}
                          disabled={processingId === leave._id}
                          className="inline-flex items-center gap-1 h-9 px-4 rounded-xl bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemarkModal({ id: leave._id, status: "rejected" })}
                          disabled={processingId === leave._id}
                          className="inline-flex items-center gap-1 h-9 px-4 rounded-xl bg-rose-600 text-xs font-bold text-white transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
                        >
                          <X size={14} /> Reject
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">
                        Processed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Remark Modal */}
      {remarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {remarkModal.status === "approved" ? "Approve Leave Request" : "Reject Leave Request"}
            </h3>
            <p className="text-xs text-slate-500">
              Add an optional remark or note for the user.
            </p>
            <textarea
              rows="3"
              value={adminRemark}
              onChange={(e) => setAdminRemark(e.target.value)}
              placeholder="Optional remark..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 focus:bg-white focus:outline-violet-600 resize-none"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRemarkModal(null);
                  setAdminRemark("");
                }}
                className="h-10 px-5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStatusUpdate(remarkModal.id, remarkModal.status)}
                className={`h-10 px-5 rounded-xl text-xs font-bold text-white transition ${
                  remarkModal.status === "approved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                Confirm {remarkModal.status === "approved" ? "Approval" : "Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}