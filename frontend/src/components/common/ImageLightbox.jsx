import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from "lucide-react";

export default function ImageLightbox({ images, initialIndex = 0, onClose }) {
  const closeButton = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);

  const goNext = useCallback(() => {
    setCurrentIndex((i) => (i + 1) % images.length);
    setZoomed(false);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
    setZoomed(false);
  }, [images.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (!["Escape", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goNext, goPrev]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    closeButton.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  if (!images?.length) return null;
  const currentImage = images[currentIndex];
  const imageUrl =
    typeof currentImage === "string"
      ? currentImage
      : currentImage?.url || currentImage?.image_url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trade-in photos"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
        <span className="text-white/70 text-sm">
          {currentIndex + 1} / {images.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoomed(!zoomed);
            }}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label={zoomed ? "Zoom out" : "Zoom in"}
          >
            {zoomed ? (
              <ZoomOut className="w-5 h-5" />
            ) : (
              <ZoomIn className="w-5 h-5" />
            )}
          </button>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Open in new tab"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          <button
            ref={closeButton}
            aria-label="Close photos"
            onClick={(event) => { event.stopPropagation(); onClose(); }}
            className="p-2 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="flex items-center justify-center w-full h-full p-16"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={`Image ${currentIndex + 1}`}
          className={`max-h-full rounded-lg shadow-2xl transition-transform duration-300 ${
            zoomed
              ? "max-w-none cursor-zoom-out scale-150"
              : "max-w-full cursor-zoom-in"
          }`}
          onClick={() => setZoomed(!zoomed)}
          draggable={false}
        />
      </div>

      {/* Nav arrows */}
      {images.length > 1 && (
        <>
          <button
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
}
