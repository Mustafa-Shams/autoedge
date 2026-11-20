/**
 * ComparePage — side-by-side 2-3 vehicles, all specs.
 * Spec 11.2, 11.4 — IDs from query string.
 */
import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { compareVehicles } from '../../api/publicApi';
import ImageWithFallback from '../../components/common/ImageWithFallback';
import StarRating from '../../components/common/StarRating';
import StockBadge from '../../components/cars/StockBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import useCompare from '../../hooks/useCompare';
import { formatPrice, formatNumber } from '../../utils/formatters';

const SPEC_ROWS = [
  { key: 'price', label: 'Price', format: (v) => formatPrice(v) },
  { key: 'year', label: 'Year' },
  { key: 'color', label: 'Color' },
  { key: 'body_type', label: 'Body Type' },
  { key: 'condition_type', label: 'Condition' },
  { key: 'fuel_type', label: 'Fuel Type' },
  { key: 'transmission', label: 'Transmission' },
  { key: 'engine', label: 'Engine' },
  { key: 'horsepower', label: 'Horsepower', format: (v) => v ? `${v} hp` : '—' },
  { key: 'drivetrain', label: 'Drivetrain' },
  { key: 'seats', label: 'Seats' },
  { key: 'mileage_km', label: 'Mileage', format: (v) => v != null ? `${formatNumber(v)} km` : '—' },
  { key: 'stock_quantity', label: 'Stock' },
];

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const { compareIds, clear, toggle } = useCompare();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get IDs from query string or from compare hook
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map(Number).filter(Boolean) : compareIds;

  useEffect(() => {
    if (ids.length < 2) {
      setVehicles([]);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await compareVehicles(ids.join(','));
        setVehicles(res.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load comparison');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ids.join(',')]);

  if (loading) return <LoadingSpinner fullPage text="Loading comparison…" />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-1">Compare Cars</h1>
          <p className="text-text-secondary">Side-by-side comparison of selected vehicles</p>
        </div>
        {ids.length > 0 && (
          <button
            onClick={clear}
            className="text-sm text-accent-blue hover:text-accent-blue-hover transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {error && (
        <div className="bg-status-cancelled/10 border border-status-cancelled/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-status-cancelled">{error}</p>
        </div>
      )}

      {ids.length < 2 ? (
        <EmptyState
          title="Select cars to compare"
          description="Go to the inventory page and select 2-3 cars using the compare checkbox on each card."
          action={() => window.location.href = '/cars'}
          actionLabel="Browse Cars"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Vehicle headers */}
            <thead>
              <tr>
                <th className="w-40 p-3" />
                {vehicles.map((v) => (
                  <th key={v.vehicle_id} className="p-3 text-center min-w-[220px]">
                    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
                      <Link to={`/cars/${v.vehicle_id}`}>
                        <ImageWithFallback
                          src={v.main_image_url}
                          alt={`${v.year} ${v.make} ${v.model}`}
                          className="w-full h-36 object-cover"
                          fallbackClassName="w-full h-36"
                        />
                      </Link>
                      <div className="p-3">
                        <Link to={`/cars/${v.vehicle_id}`} className="text-sm font-semibold text-text-primary hover:text-accent-blue transition-colors">
                          {v.year} {v.make} {v.model}
                        </Link>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          <StarRating rating={parseFloat(v.avg_rating) || 0} size="xs" />
                          <span className="text-[10px] text-text-muted">({v.review_count})</span>
                        </div>
                        <div className="mt-2">
                          <StockBadge stock={v.stock_quantity} />
                        </div>
                        <button
                          onClick={() => toggle(v.vehicle_id)}
                          className="mt-2 text-xs text-status-cancelled hover:text-status-cancelled/80 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Spec rows */}
            <tbody>
              {SPEC_ROWS.map((spec, i) => (
                <tr key={spec.key} className={i % 2 === 0 ? 'bg-bg-card/30' : ''}>
                  <td className="p-3 text-sm font-medium text-text-secondary border-r border-bg-border">
                    {spec.label}
                  </td>
                  {vehicles.map((v) => {
                    const val = v[spec.key];
                    const display = spec.format ? spec.format(val) : (val ?? '—');
                    return (
                      <td key={v.vehicle_id} className="p-3 text-sm text-text-primary text-center">
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Description row */}
              <tr className="bg-bg-card/30">
                <td className="p-3 text-sm font-medium text-text-secondary border-r border-bg-border align-top">
                  Description
                </td>
                {vehicles.map((v) => (
                  <td key={v.vehicle_id} className="p-3 text-xs text-text-secondary text-left">
                    {v.description ? (v.description.length > 200 ? v.description.slice(0, 200) + '…' : v.description) : '—'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
