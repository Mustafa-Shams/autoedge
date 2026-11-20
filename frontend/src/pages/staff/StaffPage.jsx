import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Wrench, ToggleLeft, ToggleRight, Edit2, Save, X } from "lucide-react";
import axios from "../../api/axiosInstance";
import PageWrapper from "../../components/layout/PageWrapper";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmptyState from "../../components/common/EmptyState";

const SPECIALTIES = ["Mechanic", "Electrician", "AC Specialist", "Body & Paint", "Tyre & Alignment"];

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");
  const [editingProfile, setEditingProfile] = useState(null);
  const [editForm, setEditForm] = useState({});

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => axios.get("/api/v1/users/", { params: { limit: 100 } }).then((r) => r.data),
  });

  // Fetch technician profiles
  const { data: techProfiles = [], isLoading: techLoading } = useQuery({
    queryKey: ["technician-profiles"],
    queryFn: () => axios.get("/api/v1/technician-profiles").then((r) => r.data),
  });

  // Toggle handles_enquiries
  const toggleEnquiryMutation = useMutation({
    mutationFn: ({ userId, handles_enquiries }) =>
      axios.put(`/api/v1/users/${userId}/enquiry-access`, { handles_enquiries }),
    onSuccess: () => queryClient.invalidateQueries(["staff-users"]),
  });

  // Update technician profile
  const updateProfileMutation = useMutation({
    mutationFn: ({ userId, data }) =>
      axios.put(`/api/v1/technician-profiles/${userId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["technician-profiles"]);
      setEditingProfile(null);
      setEditForm({});
    },
  });

  function startEditing(profile) {
    setEditingProfile(profile.user_id);
    setEditForm({
      specialty: profile.specialty,
      years_experience: profile.years_experience,
      bio: profile.bio || "",
      photo_url: profile.photo_url || "",
      is_bookable: profile.is_bookable,
    });
  }

  function saveProfile(userId) {
    updateProfileMutation.mutate({
      userId,
      data: {
        ...editForm,
        years_experience: parseInt(editForm.years_experience) || 0,
      },
    });
  }

  const tabs = [
    { key: "users", label: "Staff Users", icon: Users },
    { key: "technicians", label: "Technician Profiles", icon: Wrench },
  ];

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Staff Management</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            Manage enquiry access and technician profiles
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-1 w-fit">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-bg-card text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            {usersLoading ? (
              <div className="p-8"><LoadingSpinner /></div>
            ) : users.length === 0 ? (
              <div className="p-8"><EmptyState title="No staff users" /></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-bg-border">
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-text-muted px-4 py-3">Name</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-text-muted px-4 py-3">Email</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-text-muted px-4 py-3">Role</th>
                    <th className="text-left text-xs font-medium uppercase tracking-wide text-text-muted px-4 py-3">Status</th>
                    <th className="text-center text-xs font-medium uppercase tracking-wide text-text-muted px-4 py-3">Handles Enquiries</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id} className="border-b border-bg-border last:border-0 hover:bg-bg-elevated/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-accent-blue">
                              {user.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-text-primary">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-secondary">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-bg-elevated text-text-secondary capitalize">
                          {user.role?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.is_active
                            ? "bg-status-available/15 text-status-available"
                            : "bg-status-cancelled/15 text-status-cancelled"
                        }`}>
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {/* Only show toggle for non-technician roles that could handle enquiries */}
                        {["sales_executive", "receptionist"].includes(user.role) ? (
                          <button
                            onClick={() => toggleEnquiryMutation.mutate({
                              userId: user.user_id,
                              handles_enquiries: !user.handles_enquiries,
                            })}
                            disabled={toggleEnquiryMutation.isPending}
                            className="inline-flex items-center justify-center"
                            title={user.handles_enquiries ? "Click to remove enquiry access" : "Click to grant enquiry access"}
                          >
                            {user.handles_enquiries ? (
                              <ToggleRight className="w-8 h-8 text-status-available" />
                            ) : (
                              <ToggleLeft className="w-8 h-8 text-text-muted" />
                            )}
                          </button>
                        ) : user.role === "manager" ? (
                          <span className="text-xs text-text-muted">Always</span>
                        ) : (
                          <span className="text-xs text-text-muted">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Technician Profiles Tab */}
        {activeTab === "technicians" && (
          <div className="space-y-4">
            {techLoading ? (
              <LoadingSpinner />
            ) : techProfiles.length === 0 ? (
              <EmptyState title="No technician profiles" message="Technician profiles are created when technician users are added." />
            ) : (
              techProfiles.map((profile) => (
                <div key={profile.user_id} className="bg-bg-card border border-bg-border rounded-xl p-5">
                  {editingProfile === profile.user_id ? (
                    /* Edit Mode */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-text-primary">{profile.full_name}</h3>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveProfile(profile.user_id)}
                            disabled={updateProfileMutation.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-status-available/15 text-status-available hover:bg-status-available/25"
                          >
                            <Save className="w-3.5 h-3.5" />
                            {updateProfileMutation.isPending ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => { setEditingProfile(null); setEditForm({}); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-bg-elevated text-text-secondary hover:bg-bg-border"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">Specialty</label>
                          <select
                            value={editForm.specialty}
                            onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                            className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm"
                          >
                            {SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">Years Experience</label>
                          <input
                            type="number"
                            value={editForm.years_experience}
                            onChange={(e) => setEditForm({ ...editForm, years_experience: e.target.value })}
                            className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">Bookable</label>
                          <select
                            value={editForm.is_bookable}
                            onChange={(e) => setEditForm({ ...editForm, is_bookable: e.target.value === "true" })}
                            className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm"
                          >
                            <option value="true">Yes — Accepts bookings</option>
                            <option value="false">No — Not bookable</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">Photo URL</label>
                        <input
                          value={editForm.photo_url}
                          onChange={(e) => setEditForm({ ...editForm, photo_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium uppercase tracking-wide text-text-muted mb-1.5">Bio</label>
                        <textarea
                          value={editForm.bio}
                          onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                          rows={3}
                          placeholder="Short bio about the technician..."
                          className="w-full bg-bg-elevated border border-bg-border text-text-primary rounded-lg px-3 py-2 text-sm resize-none"
                        />
                      </div>
                      {updateProfileMutation.isError && (
                        <p className="text-xs text-status-cancelled">
                          {updateProfileMutation.error?.response?.data?.detail ?? "Failed to update."}
                        </p>
                      )}
                    </div>
                  ) : (
                    /* View Mode */
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0">
                          {profile.photo_url ? (
                            <img
                              src={profile.photo_url}
                              alt={profile.full_name}
                              className="w-12 h-12 rounded-full object-cover"
                              onError={(e) => { e.target.style.display = "none"; }}
                            />
                          ) : (
                            <span className="text-lg font-bold text-accent-blue">
                              {profile.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-text-primary">{profile.full_name}</h3>
                          <p className="text-sm text-text-secondary">{profile.email}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent-blue/15 text-accent-blue">
                              {profile.specialty}
                            </span>
                            <span className="text-xs text-text-muted">
                              {profile.years_experience} year{profile.years_experience !== 1 ? "s" : ""} experience
                            </span>
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              profile.is_bookable
                                ? "bg-status-available/15 text-status-available"
                                : "bg-status-cancelled/15 text-status-cancelled"
                            }`}>
                              {profile.is_bookable ? "Bookable" : "Not Bookable"}
                            </span>
                          </div>
                          {profile.bio && (
                            <p className="text-sm text-text-secondary mt-2 max-w-lg">{profile.bio}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => startEditing(profile)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-bg-elevated text-text-secondary hover:bg-bg-border hover:text-text-primary transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
