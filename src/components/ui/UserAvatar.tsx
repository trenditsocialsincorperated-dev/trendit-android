import React, { useEffect, useState } from 'react';
import { resolveUserAvatarUrl } from '@/services/userService';
import { getInitialAvatarSvgDataUri } from '@/utils/formatters';
import type { UserProfile } from '@/types';

interface UserAvatarProps {
  user?: Partial<UserProfile> | null;
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  hasStoryRing?: boolean;
  storyViewed?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const SIZE_CLASSES: Record<NonNullable<UserAvatarProps['size']>, string> = {
  xs: 'w-7 h-7',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
  '2xl': 'w-24 h-24',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  src,
  name,
  size = 'md',
  hasStoryRing = false,
  storyViewed = false,
  className = '',
  onClick,
}) => {
  const seed = user?.uid || user?.handle || name || 'Trendit';
  const label = user?.displayName || name || user?.handle || 'T';
  const fallbackUri = getInitialAvatarSvgDataUri(seed, label);

  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (src && !src.startsWith('gs://')) return src;
    return fallbackUri;
  });

  useEffect(() => {
    let active = true;
    const candidateProfile: Partial<UserProfile> = {
      ...user,
      photoURL: src ?? user?.photoURL ?? null,
      displayName: label,
    };

    resolveUserAvatarUrl(candidateProfile, seed).then((url) => {
      if (active) setResolvedSrc(url || fallbackUri);
    });

    return () => {
      active = false;
    };
  }, [src, user?.photoURL, user?.avatarUrl, user?.uid, user?.handle, label, seed, fallbackUri]);

  const imgEl = (
    <img
      src={resolvedSrc}
      alt={`${label} avatar`}
      referrerPolicy="no-referrer"
      onError={() => {
        if (resolvedSrc !== fallbackUri) {
          setResolvedSrc(fallbackUri);
        }
      }}
      className={`${SIZE_CLASSES[size]} rounded-full object-cover bg-slate-200 dark:bg-slate-800 shrink-0 select-none ${
        hasStoryRing ? 'ring-2 ring-white dark:ring-[#090B10]' : ''
      }`}
    />
  );

  if (hasStoryRing) {
    return (
      <div
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-full p-[2.5px] shrink-0 ${
          storyViewed
            ? 'bg-slate-300 dark:bg-slate-700'
            : 'bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-coral-500'
        } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      >
        {imgEl}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex shrink-0 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {imgEl}
    </div>
  );
};
