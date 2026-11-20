import CarCard from './CarCard';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';

/**
 * CarGrid — responsive grid of CarCards with loading and empty states.
 */
export default function CarGrid({
  vehicles = [],
  isLoading = false,
  wishlistedIds = [],
  onToggleWishlist,
  compareIds = [],
  onToggleCompare,
  restockRequestedIds = [],
  onRequestRestock,
  loggedIn = false,
}) {
  if (isLoading) {
    return <LoadingSpinner text="Loading vehicles…" />;
  }

  if (vehicles.length === 0) {
    return (
      <EmptyState
        title="No vehicles found"
        description="Try adjusting your filters or search criteria"
        icon={
          <svg className="w-16 h-16 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
          </svg>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {vehicles.map((vehicle) => (
        <CarCard
          key={vehicle.vehicle_id}
          vehicle={vehicle}
          isWishlisted={wishlistedIds.includes(vehicle.vehicle_id)}
          onToggleWishlist={onToggleWishlist}
          isCompareSelected={compareIds.includes(vehicle.vehicle_id)}
          onToggleCompare={onToggleCompare}
          compareDisabled={compareIds.length >= 3}
          restockRequested={restockRequestedIds.includes(vehicle.vehicle_id)}
          onRequestRestock={onRequestRestock}
          loggedIn={loggedIn}
        />
      ))}
    </div>
  );
}
