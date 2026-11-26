import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/staffApi";
import BackButton from "../../components/common/BackButton";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useAuth } from "../../hooks/useAuth";
import { apiError } from "../../utils/apiError";
import { ACCESS_LABELS, MODULE_LABELS, STAFF_ROLES } from "../../utils/staffAccess";
import { StaffPasswordFields } from "./StaffFields";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value.endsWith("Z") ? value : value + "Z").toLocaleString();
}

export default function StaffDetailPage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useQuery({ queryKey: ["staff-user", id], queryFn: () => staffApi.get(id) });
  const activity = useQuery({ queryKey: ["staff-activity", id], queryFn: () => staffApi.activity(id) });
  const [confirmation, setConfirmation] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [issuedPassword, setIssuedPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const statusChange = useMutation({
    mutationFn: (action) => action === "delete" ? staffApi.remove(id) : staffApi.deactivate(id),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["technician-profiles"] });
      if (action === "delete") navigate("/staff", { replace: true });
      else queryClient.invalidateQueries({ queryKey: ["staff-user", id] });
    },
  });

  const reset = useMutation({
    mutationFn: (body) => staffApi.resetPassword(id, body),
    onSuccess: (_, body) => {
      setIssuedPassword(body.password);
      setResetting(false);
      setPassword("");
      setConfirm("");
    },
    onError: (err) => setPasswordError(apiError(err, "Could not reset password.")),
  });

  function submitPassword(event) {
    event.preventDefault();
    setPasswordError("");
    if (password !== confirm) {
      setPasswordError("Passwords do not match.");
      return;
    }
    reset.mutate({ password, confirm_password: confirm });
  }

  if (user.isLoading) return <LoadingSpinner />;
  if (user.isError) return <><BackButton fallback="/staff" /><p role="alert">{apiError(user.error, "Could not load staff member.")}</p></>;
  const member = user.data;
  const ownAccount = member.user_id === me?.user_id;
  const details = [
    ["Email", member.email], ["Phone", member.phone || "—"], ["Role", STAFF_ROLES[member.role]],
    ["Status", member.is_active ? "Active" : "Inactive"],
    ["Handles enquiries", member.role === "manager" || member.handles_enquiries ? "Yes" : "No"],
    ["Created", formatDate(member.created_at)], ["Last login", formatDate(member.last_login_at)],
  ];

  return (
    <section className="max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/staff" />
        <h1 className="text-2xl font-bold text-text-primary">{member.full_name}</h1>
        <Link className="ml-auto rounded-lg bg-accent-blue-strong px-4 py-2 text-sm text-white" to={"/staff/" + id + "/edit"}>Edit staff member</Link>
      </header>
      <dl className="grid gap-4 rounded-xl border border-bg-border bg-bg-card p-5 sm:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="break-words text-sm text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
        <h2 className="font-semibold text-text-primary">Module access</h2>
        <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2 rounded bg-bg-elevated p-2 text-xs text-text-secondary">
              <dt>{label}</dt><dd>{ACCESS_LABELS[member.access[key]]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
        <h2 className="font-semibold text-text-primary">Recent assignments</h2>
        {activity.isLoading && <LoadingSpinner />}
        {activity.isError && <p role="alert" className="text-status-cancelled">Could not load activity.</p>}
        {activity.data && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm text-text-primary">Assigned enquiries</h3>
              {activity.data.enquiries.length === 0 && <p className="text-sm text-text-muted">No assigned enquiries.</p>}
              <ul className="space-y-2 text-sm text-text-secondary">
                {activity.data.enquiries.map((entry) => (
                  <li key={entry.enquiry_id}><Link className="text-accent-blue hover:underline" to={"/enquiries/" + entry.enquiry_id}>{entry.subject}</Link> · {entry.status}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm text-text-primary">Assigned service jobs</h3>
              {activity.data.jobs.length === 0 && <p className="text-sm text-text-muted">No assigned service jobs.</p>}
              <ul className="space-y-2 text-sm text-text-secondary">
                {activity.data.jobs.map((job) => (
                  <li key={job.job_id}><Link className="text-accent-blue hover:underline" to={"/service/" + job.job_id + "/edit"}>{job.job_type}</Link> · {job.status}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {member.role === "technician" && <Link className="text-sm text-accent-blue" to={"/staff/technicians/" + id}>Open technician profile</Link>}
      </section>
      <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
        <h2 className="font-semibold text-text-primary">Account actions</h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {!resetting && !issuedPassword && <button type="button" className="text-accent-blue" onClick={() => setResetting(true)}>Reset password</button>}
          {!ownAccount && (
            <button type="button" className="text-status-cancelled" disabled={statusChange.isPending}
              onClick={() => setConfirmation(member.is_active ? "deactivate" : "delete")}>
              {member.is_active ? "Deactivate" : "Permanently delete"}
            </button>
          )}
        </div>
        {statusChange.isError && <p role="alert" className="text-sm text-status-cancelled">{apiError(statusChange.error, "Could not update status.")}</p>}
        {resetting && (
          <form className="space-y-4" onSubmit={submitPassword}>
            <StaffPasswordFields temporary value={password} confirm={confirm}
              onChange={(value, confirmationValue) => { setPassword(value); setConfirm(confirmationValue); }} />
            {passwordError && <p role="alert" className="text-sm text-status-cancelled">{passwordError}</p>}
            <button className="rounded bg-accent-blue-strong px-3 py-2 text-sm text-white" disabled={reset.isPending} type="submit">Set temporary password</button>
            <button type="button" className="ml-3 text-sm text-text-secondary"
              onClick={() => { setResetting(false); setPassword(""); setConfirm(""); setPasswordError(""); }}>Cancel</button>
          </form>
        )}
        {issuedPassword && (
          <div className="space-y-2 rounded-lg bg-bg-elevated p-4 text-sm text-text-primary">
            <p>Share this temporary password with the staff member. They must change it at their next sign-in.</p>
            <code className="block break-all select-all">{issuedPassword}</code>
            <button type="button" className="text-accent-blue" onClick={() => { setIssuedPassword(""); reset.reset(); }}>Done</button>
          </div>
        )}
      </section>
      <ConfirmDialog isOpen={confirmation !== null}
        title={confirmation === "delete" ? "Permanently delete this account?" : "Deactivate this staff member?"}
        message={confirmation === "delete"
          ? "This removes an inactive account if it has no linked records."
          : "This ends portal access immediately and retains their records."}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => { statusChange.mutate(confirmation); setConfirmation(null); }}
        danger confirmLabel={confirmation === "delete" ? "Delete" : "Deactivate"} />
    </section>
  );
}
