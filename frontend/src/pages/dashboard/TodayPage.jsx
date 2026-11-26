import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../api/axiosInstance";
import { useAuth } from "../../hooks/useAuth";

export default function TodayPage() {
  const { user } = useAuth();
  const queue = useQuery({ queryKey: ["today", user?.user_id], queryFn: async () => (await api.get("/api/v1/today")).data });
  const [params] = useSearchParams();
  const deal = params.get("deal");
  const tasks = (queue.data?.tasks || []).filter(task => !deal || String(task.deal_id) === deal);
  return <section className="max-w-4xl space-y-4">
    <h1 className="text-2xl font-bold">{deal ? `Deal #${deal} · assigned work` : "Today"}</h1>
    {deal && <Link className="underline" to="/today">Back to Today</Link>}
    {queue.isPending && <p role="status">Loading your work…</p>}
    {queue.isError && <p role="alert">Your work could not load. <button onClick={() => queue.refetch()}>Retry</button></p>}
    {queue.data && tasks.length === 0 && <p>No actions are due for your role today.</p>}
    {tasks.length > 0 && <ul className="divide-y divide-bg-border rounded-xl border border-bg-border bg-bg-card">
      {tasks.map((task, index) => <li key={task.path + index}><Link className="block p-4 hover:bg-bg-elevated" to={task.path}>
        <strong>{task.action}</strong><span className="block text-sm text-text-secondary">{task.detail} · {task.owner}</span></Link>
        {task.deal_id && !deal && <Link className="block px-4 pb-3 underline" to={task.deal_path}>Deal #{task.deal_id}</Link>}</li>)}
    </ul>}
  </section>;
}
