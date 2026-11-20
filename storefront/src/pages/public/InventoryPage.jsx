/**
 * InventoryPage — full vehicle catalog with filters, sort, pagination, compare.
 * Spec 10.1, 11.2, 11.4.
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getVehicles, getVehicleFilters } from '../../api/publicApi';
import { requestRestock } from '../../api/storeApi';
import CarGrid from '../../components/cars/CarGrid';
import FilterBar from '../../components/cars/FilterBar';
import CompareBar from '../../components/cars/CompareBar';
import useCompare from '../../hooks/useCompare';
import useDebounce from '../../hooks/useDebounce';
import useAuth from '../../hooks/useAuth';

export default function InventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { compareIds, toggle: toggleCompare } = useCompare();
  const { loggedIn } = useAuth();

  // Initialize filters from URL params
  const [filters, setFilters] = useState(() => ({
    q: searchParams.get('q') || '',
    make: searchParams.get('make') || '',
    body_type: searchParams.get('body_type') || '',
    fuel_type: searchParams.get('fuel_type') || '',
    condition_type: searchParams.get('condition_type') || '',
    year_min: searchParams.get('year_min') || '',
    year_max: searchParams.get('year_max') || '',
    price_min: searchParams.get('price_min') || '',
    price_max: searchParams.get('price_max') || '',
    in_stock_only: searchParams.get('in_stock_only') === 'true',
    sort: searchParams.get('sort') || 'newest',
    page: parseInt(searchParams.get('page') || '1', 10),
  }));

  const [filterOptions, setFilterOptions] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restockRequestedIds, setRestockRequestedIds] = useState([]);
  const pageSize = 12;

  // Debounce the search query
  const debouncedQ = useDebounce(filters.q, 400);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== '' && val !== false && val !== 0 && key !== 'page') {
        params.set(key, String(val));
      }
    });
    if (filters.page > 1) params.set('page', String(filters.page));
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  // Fetch filter options
  useEffect(() => {
    getVehicleFilters()
      .then((res) => setFilterOptions(res.data))
      .catch(() => {});
  }, []);

  // Fetch vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = {};
        if (debouncedQ) params.q = debouncedQ;
        if (filters.make) params.make = filters.make;
        if (filters.body_type) params.body_type = filters.body_type;
        if (filters.fuel_type) params.fuel_type = filters.fuel_type;
        if (filters.condition_type) params.condition_type = filters.condition_type;
        if (filters.year_min) params.year_min = filters.year_min;
        if (filters.year_max) params.year_max = filters.year_max;
        if (filters.price_min) params.price_min = filters.price_min;
        if (filters.price_max) params.price_max = filters.price_max;
        if (filters.in_stock_only) params.in_stock_only = true;
        params.sort = filters.sort;
        params.page = filters.page;
        params.page_size = pageSize;

        const res = await getVehicles(params);
        setVehicles(res.data.items);
        setTotal(res.data.total);
      } catch (err) {
        setError('Failed to load vehicles. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [debouncedQ, filters.make, filters.body_type, filters.fuel_type, filters.condition_type,
      filters.year_min, filters.year_max, filters.price_min, filters.price_max,
      filters.in_stock_only, filters.sort, filters.page]);

  const totalPages = Math.ceil(total / pageSize);

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

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary mb-1">Our Cars</h1>
        <p className="text-text-secondary">
          {loading ? 'Loading…' : `${total} vehicle${total !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={handleFiltersChange}
        isLoading={loading}
      />

      {/* Error state */}
      {error && (
        <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {/* Car grid */}
      <CarGrid
        vehicles={vehicles}
        isLoading={loading}
        compareIds={compareIds}
        onToggleCompare={toggleCompare}
        restockRequestedIds={restockRequestedIds}
        onRequestRestock={handleRequestRestock}
        loggedIn={loggedIn}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            disabled={filters.page <= 1}
            className="px-3 py-2 text-sm bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (filters.page <= 4) {
                pageNum = i + 1;
              } else if (filters.page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = filters.page - 3 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setFilters((f) => ({ ...f, page: pageNum }))}
                  className={`w-9 h-9 text-sm rounded-lg transition-colors ${
                    pageNum === filters.page
                      ? 'bg-accent-blue text-white'
                      : 'bg-bg-elevated border border-bg-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            disabled={filters.page >= totalPages}
            className="px-3 py-2 text-sm bg-bg-elevated border border-bg-border rounded-lg text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}

      {/* Compare bar */}
      <CompareBar />
    </div>
  );
}
