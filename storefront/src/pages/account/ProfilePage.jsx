/**
 * ProfilePage — edit name/phone/address, change password.
 * Spec 10.3 — email is read-only.
 */
import { useState, useEffect } from 'react';
import useAuth from '../../hooks/useAuth';
import { getProfile, updateProfile, changePassword } from '../../api/storeApi';
import PasswordField from '../../components/forms/PasswordField';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import BackButton from '../../components/common/BackButton';

export default function ProfilePage() {
  const { customer } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [form, setForm] = useState({ full_name: '', phone: '', address: '' });
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await getProfile();
        setProfile(res.data);
        setForm({
          full_name: res.data.full_name || '',
          phone: res.data.phone || '',
          address: res.data.address || '',
        });
      } catch {
        setProfileMsg({ type: 'error', text: 'Failed to load profile' });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleProfileChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setProfileMsg({ type: '', text: '' });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await updateProfile({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || null,
      });
      setProfile(res.data);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setProfileMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to update profile' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePwChange = (e) => {
    setPwForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setPwMsg({ type: '', text: '' });
  };

  const handlePwSubmit = async (e) => {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_password) {
      setPwMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    try {
      setSavingPw(true);
      await changePassword(pwForm);
      setPwForm({ current_password: '', new_password: '', confirm_password: '' });
      setPwMsg({ type: 'success', text: 'Password changed successfully' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPwMsg({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to change password' });
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading profile…" />;

  const inputClasses = 'w-full px-4 py-2.5 bg-bg-elevated border border-bg-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent transition-colors';

  return (
    <div className="space-y-8">
      <div>
        <BackButton fallback="/account" label="Back to Account" className="mb-4" />
        <h1 className="text-2xl font-bold text-text-primary">Profile</h1>
      </div>

      {/* Profile form */}
      <div className="bg-bg-card border border-bg-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Personal Information</h2>

        {profileMsg.text && (
          <div className={`rounded-lg p-3 mb-4 ${profileMsg.type === 'success' ? 'bg-status-available/10 border border-status-available/20' : 'bg-status-cancelled/10 border border-status-cancelled/20'}`}>
            <p className={`text-sm ${profileMsg.type === 'success' ? 'text-status-available' : 'text-status-cancelled'}`}>{profileMsg.text}</p>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">Email (read-only)</label>
            <input
              type="email"
              value={profile?.email || ''}
              disabled
              className={`${inputClasses} opacity-60 cursor-not-allowed`}
            />
          </div>

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-text-secondary mb-1.5">Full Name</label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleProfileChange}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-text-secondary mb-1.5">Phone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleProfileChange}
              className={inputClasses}
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-text-secondary mb-1.5">Address</label>
            <textarea
              id="address"
              name="address"
              value={form.address}
              onChange={handleProfileChange}
              rows={3}
              placeholder="Enter your address (optional)"
              className={inputClasses}
            />
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {savingProfile ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-bg-card border border-bg-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Change Password</h2>

        {pwMsg.text && (
          <div className={`rounded-lg p-3 mb-4 ${pwMsg.type === 'success' ? 'bg-status-available/10 border border-status-available/20' : 'bg-status-cancelled/10 border border-status-cancelled/20'}`}>
            <p className={`text-sm ${pwMsg.type === 'success' ? 'text-status-available' : 'text-status-cancelled'}`}>{pwMsg.text}</p>
          </div>
        )}

        <form onSubmit={handlePwSubmit} className="space-y-4">
          <PasswordField
            id="current_password"
            name="current_password"
            label="Current Password"
            value={pwForm.current_password}
            onChange={handlePwChange}
            required
            autoComplete="current-password"
          />
          <PasswordField
            id="new_password"
            name="new_password"
            label="New Password"
            value={pwForm.new_password}
            onChange={handlePwChange}
            placeholder="At least 8 characters"
            required
            autoComplete="new-password"
          />
          <PasswordField
            id="confirm_password"
            name="confirm_password"
            label="Confirm New Password"
            value={pwForm.confirm_password}
            onChange={handlePwChange}
            required
            autoComplete="new-password"
          />

          <button
            type="submit"
            disabled={savingPw}
            className="px-6 py-2.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {savingPw ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
