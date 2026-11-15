import type { FirestoreTimestamp, UserProfile } from '@/types';

export function toDateSafe(value: FirestoreTimestamp | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  return null;
}

export function toMillisSafe(value: FirestoreTimestamp | undefined): number {
  const d = toDateSafe(value);
  return d ? d.getTime() : 0;
}

export function formatTimeAgo(value: FirestoreTimestamp | undefined): string {
  const date = toDateSafe(value);
  if (!date) return 'Just now';

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'Just now';

  const intervals: [number, string][] = [
    [31536000, 'y'],
    [2592000, 'mo'],
    [86400, 'd'],
    [3600, 'h'],
    [60, 'm'],
  ];

  for (const [unitSeconds, suffix] of intervals) {
    const count = Math.floor(seconds / unitSeconds);
    if (count >= 1) return `${count}${suffix}`;
  }

  return 'Just now';
}

export function formatClockTime(value: FirestoreTimestamp | undefined): string {
  const date = toDateSafe(value);
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatCallDuration(seconds: number | undefined): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function dmThreadId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/**
 * Deterministic 32-bit FNV-1a integer UID for Agora RTC (preserved verbatim from Trendit app.js)
 */
export function getAgoraNumericUid(firebaseUid: string): number {
  let hash = 2166136261;
  const value = String(firebaseUid);
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash = hash >>> 0;
  return (hash % 2147483646) + 1;
}

export function makeAgoraChannelName(): string {
  return `trendit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[a-zA-Z0-9_]{2,40}/g) || [];
  return Array.from(new Set(matches.map((tag) => tag.toLowerCase())));
}

const AVATAR_GRADIENTS: [string, string][] = [
  ['#7C3AED', '#EC4899'],
  ['#2563EB', '#7C3AED'],
  ['#EC4899', '#FF5A5F'],
  ['#0EA5E9', '#6366F1'],
  ['#8B5CF6', '#F43F5E'],
  ['#4F46E5', '#06B6D4'],
];

export function getInitialAvatarSvgDataUri(seed = 'Trendit', label?: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const [c1, c2] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  const cleanLabel = (label || seed || 'T').replace(/^@/, '').trim();
  const initials = cleanLabel
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'T';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="60" fill="url(#g)" />
    <text x="60" y="64" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="700" font-size="44">${initials.replace(/[<>&"']/g, '')}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function getRawAvatarCandidate(user?: Partial<UserProfile> | null): string {
  if (!user) return '';
  const candidates = [
    user.photoURL,
    user.avatarUrl,
    user.photoUrl,
    user.avatar,
    user.profilePicture,
    user.profilePhoto,
  ];
  return candidates.find((v) => typeof v === 'string' && v.trim().length > 0)?.trim() || '';
}

export function formatCompactNumber(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}
