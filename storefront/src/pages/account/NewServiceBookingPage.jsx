/**
 * NewServiceBookingPage — multi-step service booking form per spec 7.8.
 *
 * Steps:
 * 1. Select vehicle from garage
 * 2. Select service type
 * 3. Select technician (or "No Preference") — filtered by required_specialty
 * 4. Select date (Mon–Sat, tomorrow → +30 days) and time slot (09:00–16:00)
 * 5. Payment confirmation (password + idempotency key)
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import * as storeApi from '../../api/storeApi';
import * as publicApi from '../../api/publicApi';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PasswordField from '../../components/forms/PasswordField';
import BankCard from '../../components/payment/BankCard';
import PinHint from '../../components/payment/PinHint';
import ProcessingSteps from '../../components/payment/ProcessingSteps';
import BackButton from '../../components/common/BackButton';
import { formatPrice, formatDate } from '../../utils/formatters';

function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Generate dates: tomorrow to +30 days, Mon–Sat only
function getAvailableDates() {
  const dates = [];
  const now = new Date();
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    if (d.getDay() !== 0) {
      // Not Sunday
      dates.push({
        date: d.toISOString().split('T')[0],
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long' }),
      });
    }
  }
  return dates;
}

const TIME_SLOTS = Array.from({ length: 8 }, (_, i) => {
  const hour = 9 + i;
  return { value: `${hour.toString().padStart(2, '0')}:00`, label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}` };
});

export default function NewServiceBookingPage() {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const requestedCar = Number(searchParams.get('car'));

  // Data
  const [garageCars, setGarageCars] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [bankSummary, setBankSummary] = useState(null);
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBank, setLoadingBank] = useState(false);

  // Form state
  const [step, setStep] = useState(1); // 1: car, 2: service type, 3: technician, 4: date/time, 5: payment
  const [selectedCar, setSelectedCar] = useState(null);
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState(null); // null = "No Preference"
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [phase, setPhase] = useState('form'); // 'form' | 'processing' | 'success'
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  const availableDates = useMemo(() => getAvailableDates(), []);
  const idempotencyKey = useMemo(() => generateIdempotencyKey(), []);

  // Load initial data
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [carsRes, typesRes] = await Promise.all([
          storeApi.getGarage(),
          publicApi.getServiceTypes(),
        ]);
        const availableCars = carsRes.data.filter(car => !car.traded_in);
        setGarageCars(availableCars);
        const requested = availableCars.find(car => car.cv_id === requestedCar);
        if (requested) {
          setSelectedCar(requested);
          setStep(2);
        }
        setServiceTypes(typesRes.data.filter(t => t.is_active !== false));
      } catch {
        setError('Failed to load data. Please try again.');
      } finally {
        setLoadingInit(false);
      }
    };
    loadAll();
  }, [requestedCar]);

  // Load technicians when service type is selected (filter by specialty)
  useEffect(() => {
    if (!selectedServiceType) return;
    setLoadingTechs(true);
    const specialty = selectedServiceType.required_specialty || undefined;
    publicApi.getTechnicians(specialty)
      .then((res) => setTechnicians(res.data))
      .catch(() => setTechnicians([]))
      .finally(() => setLoadingTechs(false));
  }, [selectedServiceType]);

  // Load slot availability when technician + date is selected
  useEffect(() => {
    if (!selectedDate) { setAvailability(null); return; }
    if (selectedTechId === null) {
      // No preference — show all slots as available
      setAvailability(TIME_SLOTS.map(s => ({ time: s.value, available: true })));
      return;
    }
    setLoadingSlots(true);
    publicApi.getTechnicianAvailability(selectedTechId, selectedDate)
      .then((res) => setAvailability(res.data.slots))
      .catch(() => setAvailability(TIME_SLOTS.map(s => ({ time: s.value, available: true }))))
      .finally(() => setLoadingSlots(false));
  }, [selectedTechId, selectedDate]);

  // Load bank when reaching payment step
  useEffect(() => {
    if (step !== 5) return;
    setLoadingBank(true);
    storeApi.getBankSummary()
      .then((res) => setBankSummary(res.data))
      .catch(() => setBankSummary(null))
      .finally(() => setLoadingBank(false));
  }, [step]);

  const bookingFee = selectedServiceType
    ? parseFloat(selectedServiceType.booking_fee)
    : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || phase !== 'form') return;
    if (!password.trim()) {
      setError('Please enter your password to confirm payment.');
      return;
    }

    setError('');
    setSubmitting(true);
    setPhase('processing');

    try {
      const res = await storeApi.createServiceBooking({
        cv_id: selectedCar.cv_id,
        service_type_id: selectedServiceType.service_type_id,
        technician_id: selectedTechId || null,
        booking_date: selectedDate,
        time_slot: selectedSlot,
        notes: notes.trim() || null,
        password: password.trim(),
        idempotency_key: idempotencyKey,
      });
      setBookingResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || '';

      if (status === 401) setError('Incorrect password. Please try again.');
      else if (status === 402) setError(detail || 'Payment declined — insufficient funds.');
      else if (status === 409) setError(detail || 'Time slot is no longer available.');
      else if (status === 422) setError(detail || 'Invalid request. Please check your inputs.');
      else setError(detail || 'Something went wrong. Please try again.');

      setPhase('form');
      setSubmitting(false);
    }
  };

  const handleProcessingComplete = () => {
    setPhase('success');
  };

  const selectedTech = technicians.find(t => t.user_id === selectedTechId);

  if (loadingInit) return <LoadingSpinner text="Loading…" />;

  // ── No cars in garage ─────────────────────────────────────────────
  if (error && !garageCars.length) return <p role="alert">{error} <button className="underline" onClick={() => window.location.reload()}>Retry</button></p>;
  if (garageCars.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg className="w-16 h-16 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
        </svg>
        <h3 className="text-lg font-semibold text-text-primary mb-1">No vehicles in your garage</h3>
        <p className="text-sm text-text-secondary max-w-md mb-4">
          You need at least one vehicle in your garage to book a service.
        </p>
        <Link
          to="/account/garage"
          className="px-5 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-medium rounded-lg transition-colors"
        >
          Go to My Garage
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton fallback="/account/service-bookings" label="Back to Service Bookings" className="mb-4" />

      <h1 className="text-2xl font-bold text-text-primary mb-1">Book a Service</h1>
      <p className="text-sm text-text-secondary mb-6">
        Follow the steps below to schedule a service appointment.
      </p>

      {/* Progress bar */}
      {phase === 'form' && (
        <div className="flex items-center gap-1 mb-8">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                s <= step ? 'bg-accent-blue' : 'bg-bg-border'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── STEP 1: Select Vehicle ──────────────────────────────── */}
      {phase === 'form' && step === 1 && (
        <div>
          <h2 className="text-base font-semibold text-text-primary mb-3">
            1. Select a Vehicle
          </h2>
          <div className="space-y-2">
            {garageCars.map((car) => (
              <button
                key={car.cv_id}
                onClick={() => { setSelectedCar(car); setStep(2); }}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  selectedCar?.cv_id === car.cv_id
                    ? 'border-accent-blue bg-accent-blue/5'
                    : 'border-bg-border bg-bg-card hover:border-accent-blue/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125M3.375 14.25h10.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      {car.year} {car.make} {car.model}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {[car.color, car.plate_number].filter(Boolean).join(' · ') || 'No details'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 2: Select Service Type ─────────────────────────── */}
      {phase === 'form' && step === 2 && (
        <div>
          <button onClick={() => setStep(1)} className="text-xs text-accent-blue hover:text-accent-blue-hover mb-3 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h2 className="text-base font-semibold text-text-primary mb-1">
            2. Select Service Type
          </h2>
          <p className="text-xs text-text-secondary mb-3">
            For: <span className="text-text-primary font-medium">{selectedCar?.year} {selectedCar?.make} {selectedCar?.model}</span>
          </p>
          <div className="space-y-2">
            {serviceTypes.map((st) => (
              <button
                key={st.service_type_id}
                onClick={() => { setSelectedServiceType(st); setSelectedTechId(null); setStep(3); }}
                className="w-full text-left p-4 rounded-xl border border-bg-border bg-bg-card hover:border-accent-blue/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{st.name}</p>
                    {st.description && (
                      <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{st.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {st.duration_minutes && (
                        <span className="text-[11px] text-text-muted flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          ~{st.duration_minutes} min
                        </span>
                      )}
                      {st.required_specialty && (
                        <span className="text-[11px] text-text-muted">
                          Requires: {st.required_specialty}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <p className="text-sm font-bold text-accent-blue">{formatPrice(st.booking_fee)}</p>
                    <p className="text-[10px] text-text-muted">booking fee</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: Select Technician ───────────────────────────── */}
      {phase === 'form' && step === 3 && (
        <div>
          <button onClick={() => setStep(2)} className="text-xs text-accent-blue hover:text-accent-blue-hover mb-3 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h2 className="text-base font-semibold text-text-primary mb-1">
            3. Choose a Technician
          </h2>
          <p className="text-xs text-text-secondary mb-3">
            {selectedServiceType?.name}
            {selectedServiceType?.required_specialty && ` — ${selectedServiceType.required_specialty} specialist`}
          </p>

          {loadingTechs ? (
            <LoadingSpinner text="Loading technicians…" />
          ) : (
            <div className="space-y-2">
              {/* No preference option */}
              <button
                onClick={() => { setSelectedTechId(null); setSelectedDate(''); setSelectedSlot(''); setStep(4); }}
                className="w-full text-left p-4 rounded-xl border border-bg-border bg-bg-card hover:border-accent-blue/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-bg-elevated rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">No Preference</p>
                    <p className="text-xs text-text-secondary">Staff will assign the best available technician</p>
                  </div>
                </div>
              </button>

              {technicians.map((tech) => (
                <button
                  key={tech.user_id}
                  onClick={() => { setSelectedTechId(tech.user_id); setSelectedDate(''); setSelectedSlot(''); setStep(4); }}
                  className="w-full text-left p-4 rounded-xl border border-bg-border bg-bg-card hover:border-accent-blue/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {tech.photo_url ? (
                      <img src={tech.photo_url} alt={tech.full_name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-10 h-10 bg-accent-blue/10 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-accent-blue">
                          {tech.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{tech.full_name}</p>
                      <p className="text-xs text-text-secondary">
                        {tech.specialty}
                        {tech.years_experience > 0 && ` · ${tech.years_experience} years exp.`}
                      </p>
                      {tech.bio && (
                        <p className="text-[11px] text-text-muted mt-0.5 line-clamp-1">{tech.bio}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {technicians.length === 0 && (
                <p className="text-sm text-text-muted text-center py-4">
                  No technicians available for this specialty. Choose "No Preference".
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 4: Select Date & Time ──────────────────────────── */}
      {phase === 'form' && step === 4 && (
        <div>
          <button onClick={() => setStep(3)} className="text-xs text-accent-blue hover:text-accent-blue-hover mb-3 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h2 className="text-base font-semibold text-text-primary mb-1">
            4. Pick Date & Time
          </h2>
          <p className="text-xs text-text-secondary mb-4">
            {selectedServiceType?.name} · {selectedTech ? selectedTech.full_name : 'No Preference'}
          </p>

          {/* Date selector */}
          <label id="date-label" className="block text-sm font-medium text-text-secondary mb-2">Date</label>
          <div role="group" aria-labelledby="date-label" className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5 max-h-48 overflow-y-auto pr-1">
            {availableDates.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => { setSelectedDate(d.date); setSelectedSlot(''); }}
                className={`p-2 text-center rounded-lg border text-xs font-medium transition-colors ${
                  selectedDate === d.date
                    ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                    : 'border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-bg-border'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <>
              <label id="timeslot-label" className="block text-sm font-medium text-text-secondary mb-2">Time Slot</label>
              {loadingSlots ? (
                <LoadingSpinner text="Checking availability…" />
              ) : (
                <div role="group" aria-labelledby="timeslot-label" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {TIME_SLOTS.map((slot) => {
                    const slotData = availability?.find(a => a.time === slot.value);
                    const isAvailable = slotData ? slotData.available : true;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(slot.value)}
                        className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                          selectedSlot === slot.value
                            ? 'border-accent-blue bg-accent-blue/10 text-accent-blue'
                            : isAvailable
                              ? 'border-bg-border bg-bg-elevated text-text-secondary hover:text-text-primary hover:border-bg-border'
                              : 'border-bg-border bg-bg-elevated/50 text-text-muted cursor-not-allowed line-through'
                        }`}
                      >
                        {slot.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label htmlFor="booking-notes" className="block text-sm font-medium text-text-secondary mb-1">Notes (optional)</label>
            <textarea
              id="booking-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder:text-text-muted resize-none"
              placeholder="Describe any specific concerns or requests…"
            />
          </div>

          {/* Continue button */}
          <button
            onClick={() => setStep(5)}
            disabled={!selectedDate || !selectedSlot}
            className="w-full py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Payment
          </button>
        </div>
      )}

      {/* ── STEP 5: Payment ─────────────────────────────────────── */}
      {phase === 'form' && step === 5 && (
        <form onSubmit={handleSubmit}>
          <button type="button" onClick={() => setStep(4)} className="text-xs text-accent-blue hover:text-accent-blue-hover mb-3 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back
          </button>
          <h2 className="text-base font-semibold text-text-primary mb-4">
            5. Confirm & Pay
          </h2>

          {/* Booking summary */}
          <div className="bg-bg-elevated rounded-xl p-4 space-y-2.5 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Vehicle</span>
              <span className="text-text-primary font-medium">{selectedCar?.year} {selectedCar?.make} {selectedCar?.model}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Service</span>
              <span className="text-text-primary font-medium">{selectedServiceType?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Technician</span>
              <span className="text-text-primary">{selectedTech ? selectedTech.full_name : 'No Preference'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Date</span>
              <span className="text-text-primary">{formatDate(selectedDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Time</span>
              <span className="text-text-primary">{selectedSlot}</span>
            </div>
            {notes && (
              <div className="pt-2 border-t border-bg-border">
                <p className="text-xs text-text-muted">{notes}</p>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2 border-t border-bg-border">
              <span className="text-text-secondary font-medium">Booking Fee</span>
              <span className="text-accent-blue font-bold">{formatPrice(bookingFee)}</span>
            </div>
          </div>

          {/* Payment method */}
          <div className="mb-5">
            <label id="pay-from-label" className="block text-sm font-medium text-text-secondary mb-2">Pay from</label>
            {loadingBank ? (
              <div className="flex items-center gap-2 p-3 bg-bg-elevated rounded-lg">
                <div className="w-4 h-4 border-2 border-bg-border border-t-accent-blue rounded-full animate-spin" />
                <span className="text-sm text-text-muted">Loading bank account…</span>
              </div>
            ) : bankSummary ? (
              <div className="p-3 bg-bg-elevated rounded-lg">
                <BankCard
                  bankName="AutoEdge Demo Bank"
                  cardLast4={bankSummary.card_last4}
                  customerName={bankSummary.customer_name || 'Account Holder'}
                  balance={parseFloat(bankSummary.balance)}
                  compact
                />
                {parseFloat(bankSummary.balance) < bookingFee && (
                  <p className="mt-2 text-xs text-status-cancelled flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Insufficient funds — you need {formatPrice(bookingFee)} but have {formatPrice(bankSummary.balance)}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-status-cancelled p-3 bg-bg-elevated rounded-lg">
                Unable to load bank account. Please try again.
              </p>
            )}
          </div>

          {/* Password */}
          <div className="mb-5">
            <PasswordField
              id="service-booking-password"
              name="password"
              label="Confirm with your account password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
              placeholder="Enter your password"
              error=""
              required
              autoComplete="current-password"
            />
            <PinHint />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-status-cancelled/10 border border-status-cancelled/20 rounded-lg">
              <svg className="w-4 h-4 text-status-cancelled flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div className="text-sm text-status-cancelled">
                <p>{error}</p>
                {error.toLowerCase().includes('insufficient funds') && (
                  <Link to="/account/bank" className="mt-1 text-accent-blue hover:text-accent-blue-hover text-xs underline block">
                    Top up demo balance →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Demo note (Article XVIII) */}
          <p className="text-[11px] text-text-muted text-center mb-5">
            ⚠️ Demo project — no real money is being charged. This is a simulated bank transaction.
          </p>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || loadingBank || !bankSummary}
            className="w-full py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent-blue/20 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing…
              </>
            ) : (
              <>Pay {formatPrice(bookingFee)}</>
            )}
          </button>
        </form>
      )}

      {/* ── PROCESSING PHASE ──────────────────────────────────────── */}
      {phase === 'processing' && (
        <div className="py-8">
          <h2 className="text-lg font-bold text-text-primary text-center mb-2">
            Processing Payment
          </h2>
          <p className="text-sm text-text-secondary text-center mb-4">
            Please wait while we process your booking…
          </p>
          <ProcessingSteps onComplete={handleProcessingComplete} />
        </div>
      )}

      {/* ── SUCCESS PHASE ─────────────────────────────────────────── */}
      {phase === 'success' && bookingResult && (
        <div className="py-8">
          {/* Success icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-status-available/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-status-available" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text-primary">Booking Placed!</h2>
            <p className="text-sm text-text-secondary mt-1">
              Your service appointment has been scheduled.
            </p>
          </div>

          {/* Receipt summary */}
          <div className="bg-bg-elevated rounded-xl p-4 space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Booking #</span>
              <span className="text-text-primary font-mono">
                SVC-{String(bookingResult.booking_id).padStart(6, '0')}
              </span>
            </div>
            {bookingResult.reference_code && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Transaction Ref</span>
                <span className="text-text-primary font-mono text-xs">{bookingResult.reference_code}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Service</span>
              <span className="text-text-primary">{bookingResult.service_type_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Date & Time</span>
              <span className="text-text-primary">
                {formatDate(bookingResult.booking_date)} at {bookingResult.time_slot}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Amount</span>
              <span className="text-accent-blue font-semibold">{formatPrice(bookingResult.fee_amount)}</span>
            </div>
            {bookingResult.balance_after != null && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">New Balance</span>
                <span className="text-text-primary">{formatPrice(bookingResult.balance_after)}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-accent-blue">
              <strong>What's next?</strong> Our staff will review your booking and confirm it with an assigned technician.
              You'll receive a notification once confirmed.
            </p>
          </div>

          {/* Demo note */}
          <p className="text-[11px] text-text-muted text-center mb-6">
            ⚠️ Demo project — no real money was charged
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Link
              to={`/account/receipts/service/${bookingResult.booking_id}`}
              className="flex-1 py-2.5 text-sm font-medium text-text-primary bg-bg-elevated hover:bg-bg-border border border-bg-border rounded-xl transition-colors text-center"
            >
              View Receipt
            </Link>
            <Link
              to="/account/service-bookings"
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-accent-blue hover:bg-accent-blue-hover rounded-xl transition-colors shadow-lg shadow-accent-blue/20 text-center"
            >
              My Bookings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
