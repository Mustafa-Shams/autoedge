import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import BackButton from '../../components/common/BackButton';

export default function GaragePage() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingCar, setEditingCar] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    make: '', model: '', year: '', color: '', plate_number: '', vin_number: '',
  });
  const [formError, setFormError] = useState('');

  const fetchCars = async () => {
    try {
      setLoading(true);
      const res = await storeApi.getGarage();
      setCars(res.data);
    } catch {
      setError('Failed to load your garage.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCars(); }, []);

  const openAdd = () => {
    setEditingCar(null);
    setForm({ make: '', model: '', year: '', color: '', plate_number: '', vin_number: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (car) => {
    setEditingCar(car);
    setForm({
      make: car.make || '',
      model: car.model || '',
      year: car.year?.toString() || '',
      color: car.color || '',
      plate_number: car.plate_number || '',
      vin_number: car.vin_number || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.make.trim() || !form.model.trim() || !form.year) {
      setFormError('Make, model, and year are required.');
      return;
    }
    const yearNum = parseInt(form.year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2030) {
      setFormError('Please enter a valid year (1900–2030).');
      return;
    }

    setSaving(true);
    const payload = {
      make: form.make.trim(),
      model: form.model.trim(),
      year: yearNum,
      color: form.color.trim() || null,
      plate_number: form.plate_number.trim() || null,
      vin_number: form.vin_number.trim() || null,
    };

    try {
      if (editingCar) {
        await storeApi.updateGarageCar(editingCar.cv_id, payload);
      } else {
        await storeApi.addGarageCar(payload);
      }
      setShowModal(false);
      fetchCars();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to save vehicle.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await storeApi.deleteGarageCar(deleteTarget.cv_id);
      setDeleteTarget(null);
      fetchCars();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to remove vehicle.';
      setDeleteTarget(null);
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading your garage…" />;

  return (
    <div>
      <BackButton fallback="/account" label="Back to Account" className="mb-4" />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">My Garage</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your vehicles. You need at least one car to book a service.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Vehicle
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg text-sm text-status-cancelled">
          {error}
        </div>
      )}

      {/* Cars list */}
      {cars.length === 0 ? (
        <EmptyState
          icon={
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
            </svg>
          }
          title="No vehicles yet"
          description="Add a vehicle to your garage to book services."
          action={openAdd}
          actionLabel="Add Your First Vehicle"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <div
              key={car.cv_id}
              className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/30 transition-colors"
            >
              {/* Car icon */}
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
                  </svg>
                </div>
                {car.source_sale_id && (
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-status-available/20 text-status-available rounded-full">
                    Purchased
                  </span>
                )}
              </div>

              {/* Details */}
              <h3 className="text-base font-semibold text-text-primary">
                {car.year} {car.make} {car.model}
              </h3>
              <div className="mt-2 space-y-1">
                {car.color && (
                  <p className="text-xs text-text-secondary flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-bg-elevated border border-bg-border inline-block" />
                    {car.color}
                  </p>
                )}
                {car.plate_number && (
                  <p className="text-xs text-text-secondary">
                    Plate: <span className="font-mono text-text-primary">{car.plate_number}</span>
                  </p>
                )}
                {car.vin_number && (
                  <p className="text-xs text-text-secondary">
                    VIN: <span className="font-mono text-text-primary">{car.vin_number}</span>
                  </p>
                )}
              </div>

              {/* Active booking badge */}
              {car.has_active_booking && (
                <div className="mt-3 px-2 py-1 bg-accent-blue/10 border border-accent-blue/20 rounded-lg">
                  <p className="text-[11px] text-accent-blue font-medium">Active service booking</p>
                </div>
              )}

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => openEdit(car)}
                  className="flex-1 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeleteTarget(car)}
                  disabled={car.has_active_booking}
                  className="flex-1 py-1.5 text-xs font-medium text-status-cancelled hover:text-status-cancelled/80 bg-status-cancelled/10 hover:bg-status-cancelled/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={car.has_active_booking ? 'Cannot delete — has active booking' : 'Remove vehicle'}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Book a service CTA */}
      {cars.length > 0 && (
        <div className="mt-6 p-4 bg-bg-card border border-bg-border rounded-xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Ready to book a service?</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Select a vehicle, service type, and pick your preferred time slot.
            </p>
          </div>
          <Link
            to="/account/service-bookings/new"
            className="px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            Book a Service
          </Link>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl max-w-md w-full">
            <form onSubmit={handleSubmit}>
              <div className="flex items-center justify-between p-6 border-b border-bg-border">
                <h2 className="text-lg font-bold text-text-primary">
                  {editingCar ? 'Edit Vehicle' : 'Add Vehicle'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Make */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Make *</label>
                  <input
                    type="text"
                    value={form.make}
                    onChange={(e) => setForm(f => ({ ...f, make: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. Toyota"
                    required
                  />
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Model *</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. Corolla"
                    required
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Year *</label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm(f => ({ ...f, year: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. 2022"
                    min="1900"
                    max="2030"
                    required
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Color</label>
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. Silver"
                  />
                </div>

                {/* Plate Number */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={form.plate_number}
                    onChange={(e) => setForm(f => ({ ...f, plate_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. ABC-1234"
                  />
                </div>

                {/* VIN */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1">VIN Number</label>
                  <input
                    type="text"
                    value={form.vin_number}
                    onChange={(e) => setForm(f => ({ ...f, vin_number: e.target.value }))}
                    className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted"
                    placeholder="e.g. 1HGBH41JXMN109186"
                    maxLength={30}
                  />
                </div>

                {formError && (
                  <p className="text-sm text-status-cancelled">{formError}</p>
                )}
              </div>

              <div className="flex items-center gap-3 p-6 border-t border-bg-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editingCar ? 'Save Changes' : 'Add Vehicle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove Vehicle"
        message={deleteTarget ? `Remove "${deleteTarget.year} ${deleteTarget.make} ${deleteTarget.model}" from your garage? This cannot be undone.` : ''}
        confirmLabel="Remove"
        variant="danger"
        isLoading={deleting}
      />
    </div>
  );
}
