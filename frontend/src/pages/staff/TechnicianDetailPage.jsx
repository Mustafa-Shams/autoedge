import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffApi } from "../../api/staffApi";
import BackButton from "../../components/common/BackButton";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { apiError } from "../../utils/apiError";
import { StaffField } from "./StaffFields";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SPECIALTIES = ["General", "Mechanic", "Electrician", "AC Specialist", "Body & Paint", "Tyre & Alignment"];

export default function TechnicianDetailPage() {
  const { id } = useParams();
  const query = useQuery({ queryKey: ["technician-profile", id], queryFn: () => staffApi.technician(id) });
  if (query.isLoading) return <LoadingSpinner />;
  if (query.isError) return <><BackButton fallback="/staff?tab=technicians" /><p role="alert">{apiError(query.error, "Could not load profile.")}</p></>;
  return <TechnicianProfile key={id} profile={query.data} />;
}

function TechnicianProfile({ profile }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(profile);
  const [skill, setSkill] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const skills = (form.skills ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const days = (form.working_days ?? "").split(",").map((day) => day.trim());
  const specialties = Array.from(new Set([...SPECIALTIES, profile.specialty]));
  const photoUrl = /^https?:\/\//i.test(form.photo_url ?? "") ? form.photo_url : "";
  const save = useMutation({
    mutationFn: (payload) => staffApi.updateTechnician(profile.user_id, payload),
    onSuccess: (saved) => {
      setForm((previous) => ({ ...previous, ...saved }));
      queryClient.invalidateQueries({ queryKey: ["technician-profile", profile.user_id.toString()] });
      queryClient.invalidateQueries({ queryKey: ["technician-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      queryClient.invalidateQueries({ queryKey: ["staff-user", profile.user_id.toString()] });
    },
  });

  function change(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function addSkill() {
    const added = skill.split(",").map((item) => item.trim()).filter(Boolean);
    change("skills", Array.from(new Set([...skills, ...added])).join(", "));
    setSkill("");
  }

  function submit(event) {
    event.preventDefault();
    const fields = ["full_name", "phone", "specialty", "years_experience", "certifications", "skills",
      "working_days", "working_hours", "hourly_rate", "is_bookable", "photo_url", "bio"];
    const payload = Object.fromEntries(fields.map((field) => [field, form[field] === "" ? null : form[field]]));
    if (skill.trim()) payload.skills = Array.from(new Set([...skills, ...skill.split(",").map((item) => item.trim()).filter(Boolean)])).join(", ");
    save.mutate(payload);
    setSkill("");
  }

  return (
    <section className="max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/staff?tab=technicians" />
        <h1 className="text-2xl font-bold text-text-primary">{profile.full_name}</h1>
        <Link className="ml-auto text-sm text-accent-blue" to={"/staff/" + profile.user_id}>Staff account</Link>
      </header>
      <form onSubmit={submit} className="space-y-5 rounded-xl border border-bg-border bg-bg-card p-5">
        <h2 className="font-semibold text-text-primary">Technician profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StaffField label="Full name">
            <input className="input" value={form.full_name} required maxLength={100} onChange={(e) => change("full_name", e.target.value)} />
          </StaffField>
          <StaffField label="Phone">
            <input className="input" type="tel" value={form.phone ?? ""} maxLength={20} onChange={(e) => change("phone", e.target.value)} />
          </StaffField>
          <StaffField label="Specialty">
            <select className="input" value={form.specialty} onChange={(e) => change("specialty", e.target.value)}>
              {specialties.map((name) => <option key={name}>{name}</option>)}
            </select>
          </StaffField>
          <StaffField label="Years of experience">
            <input className="input" type="number" min="0" max="80" required value={form.years_experience}
              onChange={(e) => change("years_experience", e.target.value)} />
          </StaffField>
          <StaffField label="Certifications">
            <input className="input" value={form.certifications ?? ""} maxLength={1000} onChange={(e) => change("certifications", e.target.value)} />
          </StaffField>
          <StaffField label="Hourly rate (USD)">
            <input className="input" type="number" min="0" max="99999999.99" step="0.01" value={form.hourly_rate ?? ""}
              onChange={(e) => change("hourly_rate", e.target.value)} />
          </StaffField>
          <StaffField label="Working hours">
            <input className="input" value={form.working_hours ?? ""} maxLength={30} placeholder="09:00–17:00"
              onChange={(e) => change("working_hours", e.target.value)} />
          </StaffField>
          <StaffField label="Bookable">
            <select className="input" value={form.is_bookable ? "yes" : "no"} onChange={(e) => change("is_bookable", e.target.value === "yes")}>
              <option value="yes">Yes</option><option value="no">No</option>
            </select>
          </StaffField>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm text-text-secondary">Working days</legend>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((day) => (
              <label key={day} className="flex items-center gap-1 text-sm text-text-secondary">
                <input type="checkbox" checked={days.includes(day)} onChange={() => {
                  change("working_days", DAYS.filter((option) => option === day ? !days.includes(day) : days.includes(option)).join(", "));
                }} />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <StaffField label="Skill">
                <input className="input" value={skill} maxLength={100} onChange={(e) => setSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSkill(); } }} />
              </StaffField>
            </div>
            <button type="button" onClick={addSkill} className="rounded border border-bg-border px-3 py-2 text-sm text-accent-blue">Add skill</button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {skills.map((tag) => (
              <li key={tag} className="rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-primary">
                {tag} <button type="button" className="ml-1 text-text-muted" aria-label={"Remove " + tag}
                  onClick={() => change("skills", skills.filter((item) => item !== tag).join(", "))}>×</button>
              </li>
            ))}
          </ul>
        </div>
        <StaffField label="Photo URL">
          <input className="input" type="url" value={form.photo_url ?? ""} onChange={(e) => {
            setPhotoFailed(false);
            change("photo_url", e.target.value);
          }} />
        </StaffField>
        {photoUrl && !photoFailed && <img src={photoUrl} onError={() => setPhotoFailed(true)}
          className="h-28 w-28 rounded-lg object-cover" alt="Technician photo preview" />}
        {photoFailed && <p className="text-sm text-text-muted">Photo preview unavailable.</p>}
        <StaffField label="Bio">
          <textarea className="input" rows={4} maxLength={3000} value={form.bio ?? ""} onChange={(e) => change("bio", e.target.value)} />
        </StaffField>
        {save.isSuccess && <p role="status" className="text-sm text-status-available">Profile saved.</p>}
        {save.isError && <p role="alert" className="text-sm text-status-cancelled">{apiError(save.error, "Could not save profile.")}</p>}
        <button type="submit" className="rounded-lg bg-accent-blue-strong px-4 py-2 text-sm text-white" disabled={save.isPending}>Save profile</button>
      </form>
      <section className="space-y-3 rounded-xl border border-bg-border bg-bg-card p-5">
        <h2 className="font-semibold text-text-primary">Upcoming bookings</h2>
        {profile.upcoming_bookings.length === 0 && <p className="text-sm text-text-muted">No upcoming bookings.</p>}
        <ul className="divide-y divide-bg-border text-sm text-text-secondary">
          {profile.upcoming_bookings.map((booking) => (
            <li key={booking.booking_id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{booking.service_type} · {booking.status}</span>
              <span>{booking.booking_date} at {booking.time_slot.slice(0, 5)}</span>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
