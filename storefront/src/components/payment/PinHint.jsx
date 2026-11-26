/** PinHint — shown wherever a payment asks for the demo card PIN (the customer's login password). */
import { Link } from 'react-router-dom';

export default function PinHint({ className = '' }) {
  return (
    <p className={`text-xs text-text-muted mt-1 ${className}`}>
      Your card PIN is your AutoEdge login password.{' '}
      <Link to="/account/bank#card" className="text-accent-blue hover:underline">See your card and PIN help</Link>
    </p>
  );
}
