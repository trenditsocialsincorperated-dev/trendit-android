import type { Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp | { toDate: () => Date; toMillis?: () => number } | Date | number | null;

export interface UserPreferences {
  notifyLikes?: boolean;
  notifyReplies?: boolean;
  notifyFollows?: boolean;
  notifyMessages?: boolean;
  privateProfile?: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  handle: string;
  age?: number | string;
  gender?: string;
  bio?: string;
  email?: string;
  photoURL?: string | null;
  avatarUrl?: string | null;
  photoUrl?: string | null;
  avatar?: string | null;
  profilePicture?: string | null;
  profilePhoto?: string | null;
  coverURL?: string | null;
  location?: string;
  website?: string;
  fcmToken?: string;
  fcmPlatform?: 'android' | string;
  fcmUpdatedAt?: FirestoreTimestamp;
  webFcmToken?: string;
  webFcmPlatform?: 'web' | string;
  webFcmTokenUpdatedAt?: FirestoreTimestamp;
  bookmarkedPostIds?: string[];
  preferences?: UserPreferences;
  createdAt?: FirestoreTimestamp;
}

export interface PollOption {
  text: string;
  votes: number;
}

export interface PollData {
  options: PollOption[];
  totalVotes: number;
  voters: Record<string, number>;
}

export type MediaType = 'image' | 'video' | 'audio';

export interface RepostPreview {
  postId: string;
  uid: string;
  displayName: string;
  handle: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
}

export interface Post {
  id: string;
  uid: string;
  displayName: string;
  handle: string;
  userPhotoURL?: string | null;
  text: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  poll?: PollData | null;
  likesCount: number;
  likedBy: string[];
  repliesCount: number;
  sharesCount?: number;
  repostOf?: RepostPreview | null;
  tags?: string[];
  createdAt?: FirestoreTimestamp;
}

export interface Reply {
  id: string;
  uid: string;
  displayName: string;
  handle: string;
  userPhotoURL?: string | null;
  text: string;
  createdAt?: FirestoreTimestamp;
}

export interface Story {
  id: string;
  uid: string;
  displayName: string;
  handle: string;
  userPhotoURL?: string | null;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | 'text';
  caption?: string;
  bgGradient?: string;
  viewers?: string[];
  createdAt?: FirestoreTimestamp;
  expiresAtMs?: number;
}

export interface DmThreadSummary {
  threadId: string;
  updatedAt: number;
  lastMessage?: string;
  user: UserProfile;
}

export interface DmMessage {
  id: string;
  type?: 'text' | 'media' | 'call';
  senderUid: string;
  recipientUid: string;
  text?: string;
  mediaUrl?: string | null;
  mediaType?: MediaType | null;
  callerUid?: string;
  calleeUid?: string;
  callType?: 'audio' | 'video';
  callStatus?: 'accepted' | 'declined';
  durationSec?: number;
  createdAt?: FirestoreTimestamp;
}

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended';

export interface CallSession {
  id: string;
  callerUid: string;
  calleeUid: string;
  callerName?: string;
  callerHandle?: string;
  callerAvatar?: string | null;
  type: CallType;
  channel: string;
  status: CallStatus;
  createdAt?: FirestoreTimestamp;
  acceptedAt?: FirestoreTimestamp;
  endedAt?: FirestoreTimestamp;
}

export type NotificationType =
  | 'like'
  | 'reply'
  | 'follow'
  | 'unfollow'
  | 'post'
  | 'comment'
  | 'dm'
  | 'call';

export interface AppNotification {
  id: string;
  recipientUid: string;
  senderUid: string;
  senderHandle: string;
  senderName?: string;
  senderAvatar?: string | null;
  type: NotificationType;
  text: string;
  postId?: string | null;
  read: boolean;
  createdAt?: FirestoreTimestamp;
}

export interface TrendingTopic {
  tag: string;
  category: string;
  postsCount: number;
}

export interface PushDiagnosticState {
  platform: 'android-capacitor' | 'web';
  permission: 'granted' | 'denied' | 'default' | 'unsupported';
  hasStoredToken: boolean;
  vapidConfigured: boolean;
  fcmAdminConfigured: boolean | null;
  agoraCertificateConfigured: boolean | null;
  statusSummary: string;
  missingComponents: string[];
}
