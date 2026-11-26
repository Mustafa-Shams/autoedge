import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/axiosInstance";

export default function SalesAssistance({ customer, vehicle, user, commission }) {
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState("walk-in");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const url = "/api/v1/sales/assistance";
  const result = useQuery({ queryKey: ["sales-assistance", customer, vehicle, user.user_id], queryFn: async () =>
    (await api.get(url, { params: { customer_id: customer, vehicle_id: vehicle } })).data });
  const current = result.data?.current;
  const ownerId = user.role === "sales_executive" ? user.user_id : Number(owner);
  const sources = result.data?.sources.filter(s => s.owner_id === ownerId) || [];
  const selected = sources.find(item => source === item.kind + item.source_id);
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (current) await api.post(`${url}/${current.id}/close`);
      else await api.post(url, { customer_id: Number(customer), vehicle_id: Number(vehicle), owner_id: ownerId,
        kind: selected?.kind || "Walk-in", source_id: selected?.source_id, note });
      await result.refetch();
    } catch (err) { setError(err.response?.data?.detail || "Could not save assistance."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-xl border border-bg-border bg-bg-card p-5 space-y-3">
    <h3 className="font-semibold">Sales assistance</h3>
    {result.isPending && <p role="status">Loading ownership…</p>}
    {result.isError && <p role="alert">Could not load assistance. <button type="button" onClick={() => result.refetch()}>Retry</button></p>}
    {current ? <><p>{current.owner} · {current.kind} · {current.note}</p><p>Commission at pickup ${commission}</p>
      {(user.role === "manager" || current.owner_id === user.user_id) &&
        <button type="button" className="underline" disabled={busy} onClick={save}>Close unconverted assistance</button>}</> :
      result.data && <details><summary className="cursor-pointer">Assign an owner before payment</summary>
        <div className="mt-3 space-y-2">
          {user.role === "manager" && <label className="block">Salesperson<select aria-label="Salesperson" className="input" value={owner} onChange={e => { setOwner(e.target.value); setSource("walk-in"); }}>
            <option value="">Choose salesperson</option>{result.data.owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}
          <label className="block">Qualifying assistance<select aria-label="Qualifying assistance" className="input" value={source} onChange={e => setSource(e.target.value)}>
            <option value="walk-in">Record walk-in appointment</option>{sources.map(s =>
              <option key={s.kind + s.source_id} value={s.kind + s.source_id}>{s.kind} · {s.label}</option>)}</select></label>
          <label className="block">What did the salesperson help with?<input className="input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
          <button type="button" className="underline" disabled={busy || !ownerId || note.trim().length < 3} onClick={save}>Save pre-payment ownership</button>
        </div>
      </details>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
