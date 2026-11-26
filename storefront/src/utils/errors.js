/** Turn an API error into a message a customer can act on. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) return detail.map((d) => d.msg || String(d)).join('; ');
  if (err?.response?.status === 401) return 'Your session has ended. Please log in again.';
  if (!err?.response) return 'Could not reach AutoEdge. Check your connection and try again.';
  return fallback;
}
