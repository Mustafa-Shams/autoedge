import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../hooks/useAuth";
import { staffHome } from "../../utils/staffAccess";
import { apiError } from "../../utils/apiError";

export default function ChangePasswordPage() {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  async function submit(event) {
    event.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    if (body.password !== body.confirm_password) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const { access_token } = await authApi.changePassword(body);
      login(access_token, { ...user, must_change_password: false });
      navigate(staffHome(user), { replace: true });
    } catch (err) {
      setError(apiError(err, "Could not change your password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg-primary p-4">
      <form className="w-full max-w-md space-y-4 rounded-xl border border-bg-border bg-bg-card p-6" onSubmit={submit}>
        <h1 className="text-xl font-bold text-text-primary">Change your password</h1>
        <p className="text-sm text-text-secondary">Choose at least eight characters with a letter and a number.</p>
        <label className="block text-sm text-text-secondary">
          Temporary password
          <input className="input mt-1" type="password" name="current_password" autoComplete="current-password" required />
        </label>
        <label className="block text-sm text-text-secondary">
          New password
          <input className="input mt-1" type="password" name="password" autoComplete="new-password" minLength={8} required />
        </label>
        <label className="block text-sm text-text-secondary">
          Confirm new password
          <input className="input mt-1" type="password" name="confirm_password" autoComplete="new-password" minLength={8} required />
        </label>
        {error && <p role="alert" className="text-sm text-status-cancelled">{error}</p>}
        <button type="submit" disabled={saving} className="rounded-lg bg-accent-blue px-4 py-2 text-sm text-white">
          {saving ? "Saving…" : "Change password"}
        </button>
        <button type="button" onClick={() => { logout(); navigate("/login", { replace: true }); }}
          className="ml-3 text-sm text-text-secondary">Sign out</button>
      </form>
    </div>
  );
}
