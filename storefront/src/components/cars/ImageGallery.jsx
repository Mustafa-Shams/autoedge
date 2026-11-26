import { useState } from 'react';
import ImageWithFallback from '../common/ImageWithFallback';

/**
 * ImageGallery — vehicle image gallery with thumbnails and main preview.
 * Shows credits below per spec 11.4.
 */
export default function ImageGallery({ images = [], vehicleName = 'Vehicle' }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <ImageWithFallback
        src={null}
        alt={vehicleName}
        className="w-full h-64 sm:h-80 lg:h-96 rounded-xl"
        fallbackClassName="w-full h-64 sm:h-80 lg:h-96 rounded-xl"
      />
    );
  }

  const activeImage = images[activeIndex] || images[0];

  return (
    <div>
      {/* Main image */}
      <div className="relative rounded-xl overflow-hidden bg-bg-elevated mb-3">
        <ImageWithFallback
          src={activeImage.image_url}
          alt={`${vehicleName} - Photo ${activeIndex + 1}`}
          className="w-full h-64 sm:h-80 lg:h-96 object-cover"
          fallbackClassName="w-full h-64 sm:h-80 lg:h-96"
        />

        {/* Nav arrows (show only when multiple images) */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              aria-label="Previous image"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => setActiveIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
              aria-label="Next image"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Counter */}
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {activeIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((img, idx) => (
            <button
              key={img.image_id || idx}
              onClick={() => setActiveIndex(idx)}
              aria-label={`View photo ${idx + 1} of ${vehicleName}`}
              aria-pressed={idx === activeIndex}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                idx === activeIndex ? 'border-accent-blue' : 'border-transparent hover:border-bg-border'
              }`}
            >
              <ImageWithFallback
                src={img.image_url}
                alt={`${vehicleName} - Thumbnail ${idx + 1}`}
                className="w-16 h-12 sm:w-20 sm:h-14 object-cover"
                fallbackClassName="w-16 h-12 sm:w-20 sm:h-14"
              />
            </button>
          ))}
        </div>
      )}

      {/* Photo credits */}
      <div className="mt-3 space-y-0.5">
        {images.map((img, idx) =>
          img.credit ? (
            <p key={img.image_id || idx} className="text-[10px] text-text-muted">
              Photo {idx + 1}:{' '}
              {img.source_url ? (
                <a href={img.source_url} target="_blank" rel="noopener noreferrer" className="text-accent-blue/60 hover:text-accent-blue">
                  {img.credit}
                </a>
              ) : (
                img.credit
              )}
            </p>
          ) : null
        )}
        <p className="text-[10px] text-text-muted italic">Images are for illustration only.</p>
      </div>
    </div>
  );
}
