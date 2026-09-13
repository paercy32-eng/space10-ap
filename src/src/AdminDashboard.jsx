import React, { useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";

// Standalone admin page -- fetches pending deposits/withdrawals and the
// full user list directly from Supabase (RLS restricts these SELECTs to
// admins only, per migrations 0004/0005) and calls the approve_/reject_
// RPCs directly. No Edge Functions involved; every privileged action is
// gated inside the RPC itself by checking profiles.is_admin for auth.uid().

function formatUGX(amount) {
  const n = Math.round(Number(amount) || 0);
  return `UGX ${n.toLocaleString()}`;
}

function PendingRow({ item, kind, busy, onApprove, onReject }) {
  return (
    <div className="border rounded-xl p-4">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-semibold text-gray-900">
            {item.profiles?.full_name || item.full_name || item.phone_number}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {item.phone_number} · {new Date(item.created_at).toLocaleString()}
          </div>
          {kind === "deposit" && (
            <div className="text-xs text-gray-400 mt-0.5">
              {item.network} · TXID {item.transaction_id}
            </div>
          )}
          {kind === "withdrawal" && (
            <div className="text-xs text-gray-400 mt-0.5">
              Fee {formatUGX(item.fee)} · Send {formatUGX(item.net_amount)}
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            Wallet balance: {formatUGX(item.profiles?.balance)}
          </div>
        </div>
        <div className="text-lg font-bold text-gray-900">{formatUGX(item.amount)}</div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onApprove}
          disabled={busy}
          className="flex-1 bg-emerald-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Processing…" : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="flex-1 bg-rose-500 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "Processing…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const configured = isConfigured();

  const loadPending = useCallback(async () => {
    if (!isConfigured()) {
      setLoading(false);
      return;
    }
    setError("");
    try {
      const [{ data: depositRows, error: depositErr }, { data: withdrawalRows, error: withdrawalErr }] = await Promise.all([
        supabase
          .from("deposits")
          .select("id, amount, phone_number, network, transaction_id, status, created_at, profiles(full_name, phone_number, balance)")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
        supabase
          .from("withdrawals")
          .select("id, amount, fee, net_amount, phone_number, full_name, status, created_at, profiles(full_name, phone_number, balance)")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);
      if (depositErr || withdrawalErr) throw new Error((depositErr || withdrawalErr).message);
      setDeposits(depositRows || []);
      setWithdrawals(withdrawalRows || []);
    } catch (err) {
      // A permission-denied error here almost always means the logged-in
      // user isn't actually an admin (profiles.is_admin = false), since
      // RLS silently returns zero rows rather than an error for that case
      // -- but a thrown error means something else went wrong.
      setError(err.message || "Failed to load pending items.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isConfigured()) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone_number, balance, is_admin, created_at")
      .order("created_at", { ascending: true });
    setUsers(data || []);
  }, []);

  useEffect(() => {
    if (!configured) return;
    loadPending();
    loadUsers();
    const channel = supabase
      .channel("admin-dashboard-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, () => loadPending())
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, () => loadPending())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => loadUsers())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [configured, loadPending, loadUsers]);

  const runAction = async (id, rpcName, paramName) => {
    setActioningId(id);
    setError("");
    try {
      const { error } = await supabase.rpc(rpcName, { [paramName]: id });
      if (error) throw error;
      await loadPending();
    } catch (err) {
      setError(err.message || "Action failed.");
    } finally {
      setActioningId(null);
    }
  };

  if (!configured) {
    return (
      <div className="p-6 text-center text-gray-500">
        Supabase isn't configured yet in this browser. Open the main app and use the
        "Supabase settings" link on the login screen first.
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading pending items…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Admin dashboard</h1>
        <button onClick={() => { loadPending(); loadUsers(); }} className="text-sm text-gray-500 underline">
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          All users ({users.length})
        </h2>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {users.map((u, i) => (
            <div
              key={u.id}
              className={`flex justify-between items-center border rounded-lg p-3 ${i === 0 ? "border-amber-400 bg-amber-50" : "border-gray-200"}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-xs font-bold text-amber-600 bg-amber-100 rounded-full px-2 py-0.5">
                      ★ #1 account
                    </span>
                  )}
                  <span className="font-medium text-gray-900">{u.full_name || u.phone_number}</span>
                  {u.is_admin && (
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {u.phone_number} · Joined {new Date(u.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="font-semibold text-gray-900">{formatUGX(u.balance)}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Pending deposits ({deposits.length})
        </h2>
        {deposits.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No pending deposits.</div>
        ) : (
          <div className="space-y-3">
            {deposits.map((d) => (
              <PendingRow
                key={d.id}
                item={d}
                kind="deposit"
                busy={actioningId === d.id}
                onApprove={() => runAction(d.id, "approve_deposit", "p_deposit_id")}
                onReject={() => runAction(d.id, "reject_deposit", "p_deposit_id")}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Pending withdrawals ({withdrawals.length})
        </h2>
        {withdrawals.length === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">No pending withdrawals.</div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <PendingRow
                key={w.id}
                item={w}
                kind="withdrawal"
                busy={actioningId === w.id}
                onApprove={() => runAction(w.id, "approve_withdrawal", "p_withdrawal_id")}
                onReject={() => runAction(w.id, "reject_withdrawal", "p_withdrawal_id")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
