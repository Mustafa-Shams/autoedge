import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/staffApi";
import BackButton from "../../components/common/BackButton";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { apiError } from "../../utils/apiError";
import { useAuth } from "../../hooks/useAuth";
import { ACCESS_LABELS, MODULE_LABELS, STAFF_ROLES, roleAccess } from "../../utils/staffAccess";
import { StaffField, StaffPasswordFields } from "./StaffFields";

const defaults = {
  full_name: "", email: "", phone: "", role: "sales_executive", is_active: true,
  handles_enquiries: false, module_access: {}, password: "", confirm_password: "",
};

export default function StaffFormPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["staff-user", id], queryFn: () => staffApi.get(id), enabled: Boolean(id) });
  if (id && query.isLoading) return <LoadingSpinner />;
  if (id && query.isError) {
    return <><BackButton fallback="/staff" /><p role="alert">{apiError(query.error, "Could not load staff member.")}</p></>;
  }
  return <StaffForm key={id ?? "new"} id={id} existing={query.data} />;
}

function StaffForm({ id, existing }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({ ...defaults, ...existing });
  const [error, setError] = useState("");
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const ownAccount = existing?.user_id === user?.user_id;
  const fallback = id ? "/staff/" + id : "/staff";

  const mutation = useMutation({
    mutationFn: (data) => id ? staffApi.update(id, data) : staffApi.create(data),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["staff-user", id] });
      queryClient.invalidateQueries({ queryKey: ["technician-profiles"] });
      navigate("/staff/" + saved.user_id, { replace: true });
    },
    onError: (err) => setError(apiError(err, "Could not save staff account.")),
  });

  function setField(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function save() {
    const { full_name, email, phone, role, is_active, handles_enquiries, module_access, password, confirm_password } = form;
    const changes = { full_name: full_name.trim(), phone: (phone ?? "").trim() || null, role, is_active, handles_enquiries, module_access };
    mutation.mutate(id ? changes : { ...changes, email, password, confirm_password });
  }

  function submit(event) {
    event.preventDefault();
    setError("");
    if (!id && form.password !== form.confirm_password) {
      setError("Passwords do not match.");
    } else if (existing?.is_active && !form.is_active) {
      setConfirmDeactivate(true);
    } else {
      save();
    }
  }

  return (
    <section className="max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <BackButton fallback={fallback} />
        <h1 className="text-2xl font-bold text-text-primary">{id ? "Edit staff member" : "Add staff member"}</h1>
      </header>
      <form className="space-y-5 rounded-xl border border-bg-border bg-bg-card p-5 sm:p-6" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <StaffField label="Full name">
            <input className="input" required maxLength={100} value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} />
          </StaffField>
          <StaffField label="Email">
            <input className="input" type="email" required maxLength={150} readOnly={Boolean(id)}
              value={form.email} onChange={(event) => setField("email", event.target.value)} />
          </StaffField>
          <StaffField label="Phone">
            <input className="input" type="tel" maxLength={20} value={form.phone ?? ""} onChange={(event) => setField("phone", event.target.value)} />
          </StaffField>
          <StaffField label="Job role and access preset">
            <select className="input" value={form.role} disabled={ownAccount} onChange={(event) => {
              setForm({ ...form, role: event.target.value, module_access: {} });
            }}>
              {Object.entries(STAFF_ROLES).map(([role, label]) => <option key={role} value={role}>{label}</option>)}
            </select>
          </StaffField>
          <StaffField label="Status">
            <select className="input" value={form.is_active ? "active" : "inactive"} disabled={ownAccount}
              onChange={(event) => setField("is_active", event.target.value === "active")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </StaffField>
          <StaffField label="Handles enquiries">
            <select className="input" value={form.role === "manager" || form.handles_enquiries ? "yes" : "no"}
              disabled={["manager", "technician"].includes(form.role)} onChange={(event) => setField("handles_enquiries", event.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </StaffField>
        </div>
        {!id && <StaffPasswordFields value={form.password} confirm={form.confirm_password} onChange={(password, confirm_password) => {
          setForm({ ...form, password, confirm_password });
        }} />}
        <fieldset className="space-y-3 border-t border-bg-border pt-4">
          <legend className="font-semibold text-text-primary">Module access</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(MODULE_LABELS).map(([module, label]) => {
              const maximum = roleAccess(form.role, module);
              const levels = form.role === "manager" ? ["full"] : (
                ["none", "view", "full"].slice(0, ["none", "view", "full"].indexOf(maximum) + 1)
              );
              const selected = form.module_access[module] ?? maximum;
              return (
                <StaffField key={module} label={label}>
                  <select className="input" value={levels.includes(selected) ? selected : maximum}
                    disabled={levels.length === 1}
                    onChange={(event) => setField("module_access", { ...form.module_access, [module]: event.target.value })}>
                    {levels.map((level) => <option key={level} value={level}>{ACCESS_LABELS[level]}</option>)}
                  </select>
                </StaffField>
              );
            })}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-status-cancelled">{error}</p>}
        <div className="flex justify-end gap-4">
          <Link to={fallback} className="rounded-lg border border-bg-border px-4 py-2 text-sm text-text-secondary">Cancel</Link>
          <button type="submit" disabled={mutation.isPending} className="rounded-lg bg-accent-blue-strong px-4 py-2 text-sm text-white">
            {mutation.isPending ? "Saving…" : "Save staff account"}
          </button>
        </div>
      </form>
      <ConfirmDialog isOpen={confirmDeactivate} title="Deactivate staff account?"
        message="This staff member will lose access to the portal and their records will be kept."
        danger confirmLabel="Deactivate" onCancel={() => setConfirmDeactivate(false)}
        onConfirm={() => { setConfirmDeactivate(false); save(); }} />
    </section>
  );
}
