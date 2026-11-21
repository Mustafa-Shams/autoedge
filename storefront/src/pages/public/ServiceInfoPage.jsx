/**
 * ServiceInfoPage — service types, technicians, "Book a service" CTA.
 * Spec 11.2 — uses /public/service-types and /public/technicians.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getServiceTypes, getTechnicians } from '../../api/publicApi';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatPrice } from '../../utils/formatters';
import BackButton from '../../components/common/BackButton';

export default function ServiceInfoPage() {
  const [services, setServices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [svcRes, techRes] = await Promise.allSettled([
          getServiceTypes(),
          getTechnicians(),
        ]);
        if (svcRes.status === 'fulfilled') setServices(svcRes.value.data);
        if (techRes.status === 'fulfilled') setTechnicians(techRes.value.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner fullPage text="Loading services…" />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <BackButton fallback="/" label="Back" className="mb-4" />
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-3">Car Service</h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto">
          Professional maintenance and repairs from our team of certified technicians.
          Book your service appointment online.
        </p>
      </div>

      {/* Service types */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Our Services</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((svc) => (
            <div key={svc.service_type_id} className="bg-bg-card border border-bg-border rounded-xl p-5 hover:border-accent-blue/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary leading-tight">{svc.name}</h3>
                <span className="text-xs font-medium text-accent-blue bg-accent-blue/10 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                  {formatPrice(svc.base_price, false)}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-text-secondary">
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ~{svc.estimated_minutes} minutes
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  Booking fee: {formatPrice(svc.booking_fee)}
                </div>
                {svc.required_specialty && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 3.01-.198-6.197 4.476-4.444 7.392-1.047-1.047 7.392-4.476 4.444z" />
                    </svg>
                    Requires: {svc.required_specialty}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technicians */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-text-primary mb-6">Our Technicians</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {technicians.map((tech) => (
            <div key={tech.user_id} className="bg-bg-card border border-bg-border rounded-xl p-6 flex items-start gap-4">
              <div className="flex-shrink-0">
                {tech.photo_url ? (
                  <img
                    src={tech.photo_url}
                    alt={tech.full_name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 bg-accent-blue/10 text-accent-blue rounded-full flex items-center justify-center text-xl font-bold">
                    {tech.full_name?.[0]?.toUpperCase() || 'T'}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-text-primary">{tech.full_name}</h3>
                <p className="text-sm text-accent-blue font-medium">{tech.specialty}</p>
                {tech.years_experience && (
                  <p className="text-xs text-text-muted mt-0.5">{tech.years_experience} years experience</p>
                )}
                {tech.bio && (
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">{tech.bio}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-accent-blue/10 to-accent-blue/5 border border-accent-blue/20 rounded-xl p-8 sm:p-12 text-center">
        <h2 className="text-2xl font-bold text-text-primary mb-3">Ready to book?</h2>
        <p className="text-text-secondary mb-6 max-w-lg mx-auto">
          Create an account to schedule service appointments, track your bookings, and manage your garage.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="px-8 py-3 bg-accent-blue hover:bg-accent-blue-hover text-white font-semibold rounded-xl transition-colors shadow-lg shadow-accent-blue/20"
          >
            Create Account
          </Link>
          <Link
            to="/cars"
            className="px-8 py-3 bg-bg-elevated hover:bg-bg-border text-text-primary font-medium rounded-xl border border-bg-border transition-colors"
          >
            Browse Cars
          </Link>
        </div>
      </section>
    </div>
  );
}
