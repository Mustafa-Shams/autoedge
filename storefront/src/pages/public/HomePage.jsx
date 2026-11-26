/**
 * HomePage — hero, featured cars grid (6 newest in-stock), service types preview, CTAs.
 * Spec 11.2, 11.4 — uses /public/vehicles/featured and /public/service-types.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getFeaturedVehicles, getServiceTypes } from '../../api/publicApi';
import { requestRestock } from '../../api/storeApi';
import CarGrid from '../../components/cars/CarGrid';
import CompareBar from '../../components/cars/CompareBar';
import useCompare from '../../hooks/useCompare';
import useAuth from '../../hooks/useAuth';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatPrice } from '../../utils/formatters';

export default function HomePage() {
  const [featured, setFeatured] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restockRequestedIds, setRestockRequestedIds] = useState([]);
  const { compareIds, toggle: toggleCompare } = useCompare();
  const { loggedIn } = useAuth();
  const navigate = useNavigate();

  const handleRequestRestock = useCallback(async (vehicleId) => {
    if (!loggedIn) {
      navigate('/login?next=' + encodeURIComponent(`/cars/${vehicleId}`));
      return;
    }
    try {
      await requestRestock({ vehicle_id: vehicleId });
      setRestockRequestedIds((prev) => [...prev, vehicleId]);
    } catch (err) {
      if (err.response?.status === 409) {
        setRestockRequestedIds((prev) => [...prev, vehicleId]);
      }
    }
  }, [loggedIn, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [featuredRes, servicesRes] = await Promise.allSettled([
          getFeaturedVehicles(),
          getServiceTypes(),
        ]);
        if (featuredRes.status === 'fulfilled') {
          setFeatured(featuredRes.value.data);
        }
        if (servicesRes.status === 'fulfilled') {
          setServices(servicesRes.value.data);
        }
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-bg-primary via-bg-card to-bg-primary py-20 lg:py-32 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-10 right-10 w-72 h-72 bg-accent-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-accent-blue/3 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent-blue/10 border border-accent-blue/20 rounded-full text-xs font-medium text-accent-blue mb-6">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Premium Online Showroom
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-primary mb-6 leading-tight">
              Find Your Perfect
              <span className="text-accent-blue block mt-2">Drive</span>
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              Browse our premium selection of vehicles. Compare specifications, calculate financing, and reserve your dream car — all online.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/cars"
                className="px-8 py-3.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-accent-blue/20"
              >
                Browse Cars
              </Link>
              <Link
                to="/emi-calculator"
                className="px-8 py-3.5 bg-bg-elevated hover:bg-bg-border text-text-primary font-semibold rounded-xl border border-bg-border transition-colors text-lg"
              >
                EMI Calculator
              </Link>
            </div>
          </div>
        </div>
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg-primary to-transparent" />
      </section>

      {/* Featured cars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">Featured Cars</h2>
            <p className="text-text-secondary">Our latest additions to the showroom</p>
          </div>
          <Link
            to="/cars"
            className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            View all
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>

        <CarGrid
          vehicles={featured}
          isLoading={loading}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
          restockRequestedIds={restockRequestedIds}
          onRequestRestock={handleRequestRestock}
          loggedIn={loggedIn}
        />

        <div className="text-center mt-8 sm:hidden">
          <Link
            to="/cars"
            className="inline-flex items-center gap-2 px-6 py-3 bg-bg-elevated hover:bg-bg-border text-text-primary font-medium rounded-xl border border-bg-border transition-colors"
          >
            View All Cars
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Services preview */}
      <section className="bg-bg-card border-y border-bg-border py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">Our Services</h2>
            <p className="text-text-secondary">Everything your car needs, in one place</p>
          </div>

          {/* Quick feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              {
                title: 'Reserve Online',
                desc: 'Secure your dream car with a refundable deposit',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                ),
              },
              {
                title: 'Test Drives',
                desc: 'Book a test drive at your convenience',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                ),
              },
              {
                title: 'Car Service',
                desc: 'Professional maintenance from certified technicians',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.648 3.01-.198-6.197 4.476-4.444 7.392-1.047-1.047 7.392-4.476 4.444-6.197-.198 3.01-5.648z" />
                  </svg>
                ),
              },
              {
                title: 'Trade-In',
                desc: 'Get a fair value for your current vehicle',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                ),
              },
            ].map((s) => (
              <div key={s.title} className="bg-bg-elevated border border-bg-border rounded-xl p-6 text-center hover:border-accent-blue/30 transition-colors group">
                <div className="w-12 h-12 bg-accent-blue/10 rounded-xl flex items-center justify-center mx-auto mb-4 text-accent-blue group-hover:bg-accent-blue/20 transition-colors">
                  {s.icon}
                </div>
                <h3 className="text-base font-semibold text-text-primary mb-2">{s.title}</h3>
                <p className="text-sm text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* Service types list */}
          {services.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4 text-center">Service Menu</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {services.map((svc) => (
                  <div key={svc.service_type_id} className="bg-bg-primary border border-bg-border rounded-lg p-3 flex items-center justify-between">
                    <span className="text-sm text-text-secondary">{svc.name}</span>
                    <span className="text-sm font-medium text-accent-blue">
                      {formatPrice(svc.base_price, false)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="text-center mt-6">
                <Link
                  to="/service"
                  className="inline-flex items-center gap-2 text-sm font-medium text-accent-blue hover:text-accent-blue-hover transition-colors"
                >
                  Learn more about our services
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">Ready to get started?</h2>
        <p className="text-text-secondary mb-8 max-w-lg mx-auto">
          Create a free account to reserve cars, book test drives, and manage your service bookings.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="px-8 py-3.5 bg-accent-blue-strong hover:bg-accent-blue-strong-hover text-white font-semibold rounded-xl transition-colors text-lg shadow-lg shadow-accent-blue/20"
          >
            Create Account
          </Link>
          <Link
            to="/compare"
            className="px-8 py-3.5 bg-bg-elevated hover:bg-bg-border text-text-primary font-semibold rounded-xl border border-bg-border transition-colors"
          >
            Compare Cars
          </Link>
        </div>
      </section>

      {/* Compare bar */}
      <CompareBar />
    </div>
  );
}
