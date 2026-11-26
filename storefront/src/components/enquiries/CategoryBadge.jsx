/** Enquiry categories (must match backend app/core/enquiry_categories.py) and a small label. */
// eslint-disable-next-line react-refresh/only-export-components
export const ENQUIRY_CATEGORIES = [
  { value: 'Vehicle/Price', label: 'A car or its price', team: 'Answered by our sales team.' },
  { value: 'Finance', label: 'Finance or payments', team: 'Answered by our sales team.' },
  { value: 'Service', label: 'Service or repairs', team: 'Answered by our service reception.' },
  { value: 'General', label: 'Something else', team: 'Answered by our reception team.' },
];

export default function CategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded-full border border-bg-border text-text-secondary">
      {category}
    </span>
  );
}
