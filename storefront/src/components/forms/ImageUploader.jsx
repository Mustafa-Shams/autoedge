/**
 * ImageUploader — Cloudinary unsigned upload widget for trade-in photos.
 * Spec 7.7: 3-8 photos, jpg/png/webp, 5MB max, thumbnails, remove.
 *
 * Uses Cloudinary Upload Widget (unsigned preset).
 * When VITE_CLOUDINARY_CLOUD_NAME is not set, falls back to a manual URL input
 * for development mode.
 */
import { useState, useCallback, useRef } from 'react';

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'autoedge_tradein';
const MAX_PHOTOS = 8;
const MIN_PHOTOS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export default function ImageUploader({ images = [], onChange, disabled = false }) {
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setError(null);

    // Check count limit
    const remaining = MAX_PHOTOS - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed.`);
      return;
    }

    const filesToUpload = files.slice(0, remaining);

    // Validate each file
    for (const file of filesToUpload) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError('Only JPG, PNG, and WebP images are accepted.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`"${file.name}" exceeds the 5MB size limit.`);
        return;
      }
    }

    // Upload to Cloudinary if configured, otherwise create local object URLs
    if (CLOUD_NAME) {
      setUploading(true);
      try {
        const uploaded = [];
        for (const file of filesToUpload) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('upload_preset', UPLOAD_PRESET);

          const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
          );

          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Upload failed');
          }

          const data = await response.json();
          uploaded.push(data.secure_url);
        }
        onChange([...images, ...uploaded]);
      } catch (err) {
        setError(err.message || 'Failed to upload image. Please try again.');
      } finally {
        setUploading(false);
      }
    } else {
      // Development fallback — use object URLs (note: these won't persist)
      // For dev, create data URLs so we have something to send
      setUploading(true);
      try {
        const dataUrls = [];
        for (const file of filesToUpload) {
          const url = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          // In dev mode without Cloudinary, we'll use a placeholder https URL
          // The backend will accept any https URL when Cloudinary is not configured
          dataUrls.push(`https://res.cloudinary.com/demo/image/upload/sample_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`);
        }
        onChange([...images, ...dataUrls]);
      } catch {
        setError('Failed to process image.');
      } finally {
        setUploading(false);
      }
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images, onChange]);

  const handleRemove = useCallback((index) => {
    const updated = images.filter((_, i) => i !== index);
    onChange(updated);
  }, [images, onChange]);

  const canAddMore = images.length < MAX_PHOTOS;

  return (
    <div>
      {/* Thumbnails grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3 mb-3">
          {images.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square bg-bg-elevated border border-bg-border rounded-lg overflow-hidden group"
            >
              <img
                src={url}
                alt={`Trade-in photo ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = '';
                  e.target.alt = 'Photo';
                  e.target.className = 'w-full h-full bg-bg-elevated flex items-center justify-center';
                }}
              />
              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-1 right-1 w-5 h-5 bg-status-cancelled/90 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  ×
                </button>
              )}
              {/* Index badge */}
              <span className="absolute bottom-1 left-1 text-[9px] px-1 py-0.5 bg-black/60 text-white rounded">
                {index + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {canAddMore && !disabled && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-bg-border hover:border-accent-blue/40 rounded-xl p-6 cursor-pointer transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading || disabled}
          />
          {uploading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
              <span className="text-sm text-text-secondary">Uploading…</span>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <span className="text-sm text-text-secondary mb-1">
                Click to upload photos
              </span>
              <span className="text-xs text-text-muted">
                JPG, PNG, WebP • Max 5MB each • {images.length}/{MIN_PHOTOS} min, {images.length}/{MAX_PHOTOS} max
              </span>
            </>
          )}
        </label>
      )}

      {/* Validation message */}
      {images.length > 0 && images.length < MIN_PHOTOS && (
        <p className="text-xs text-status-reserved mt-2">
          {MIN_PHOTOS - images.length} more photo{MIN_PHOTOS - images.length !== 1 ? 's' : ''} required (minimum {MIN_PHOTOS})
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-status-cancelled mt-2">{error}</p>
      )}

      {!CLOUD_NAME && (
        <p className="text-[10px] text-text-muted mt-2 italic">
          Cloudinary not configured — using placeholder URLs for development
        </p>
      )}
    </div>
  );
}
