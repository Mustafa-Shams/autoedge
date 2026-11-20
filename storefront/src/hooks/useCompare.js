import { useState, useEffect } from 'react';

/**
 * Compare selection hook — uses localStorage (not sensitive data).
 * Stores up to 3 vehicle IDs for the compare bar.
 */
const STORAGE_KEY = 'autoedge_compare';
const COMPARE_EVENT = 'autoedge-compare-change';

export default function useCompare() {
  const [compareIds, setCompareIds] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setCompareIds(raw ? JSON.parse(raw) : []);
      } catch {
        setCompareIds([]);
      }
    };
    window.addEventListener(COMPARE_EVENT, handler);
    return () => window.removeEventListener(COMPARE_EVENT, handler);
  }, []);

  const toggle = (vehicleId) => {
    setCompareIds((prev) => {
      let next;
      if (prev.includes(vehicleId)) {
        next = prev.filter((id) => id !== vehicleId);
      } else if (prev.length < 3) {
        next = [...prev, vehicleId];
      } else {
        return prev; // max 3
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(COMPARE_EVENT));
      return next;
    });
  };

  const clear = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    setCompareIds([]);
    window.dispatchEvent(new Event(COMPARE_EVENT));
  };

  const isSelected = (vehicleId) => compareIds.includes(vehicleId);

  return { compareIds, toggle, clear, isSelected, count: compareIds.length };
}
