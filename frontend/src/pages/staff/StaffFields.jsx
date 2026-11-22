import { useState } from "react";

export function StaffField({ label, children }) {
  return (
    <label className="block space-y-1.5 text-sm text-text-secondary">
      <span>{label}</span>
      {children}
    </label>
  );
}

function generatePassword() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "Ae9!" + Array.from(bytes, (value) => characters[value % characters.length]).join("");
}

export function StaffPasswordFields({ value, confirm, onChange, temporary = false }) {
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";

  function generate() {
    const password = generatePassword();
    onChange(password, password);
    setShow(true);
  }

  return (
    <fieldset className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <StaffField label={temporary ? "Temporary password" : "Password"}>
          <input className="input" type={type} autoComplete="new-password" minLength={8} required
            value={value} onChange={(event) => onChange(event.target.value, confirm)} />
        </StaffField>
        <StaffField label="Confirm password">
          <input className="input" type={type} autoComplete="new-password" minLength={8} required
            value={confirm} onChange={(event) => onChange(value, event.target.value)} />
        </StaffField>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-accent-blue">
        <button type="button" onClick={generate}>Generate strong password</button>
        <button type="button" onClick={() => setShow(!show)}>{show ? "Hide password" : "Show password"}</button>
      </div>
      <p className="text-xs text-text-muted">Use at least eight characters, including a letter and a number.</p>
    </fieldset>
  );
}
