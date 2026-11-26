import ModalOverlay from '../common/ModalOverlay';
/**
 * TestDriveModal — slot picker for booking test drives from CarDetailPage.
 * Per spec 7.3 and 11.4: date picker (today+2h to +30 days, Mon–Sat),
 * hourly slots 09:00–17:00, shows available/taken, notes field.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTestDriveSlots } from '../../api/publicApi';
import * as storeApi from '../../api/storeApi';
import LoadingSpinner from '../common/LoadingSpinner';

// Generate next 30 days of valid dates (Mon–Sat)
function getValidDates() {
  const dates = [];
  const today = new Date();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const day = d.getDay(); // 0=Sun
    if (day !== 0) {
      // Mon=1 through Sat=6
      dates.push(d);
    }
  }
  return dates;
}

function formatDateStr(d) {
  return d.toISOString().split('T')[0];
}

function formatDateLabel(d) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (formatDateStr(d) === formatDateStr(today)) return 'Today';
  if (formatDateStr(d) === formatDateStr(tomorrow)) return 'Tomorrow';

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function TestDriveModal({ isOpen, onClose, vehicle }) {
  const navigate = useNavigate();

  const [validDates] = useState(getValidDates);
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(validDates.length > 0 ? validDates[0] : null);
      setSelectedTime(null);
      setSlots([]);
      setNotes('');
      setError('');
      setSuccess(false);
      setSubmitting(false);
    }
  }, [isOpen, validDates]);

  // Fetch slots when date changes
  useEffect(() => {
    if (!isOpen || !selectedDate || !vehicle) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setSelectedTime(null);
      try {
        const res = await getTestDriveSlots(vehicle.vehicle_id, formatDateStr(selectedDate));
        setSlots(res.data.slots || []);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [isOpen, selectedDate, vehicle]);



  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDate || !selectedTime || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await storeApi.requestTestDrive({
        vehicle_id: vehicle.vehicle_id,
        scheduled_date: formatDateStr(selectedDate),
        scheduled_time: selectedTime,
        notes: notes.trim() || null,
      });
      setSuccess(true);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to request test drive.';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay onDismiss={submitting ? undefined : onClose} aria-label="Book a test drive"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !success) onClose();
      }}
    >
      <div className="bg-bg-card border border-bg-border rounded-2xl shadow-2xl max-w-lg w-full my-4">
        {/* Success state */}
        {success ? (
          <div className="p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-status-available/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary">Test Drive Requested!</h2>
              <p className="text-sm text-text-secondary mt-1 text-center">
                Your test drive request has been submitted. We'll confirm shortly (within 48 hours).
              </p>
            </div>

            <div className="bg-bg-elevated rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div>
                  <span className="text-text-muted text-xs">Vehicle</span>
                  <p className="text-text-primary font-medium">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </p>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Date</span>
                  <p className="text-text-primary font-medium">
                    {selectedDate ? formatDateLabel(selectedDate) + ', ' + formatDateStr(selectedDate) : '—'}
                  </p>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Time</span>
                  <p className="text-text-primary font-medium">{selectedTime || '—'}</p>
                </div>
                <div>
                  <span className="text-text-muted text-xs">Status</span>
                  <p className="text-status-reserved font-medium">Awaiting Confirmation</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  navigate('/account/test-drives');
                  onClose();
                }}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue-strong hover:bg-accent-blue-strong-hover rounded-xl transition-colors"
              >
                View My Test Drives
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-bg-border">
              <div>
                <h2 className="text-lg font-bold text-text-primary">Book a Test Drive</h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  {vehicle.year} {vehicle.make} {vehicle.model}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-elevated transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Date picker — horizontal scroll */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Select Date
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  {validDates.slice(0, 14).map((d) => {
                    const isSelected = selectedDate && formatDateStr(d) === formatDateStr(selectedDate);
                    return (
                      <button
                        key={formatDateStr(d)}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                            : 'border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-bg-border'
                        }`}
                      >
                        <span className="font-medium">
                          {d.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="text-[11px] mt-0.5">
                          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Select Time Slot
                </label>
                {loadingSlots ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="w-4 h-4 border-2 border-bg-border border-t-accent-blue rounded-full animate-spin" />
                    <span className="text-sm text-text-muted">Loading available slots…</span>
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-text-muted py-4">
                    No slots available for this date. Try another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      const isAvailable = slot.available;

                      return (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedTime(slot.time);
                              setError('');
                            }
                          }}
                          disabled={!isAvailable}
                          className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                            isSelected
                              ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                              : isAvailable
                                ? 'border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary'
                                : 'border-bg-border/50 bg-bg-elevated/50 text-text-muted line-through cursor-not-allowed opacity-50'
                          }`}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="td-notes" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Notes <span className="text-text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  id="td-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requests or preferences…"
                  rows={2}
                  className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue resize-none"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
                  <p className="text-sm text-status-cancelled">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 p-6 border-t border-bg-border">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-elevated hover:bg-bg-border rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedDate || !selectedTime}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue-strong hover:bg-accent-blue-strong-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Requesting…
                  </>
                ) : (
                  'Request Test Drive'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </ModalOverlay>
  );
}
