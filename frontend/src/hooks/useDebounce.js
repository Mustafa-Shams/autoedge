import { useState, useEffect } from "react";

/**
 * Debounces a value — only updates after the user stops typing for `delay` ms.
 * Prevents hammering the API on every keystroke.
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
