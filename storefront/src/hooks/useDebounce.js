import { useState, useEffect } from 'react';

/**
 * Debounce hook — delays updating value until after `delay` ms of inactivity.
 * Used for live email availability check on signup, search inputs, etc.
 */
export default function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
