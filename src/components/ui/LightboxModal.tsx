import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSocialData } from '@/contexts/SocialDataContext';

export const LightboxModal: React.FC = () => {
  const { lightboxMedia, closeLightbox } = useSocialData();

  useEffect(() => {
    if (!lightboxMedia) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxMedia, closeLightbox]);

  if (!lightboxMedia) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media preview"
      onClick={closeLightbox}
      className="fixed inset-0 z-[80] bg-black/92 backdrop-blur-md flex flex-col items-center justify-center p-4"
    >
      <button
        type="button"
        onClick={closeLightbox}
        aria-label="Close media viewer"
        className="absolute top-4 right-4 min-h-[44px] min-w-[44px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl max-h-[85vh] w-full flex flex-col items-center justify-center"
      >
        {lightboxMedia.type === 'video' ? (
          <video
            src={lightboxMedia.url}
            controls
            autoPlay
            playsInline
            className="max-h-[80vh] max-w-full rounded-2xl shadow-2xl"
          />
        ) : (
          <img
            src={lightboxMedia.url}
            alt={lightboxMedia.caption || 'Full size media'}
            referrerPolicy="no-referrer"
            className="max-h-[80vh] max-w-full object-contain rounded-2xl shadow-2xl"
          />
        )}

        {lightboxMedia.caption && (
          <p className="mt-4 text-sm text-slate-200 max-w-xl text-center line-clamp-3">
            {lightboxMedia.caption}
          </p>
        )}
      </div>
    </div>
  );
};
