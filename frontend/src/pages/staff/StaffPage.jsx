import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, Wrench } from "lucide-react";
import { staffApi } from "../../api/staffApi";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { apiError } from "../../utils/apiError";
import { STAFF_ROLES } from "../../utils/staffAccess";

const PAGE_SIZE = 50;

export default function StaffPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const showTechnicians = params.get("tab") === "technicians";
  const [page, setPage] = useState(0);
  const listKey = ["staff-users", page];
  const [notice, setNotice] = useState(null);

  const users = useQuery({
    queryKey: listKey,
    queryFn: () => staffApi.list({ skip: page * PAGE_SIZE, limit: PAGE_SIZE + 1 }),
    enabled: !showTechnicians,
  });
  const technicians = useQuery({
    queryKey: ["technician-profiles"],
    queryFn: staffApi.technicians,
    enabled: showTechnicians,
  });

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const toggle = useMutation({
    mutationFn: ({ id, value }) => staffApi.toggleEnquiries(id, value),
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (rows) =>
        rows?.map((user) => user.user_id === id ? { ...user, handles_enquiries: value } : user));
      return previous;
    },
    onSuccess: (user) => setNotice({ text: "Enquiry access updated for " + user.full_name + "." }),
    onError: (error, _, previous) => {
      queryClient.setQueryData(listKey, previous);
      setNotice({ error: true, text: apiError(error, "Could not update enquiry access.") });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
  });

  const current = showTechnicians ? technicians : users;
  const rows = current.data ?? [];

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Staff Management</h1>
        <Link to="/staff/new" className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm text-white">
          <Plus size={16} /> Add staff
        </Link>
      </header>
      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={!showTechnicians} onClick={() => setParams({})}
          className="inline-flex items-center gap-2 rounded-lg border border-bg-border px-3 py-2 text-sm text-text-primary aria-pressed:bg-bg-elevated">
          <Users size={16} /> Staff users
        </button>
        <button type="button" aria-pressed={showTechnicians} onClick={() => setParams({ tab: "technicians" })}
          className="inline-flex items-center gap-2 rounded-lg border border-bg-border px-3 py-2 text-sm text-text-primary aria-pressed:bg-bg-elevated">
          <Wrench size={16} /> Technicians
        </button>
      </div>

      {current.isLoading && <LoadingSpinner />}
      {current.isError && <p role="alert" className="text-status-cancelled">{apiError(current.error, "Could not load staff.")}</p>}
      {current.isSuccess && !rows.length && <p className="text-text-muted">No {showTechnicians ? "technicians" : "staff users"} found.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-bg-border bg-bg-card">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="border-b border-bg-border text-text-muted">
              <tr>
                <th className="p-4">Name</th>
                <th className="p-4">{showTechnicians ? "Specialty" : "Role"}</th>
                <th className="p-4">Status</th>
                <th className="p-4">{showTechnicians ? "Bookable" : "Handles enquiries"}</th>
              </tr>
            </thead>
            <tbody>
              {(showTechnicians ? rows : rows.slice(0, PAGE_SIZE)).map((user) => (
                <tr key={user.user_id} className="cursor-pointer border-b border-bg-border last:border-none hover:bg-bg-elevated"
                  onClick={(event) => {
                    if (!event.target.closest("a,button")) navigate((showTechnicians ? "/staff/technicians/" : "/staff/") + user.user_id);
                  }}>
                  <td className="p-4">
                    <Link to={showTechnicians ? "/staff/technicians/" + user.user_id : "/staff/" + user.user_id}
                      className="font-medium text-accent-blue hover:underline">{user.full_name}</Link>
                    <span className="block text-xs text-text-muted">{user.email}</span>
                  </td>
                  <td className="p-4">{showTechnicians ? user.specialty : STAFF_ROLES[user.role]}</td>
                  <td className="p-4">{user.is_active ? "Active" : "Inactive"}</td>
                  <td className="p-4">
                    {showTechnicians ? (user.is_bookable && user.is_active ? "Yes" : "No") : (
                      user.role === "manager" ? "Always" : ["sales_executive", "receptionist"].includes(user.role) ? (
                        <button type="button" role="switch" aria-checked={user.handles_enquiries}
                          aria-label={"Handles enquiries for " + user.full_name} disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: user.user_id, value: !user.handles_enquiries })}
                          className="rounded-full border border-bg-border px-3 py-1 text-xs aria-checked:bg-accent-blue/15 aria-checked:text-accent-blue">
                          {user.handles_enquiries ? "On" : "Off"}
                        </button>
                      ) : "Unavailable"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!showTechnicians && (page > 0 || rows.length > PAGE_SIZE) && (
        <div className="flex gap-4 text-sm text-text-secondary">
          <button disabled={page === 0} className="disabled:opacity-40" onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {page + 1}</span>
          <button disabled={rows.length <= PAGE_SIZE} className="disabled:opacity-40" onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
      {notice && (
        <div role={notice.error ? "alert" : "status"}
          className="fixed bottom-5 right-5 z-50 rounded-lg border border-bg-border bg-bg-elevated px-4 py-3 text-sm text-text-primary shadow-lg">
          {notice.text}
        </div>
      )}
    </section>
  );
}
