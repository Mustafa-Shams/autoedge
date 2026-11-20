import { formatPrice, formatNumber } from '../../utils/formatters';

/**
 * SpecTable — vehicle specifications table for detail/compare pages.
 */
export default function SpecTable({ vehicle, className = '' }) {
  if (!vehicle) return null;

  const specs = [
    { label: 'Make', value: vehicle.make },
    { label: 'Model', value: vehicle.model },
    { label: 'Year', value: vehicle.year },
    { label: 'Color', value: vehicle.color },
    { label: 'Body Type', value: vehicle.body_type },
    { label: 'Condition', value: vehicle.condition_type },
    { label: 'Fuel Type', value: vehicle.fuel_type },
    { label: 'Transmission', value: vehicle.transmission },
    { label: 'Engine', value: vehicle.engine },
    { label: 'Horsepower', value: vehicle.horsepower ? `${vehicle.horsepower} hp` : null },
    { label: 'Drivetrain', value: vehicle.drivetrain },
    { label: 'Seats', value: vehicle.seats },
    { label: 'Mileage', value: vehicle.mileage_km != null ? `${formatNumber(vehicle.mileage_km)} km` : null },
    { label: 'Price', value: formatPrice(vehicle.price) },
  ].filter((s) => s.value != null && s.value !== '');

  return (
    <div className={`bg-bg-card border border-bg-border rounded-xl overflow-hidden ${className}`}>
      <div className="px-4 py-3 border-b border-bg-border">
        <h3 className="text-sm font-semibold text-text-primary">Specifications</h3>
      </div>
      <div className="divide-y divide-bg-border">
        {specs.map((spec) => (
          <div key={spec.label} className="flex justify-between items-center px-4 py-2.5">
            <span className="text-sm text-text-secondary">{spec.label}</span>
            <span className="text-sm font-medium text-text-primary">{spec.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
