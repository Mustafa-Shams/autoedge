/**
 * BackButton — navigates to the previous page, or to a fallback route
 * if there's no browser history to go back to.
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ fallback = "/", label = "Back", className = "", onClick }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate(fallback, { replace: true });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {label}
    </button>
  );
}
