import { useState } from 'react';

/**
 * FilterBar — filter controls for the inventory page.
 * Spec 10.1: q, make, body_type, fuel_type, condition_type, year_min, year_max,
 *            price_min, price_max, in_stock_only, sort
 */
export default function FilterBar({
  filters,
  filterOptions,
  onFiltersChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (key, value) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const handleReset = () => {
    onFiltersChange({
      q: '',
      make: '',
      body_type: '',
      fuel_type: '',
      condition_type: '',
      year_min: '',
      year_max: '',
      price_min: '',
      price_max: '',
      in_stock_only: false,
      sort: 'newest',
      page: 1,
    });
  };

  const hasActiveFilters =
    filters.q || filters.make || filters.body_type || filters.fuel_type ||
    filters.condition_type || filters.year_min || filters.year_max ||
    filters.price_min || filters.price_max || filters.in_stock_only;

  const selectClasses = 'w-full px-3 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent';
  const inputClasses = selectClasses;

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4 mb-6">
      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        {/* Search */}
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search make, model, or keyword…"
            aria-label="Search vehicle inventory"
            value={filters.q || ''}
            onChange={(e) => handleChange('q', e.target.value)}
            className={`${inputClasses} pl-9`}
          />
        </div>

        {/* Sort */}
        <select
          value={filters.sort || 'newest'}
          aria-label="Sort vehicles"
          onChange={(e) => handleChange('sort', e.target.value)}
          className={`${selectClasses} sm:w-44`}
        >
          <option value="newest">Newest First</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
          <option value="rating">Top Rated</option>
        </select>

        {/* Toggle filters */}
        <button
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-4 py-2 bg-bg-elevated border border-bg-border rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-accent-blue-strong rounded-full" />
          )}
        </button>
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="border-t border-bg-border pt-4 mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Make */}
            <div>
              <label htmlFor="catalog-make" className="block text-xs text-text-secondary mb-1">Make</label>
              <select
                id="catalog-make"
                value={filters.make || ''}
                onChange={(e) => handleChange('make', e.target.value)}
                className={selectClasses}
              >
                <option value="">All Makes</option>
                {filterOptions?.makes?.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Body Type */}
            <div>
              <label htmlFor="catalog-body_type" className="block text-xs text-text-secondary mb-1">Body Type</label>
              <select
                id="catalog-body_type"
                value={filters.body_type || ''}
                onChange={(e) => handleChange('body_type', e.target.value)}
                className={selectClasses}
              >
                <option value="">All Types</option>
                {filterOptions?.body_types?.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Fuel Type */}
            <div>
              <label htmlFor="catalog-fuel_type" className="block text-xs text-text-secondary mb-1">Fuel Type</label>
              <select
                id="catalog-fuel_type"
                value={filters.fuel_type || ''}
                onChange={(e) => handleChange('fuel_type', e.target.value)}
                className={selectClasses}
              >
                <option value="">All Fuels</option>
                {filterOptions?.fuel_types?.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Condition */}
            <div>
              <label htmlFor="catalog-condition_type" className="block text-xs text-text-secondary mb-1">Condition</label>
              <select
                id="catalog-condition_type"
                value={filters.condition_type || ''}
                onChange={(e) => handleChange('condition_type', e.target.value)}
                className={selectClasses}
              >
                <option value="">All Conditions</option>
                {filterOptions?.condition_types?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Year range */}
            <div>
              <label htmlFor="catalog-year_min" className="block text-xs text-text-secondary mb-1">Year (Min)</label>
              <input
                type="number"
                placeholder={filterOptions?.year_min || 'Min'}
                id="catalog-year_min"
                value={filters.year_min || ''}
                onChange={(e) => handleChange('year_min', e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="catalog-year_max" className="block text-xs text-text-secondary mb-1">Year (Max)</label>
              <input
                type="number"
                placeholder={filterOptions?.year_max || 'Max'}
                id="catalog-year_max"
                value={filters.year_max || ''}
                onChange={(e) => handleChange('year_max', e.target.value)}
                className={inputClasses}
              />
            </div>

            {/* Price range */}
            <div>
              <label htmlFor="catalog-price_min" className="block text-xs text-text-secondary mb-1">Price (Min)</label>
              <input
                type="number"
                placeholder="$0"
                id="catalog-price_min"
                value={filters.price_min || ''}
                onChange={(e) => handleChange('price_min', e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label htmlFor="catalog-price_max" className="block text-xs text-text-secondary mb-1">Price (Max)</label>
              <input
                type="number"
                placeholder="No max"
                id="catalog-price_max"
                value={filters.price_max || ''}
                onChange={(e) => handleChange('price_max', e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          {/* In-stock toggle + reset */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-bg-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.in_stock_only || false}
                onChange={(e) => handleChange('in_stock_only', e.target.checked)}
                className="w-4 h-4 rounded border-bg-border bg-bg-elevated text-accent-blue focus:ring-accent-blue"
              />
              <span className="text-sm text-text-secondary">In stock only</span>
            </label>

            {hasActiveFilters && (
              <button
                onClick={handleReset}
                className="text-xs text-accent-blue hover:text-accent-blue-hover transition-colors"
              >
                Reset all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
