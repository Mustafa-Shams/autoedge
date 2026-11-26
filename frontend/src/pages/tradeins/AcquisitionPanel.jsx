import { useState } from "react";
import { Link } from "react-router-dom";
import { processAcquisition } from "../../api/tradeInsApi";
import { useAuth } from "../../hooks/useAuth";
import { hasModuleAccess } from "../../utils/staffAccess";
import { formatCurrency } from "../../utils/formatters";

export default function AcquisitionPanel({ trade, refresh }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const a = trade.acquisition;
  if (!a) return null;
  const editable = hasModuleAccess(user, "trade_ins", true);
  async function submit(event, action) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.appointment) data.appointment = new Date(data.appointment).toISOString();
    if (data.settlement === "") delete data.settlement;
    if (action === "intake") {
      data.ownership_verified = data.ownership_verified === "on";
      data.condition_verified = data.condition_verified === "on";
    }
    if (data.photos_and_details_verified) data.photos_and_details_verified = true;
    setBusy(true);
    setError("");
    try { const result = await processAcquisition(trade.trade_in_id, { ...data, action, version: a.version }); await refresh(result.data); }
    catch (err) { const msg = err.response?.data?.detail; setError(typeof msg === "string" ? msg : "Check the form and try again."); }
    finally { setBusy(false); }
  }
  return <section className="my-4 space-y-3 rounded-xl border border-bg-border p-4">
    <h4 className="font-semibold">{a.listing_id ? "Resale listing" : "Trade-in acquisition"}</h4>
    {trade.deal_id && hasModuleAccess(user, "sales") && <Link className="block underline" to={`/deals/${trade.deal_id}`}>Deal #{trade.deal_id}</Link>}
    {a.inspection_at && <p>Inspection · {new Date(a.inspection_at).toLocaleString()}</p>}
    {a.value && <p>{a.findings} · {formatCurrency(a.value)} · {a.version === a.approved_version ? "Customer agreed" : "Awaiting customer agreement"}</p>}
    {a.stock_unit_id && <p>Stock unit #{a.stock_unit_id} · {a.returned ? "Returned" : a.listing_id ? "Published" : "Private inventory"}</p>}
    {a.checked && <p>Ownership checked · {a.ownership_reference} · {a.odometer_km.toLocaleString()} km · terms version {a.intake_version}</p>}
    {a.received && <p>{a.returned ? "Returned to customer" : "Physical intake recorded"}</p>}
    {editable && trade.status === "Accepted" && !a.version && <form onSubmit={e => submit(e, "schedule")}>
      <label>Inspection appointment<input required className="input" type="datetime-local" name="appointment" /></label>
      <button disabled={busy} className="underline">Save inspection appointment</button>
    </form>}
    {editable && trade.status === "Accepted" && a.inspection_at && (!a.received || user.role === "manager") &&
      <details><summary>Record inspection or revise terms</summary><form className="space-y-2" onSubmit={e => submit(e, "inspect")}>
        <label className="block">Inspection findings<textarea className="input" name="findings" minLength={3} required defaultValue={a.findings || ""} /></label>
        <label className="block">Verified acquisition value<input className="input" type="number" min=".01" step=".01" name="value" defaultValue={a.value || trade.offered_value} required /></label>
        {user.role === "manager" && <><label className="block">Excess to settle separately<input className="input" type="number" min="0" step=".01" name="excess" defaultValue={a.excess || 0} required /></label>
          <label className="block">Separate settlement terms<textarea className="input" name="settlement" defaultValue={a.settlement || ""} /></label></>}
        <button disabled={busy} className="underline">Send terms for customer approval</button>
      </form></details>}
    {editable && ["Accepted","Completed"].includes(trade.status) && !a.listing_id && !a.returned && a.version > 0 && a.version === a.approved_version && !a.checked &&
      <form onSubmit={e => submit(e, "intake")}><label>VIN on trade-in<input className="input uppercase" name="vin" minLength={17} maxLength={17} required /></label>
        <label className="block">Ownership document reference<input name="ownership_reference" className="input" maxLength={100} required /></label>
        <label className="block">Verified odometer (km)<input name="odometer_km" className="input" type="number" min="0" max="9999999" defaultValue={trade.mileage_km} required /></label>
        <label className="block"><input type="checkbox" name="ownership_verified" required /> I matched the ownership documents, seller and physical VIN.</label>
        <label className="block"><input type="checkbox" name="condition_verified" required /> I checked the physical condition against the approved inspection.</label>
        <button disabled={busy} className="underline">Confirm physical intake</button></form>}
    {a.listing_id && <Link className="text-accent-blue" to={`/vehicles/${a.listing_id}`}>View inventory record</Link>}
    {editable && user.role === "manager" && a.received && trade.status === "Accepted" && <details><summary>Acquire without a showroom purchase</summary>
      <form className="space-y-2" onSubmit={e => submit(e,"acquisition-payment")}>
        <label className="block">Amount paid to customer<input className="input" name="amount" type="number" min=".01" step=".01" required /></label>
        <label className="block">Separate payment receipt<input className="input" name="reference" maxLength={100} required /></label>
        <button className="underline" disabled={busy}>Record acquisition payment</button>
      </form></details>}
    {a.settled_amount != null && <p>Separate payment {formatCurrency(a.settled_amount)} · {a.settlement_reference}</p>}
    {!a.listing_id && trade.status === "Completed" && a.received && !a.ready_for_resale && <p>Resale can proceed after the linked purchase is collected or standalone payment is recorded.</p>}
    {a.ready_for_resale && editable && hasModuleAccess(user,"vehicles",true) && <details><summary>Prepare resale listing</summary>
      <form className="space-y-2" onSubmit={e => submit(e, "publish")}><p>{a.title}</p>
        <label className="block">Retail description<textarea className="input" name="description" required defaultValue={a.description} /></label>
        <label className="block">Preparation cost<input className="input" type="number" min="0" step=".01" name="preparation_cost" required /></label>
        <label className="block">Retail price<input className="input" type="number" min=".01" step=".01" name="retail_price" required /></label>
        <label className="block"><input type="checkbox" name="photos_and_details_verified" required /> I verified photos, details and availability.</label>
        <button className="underline" disabled={busy}>Publish one used vehicle</button>
      </form></details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
