import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  MessageSquarePlus,
  Music,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  Send,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCall } from '@/contexts/CallContext';
import { useSocialData } from '@/contexts/SocialDataContext';
import { useToast } from '@/contexts/ToastContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  sendDirectMessageToUser,
  subscribeToDmInbox,
  subscribeToThreadMessages,
} from '@/services/dmService';
import { uploadMediaAsset } from '@/services/mediaService';
import { getUserProfile, searchAllUsers, toggleFollowUser } from '@/services/userService';
import type { DmMessage, DmThreadSummary, MediaType, UserProfile } from '@/types';
import {
  dmThreadId,
  formatCallDuration,
  formatClockTime,
  formatTimeAgo,
} from '@/utils/formatters';

export const MessagesPage: React.FC = () => {
  const { uid: activePeerUid } = useParams<{ uid?: string }>();
  const navigate = useNavigate();
  const { userProfile, followingIds, isFollowingUser } = useAuth();
  const { startCall } = useCall();
  const { openLightbox } = useSocialData();
  const { showToast } = useToast();

  const [inboxThreads, setInboxThreads] = useState<DmThreadSummary[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [followedProfiles, setFollowedProfiles] = useState<UserProfile[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [directoryResults, setDirectoryResults] = useState<UserProfile[]>([]);
  const [searchingDirectory, setSearchingDirectory] = useState(false);

  const [peerProfile, setPeerProfile] = useState<UserProfile | null>(null);
  const [peerLoading, setPeerLoading] = useState(false);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [draftText, setDraftText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<MediaType | null>(null);
  const [sending, setSending] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentUid = userProfile?.uid || '';

  // Subscribe to real-time DM inbox threads
  useEffect(() => {
    if (!currentUid) return;
    setInboxLoading(true);
    const unsub = subscribeToDmInbox(currentUid, (threads) => {
      setInboxThreads(threads);
      setInboxLoading(false);
    });
    return () => unsub();
  }, [currentUid]);

  // Load followed user profiles so user can quickly message anyone they follow
  useEffect(() => {
    let active = true;
    if (!followingIds.length) {
      setFollowedProfiles([]);
      return;
    }

    Promise.all(followingIds.slice(0, 40).map((uid) => getUserProfile(uid))).then((list) => {
      if (!active) return;
      const valid = list
        .filter((u): u is UserProfile => u !== null)
        .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
      setFollowedProfiles(valid);
    });

    return () => {
      active = false;
    };
  }, [followingIds]);

  // Directory search when typing in search box
  useEffect(() => {
    const term = searchQuery.trim();
    if (!term || !currentUid) {
      setDirectoryResults([]);
      setSearchingDirectory(false);
      return;
    }

    let cancelled = false;
    setSearchingDirectory(true);
    const timer = window.setTimeout(async () => {
      const found = await searchAllUsers(term, currentUid);
      if (!cancelled) {
        setDirectoryResults(found.slice(0, 20));
        setSearchingDirectory(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery, currentUid]);

  // Load active peer profile & subscribe to real-time thread messages
  useEffect(() => {
    if (!activePeerUid || !currentUid) {
      setPeerProfile(null);
      setMessages([]);
      return;
    }

    let active = true;
    setPeerLoading(true);
    setMessagesLoading(true);

    getUserProfile(activePeerUid).then((profile) => {
      if (!active) return;
      setPeerProfile(profile);
      setPeerLoading(false);
    });

    const threadId = dmThreadId(currentUid, activePeerUid);
    const unsubMsgs = subscribeToThreadMessages(threadId, (items) => {
      if (!active) return;
      setMessages(items);
      setMessagesLoading(false);
    });

    return () => {
      active = false;
      unsubMsgs();
    };
  }, [activePeerUid, currentUid]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, activePeerUid]);

  const threadUserIds = useMemo(
    () => new Set(inboxThreads.map((t) => t.user.uid)),
    [inboxThreads]
  );

  const quickStartContacts = useMemo(
    () => followedProfiles.filter((u) => !threadUserIds.has(u.uid)),
    [followedProfiles, threadUserIds]
  );

  const filteredInbox = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (!q) return inboxThreads;
    return inboxThreads.filter(
      (t) =>
        t.user.displayName.toLowerCase().includes(q) ||
        t.user.handle.toLowerCase().includes(q) ||
        (t.lastMessage || '').toLowerCase().includes(q)
    );
  }, [inboxThreads, searchQuery]);

  const isFollowingPeer = Boolean(activePeerUid && isFollowingUser(activePeerUid));

  const clearAttachment = () => {
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);
    setSelectedFile(null);
    setSelectedPreview(null);
    setSelectedMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (selectedPreview) URL.revokeObjectURL(selectedPreview);

    const kind: MediaType = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
      ? 'audio'
      : 'image';

    setSelectedFile(file);
    setSelectedMediaType(kind);
    setSelectedPreview(URL.createObjectURL(file));
  };

  const handleFollowPeer = async () => {
    if (!userProfile || !activePeerUid || followBusy) return;
    setFollowBusy(true);
    try {
      const res = await toggleFollowUser(userProfile, activePeerUid);
      if (res.isFollowing) {
        showToast(
          `Following @${peerProfile?.handle || 'user'} — direct messaging and calling unlocked.`,
          'success'
        );
      }
    } catch {
      showToast('Could not follow user right now.', 'error');
    } finally {
      setFollowBusy(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!userProfile || !activePeerUid || sending) return;
    if (!draftText.trim() && !selectedFile) return;

    setSending(true);
    setUploadPct(null);

    try {
      let mediaUrl: string | null = null;
      let mediaType: MediaType | null = null;

      if (selectedFile) {
        const uploaded = await uploadMediaAsset(
          selectedFile,
          'dms',
          userProfile.uid,
          (pct) => setUploadPct(pct)
        );
        mediaUrl = uploaded.url;
        mediaType = uploaded.mediaType;
      }

      await sendDirectMessageToUser({
        sender: userProfile,
        recipientUid: activePeerUid,
        text: draftText,
        mediaUrl,
        mediaType,
      });

      setDraftText('');
      clearAttachment();
    } catch (err: any) {
      showToast(err?.message || 'Failed to send message.', 'error');
    } finally {
      setSending(false);
      setUploadPct(null);
    }
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-[#11141D] border border-slate-200/85 dark:border-slate-800/85 shadow-sm overflow-hidden min-h-[calc(100vh-8.5rem)] md:h-[calc(100vh-4rem)] flex">
      {/* Left Pane: Inbox & Contacts */}
      <section
        aria-label="Direct message conversations"
        className={`${
          activePeerUid ? 'hidden lg:flex' : 'flex'
        } w-full lg:w-88 xl:w-96 shrink-0 flex-col border-r border-slate-200/80 dark:border-slate-800/80`}
      >
        <div className="px-5 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Messages
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time chat, voice & HD video calls
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people or messages..."
              className="w-full h-11 pl-10 pr-9 rounded-2xl bg-slate-100/90 dark:bg-[#0B0E15] border border-transparent focus:border-violet-500 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
          {inboxLoading ? (
            <div className="py-14 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : searchQuery.trim() ? (
            <>
              {filteredInbox.length > 0 && (
                <div className="py-2">
                  <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Active Conversations
                  </div>
                  {filteredInbox.map((thread) => {
                    const selected = activePeerUid === thread.user.uid;
                    return (
                      <button
                        key={thread.threadId}
                        type="button"
                        onClick={() => navigate(`/messages/${thread.user.uid}`)}
                        className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition-colors ${
                          selected
                            ? 'bg-violet-600/10 dark:bg-violet-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <UserAvatar user={thread.user} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {thread.user.displayName}
                            </span>
                            {thread.updatedAt > 0 && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                                {formatTimeAgo(thread.updatedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {thread.lastMessage || `@${thread.user.handle}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="py-2">
                <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Trendit Directory
                </div>
                {searchingDirectory ? (
                  <div className="py-8 flex items-center justify-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : directoryResults.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    No matching people found.
                  </div>
                ) : (
                  directoryResults.map((person) => {
                    const following = isFollowingUser(person.uid);
                    return (
                      <button
                        key={person.uid}
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          navigate(`/messages/${person.uid}`);
                        }}
                        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <UserAvatar user={person} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            {person.displayName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            @{person.handle} · {following ? 'Following' : 'Follow to message'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              {/* Recent Conversations */}
              {inboxThreads.length > 0 && (
                <div className="py-2">
                  <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Recent Conversations
                  </div>
                  {inboxThreads.map((thread) => {
                    const selected = activePeerUid === thread.user.uid;
                    return (
                      <button
                        key={thread.threadId}
                        type="button"
                        onClick={() => navigate(`/messages/${thread.user.uid}`)}
                        className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition-colors ${
                          selected
                            ? 'bg-violet-600/10 dark:bg-violet-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <UserAvatar user={thread.user} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {thread.user.displayName}
                            </span>
                            {thread.updatedAt > 0 && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                                {formatTimeAgo(thread.updatedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {thread.lastMessage || `Tap to chat with @${thread.user.handle}`}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* People You Follow */}
              {quickStartContacts.length > 0 && (
                <div className="py-2">
                  <div className="px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    People You Follow
                  </div>
                  {quickStartContacts.map((person) => {
                    const selected = activePeerUid === person.uid;
                    return (
                      <button
                        key={person.uid}
                        type="button"
                        onClick={() => navigate(`/messages/${person.uid}`)}
                        className={`w-full px-5 py-3 flex items-center gap-3.5 text-left transition-colors ${
                          selected
                            ? 'bg-violet-600/10 dark:bg-violet-500/15'
                            : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <UserAvatar user={person} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {person.displayName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            @{person.handle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {inboxThreads.length === 0 && quickStartContacts.length === 0 && (
                <div className="px-6 py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3.5">
                    <MessageSquarePlus className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Start your first conversation
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    Follow creators in Explore or search above to send direct messages and start HD audio or video calls.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/explore')}
                    className="mt-5 min-h-[42px] px-5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
                  >
                    Discover People
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Right Pane: Active Conversation */}
      <section
        aria-label="Conversation thread"
        className={`${
          activePeerUid ? 'flex' : 'hidden lg:flex'
        } flex-1 min-w-0 flex-col bg-slate-50/40 dark:bg-[#0D1018]`}
      >
        {!activePeerUid ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600/15 via-fuchsia-500/15 to-coral-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4">
              <MessageSquarePlus className="w-8 h-8" />
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Select a conversation
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mt-1.5 leading-relaxed">
              Choose someone from your inbox or followed creators to message, share media, or jump on a live Agora voice or video call.
            </p>
          </div>
        ) : peerLoading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : !peerProfile ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              This user profile could not be found.
            </p>
            <button
              type="button"
              onClick={() => navigate('/messages')}
              className="mt-4 min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-semibold"
            >
              Back to Messages
            </button>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <header className="px-4 sm:px-5 py-3 bg-white/90 dark:bg-[#11141D]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate('/messages')}
                  aria-label="Back to conversations"
                  className="lg:hidden min-h-[44px] min-w-[44px] -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate(`/profile/${peerProfile.uid}`)}
                  className="flex items-center gap-3 min-w-0 text-left hover:opacity-90 transition-opacity"
                >
                  <UserAvatar user={peerProfile} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                      {peerProfile.displayName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      @{peerProfile.handle}
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => startCall(peerProfile.uid, 'audio')}
                  aria-label={`Audio call ${peerProfile.displayName}`}
                  title={isFollowingPeer ? 'Start voice call' : 'Follow first to start a voice call'}
                  className="min-h-[44px] min-w-[44px] rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50 dark:bg-[#171B28] text-slate-700 dark:text-slate-200 hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-400 flex items-center justify-center transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => startCall(peerProfile.uid, 'video')}
                  aria-label={`Video call ${peerProfile.displayName}`}
                  title={isFollowingPeer ? 'Start HD video call' : 'Follow first to start a video call'}
                  className="min-h-[44px] min-w-[44px] rounded-2xl bg-gradient-to-r from-violet-600 to-electric-600 text-white shadow-sm hover:opacity-95 flex items-center justify-center transition-opacity"
                >
                  <Video className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Message History Stream */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-3.5">
              {messagesLoading ? (
                <div className="py-12 flex items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center">
                  <UserAvatar user={peerProfile} size="xl" className="mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {peerProfile.displayName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    @{peerProfile.handle}
                  </p>
                  {peerProfile.bio && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 max-w-sm mx-auto mt-3">
                      {peerProfile.bio}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">
                    {isFollowingPeer
                      ? 'Send a message below or tap the phone/video icons above to call.'
                      : 'Follow this user below to unlock direct messages and live calling.'}
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.senderUid === currentUid;

                  // Preserved Call History Entry
                  if (msg.type === 'call') {
                    const outgoing = (msg.callerUid || msg.senderUid) === currentUid;
                    const accepted = msg.callStatus === 'accepted';
                    const isVideo = msg.callType === 'video';

                    let title = '';
                    if (accepted) {
                      title = `${outgoing ? 'Outgoing' : 'Incoming'} ${
                        isVideo ? 'video' : 'voice'
                      } call`;
                    } else {
                      title = outgoing
                        ? `Unanswered ${isVideo ? 'video' : 'voice'} call`
                        : `Missed ${isVideo ? 'video' : 'voice'} call`;
                    }

                    return (
                      <div key={msg.id} className="flex justify-center my-2">
                        <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#151926] border border-slate-200/85 dark:border-slate-800 shadow-xs max-w-full">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              accepted
                                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {!accepted ? (
                              <PhoneMissed className="w-4 h-4" />
                            ) : outgoing ? (
                              <PhoneOutgoing className="w-4 h-4" />
                            ) : (
                              <PhoneIncoming className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {title}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {accepted && (msg.durationSec || 0) > 0
                                ? `${formatCallDuration(msg.durationSec)} · `
                                : ''}
                              {formatClockTime(msg.createdAt) || formatTimeAgo(msg.createdAt)}
                            </div>
                          </div>
                          {isFollowingPeer && (
                            <button
                              type="button"
                              onClick={() =>
                                startCall(peerProfile.uid, isVideo ? 'video' : 'audio')
                              }
                              className="ml-1 min-h-[34px] px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-violet-600 hover:text-white text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
                            >
                              Call back
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Standard Text / Media DM Bubble
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[84%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-xs ${
                          isMine
                            ? 'bg-gradient-to-br from-violet-600 to-electric-600 text-white rounded-br-md'
                            : 'bg-white dark:bg-[#161B29] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800 rounded-bl-md'
                        }`}
                      >
                        {msg.mediaUrl && (
                          <div className="mb-2 overflow-hidden rounded-xl">
                            {msg.mediaType === 'video' ? (
                              <video
                                src={msg.mediaUrl}
                                controls
                                playsInline
                                className="max-h-72 w-full rounded-xl bg-black object-contain"
                              />
                            ) : msg.mediaType === 'audio' ? (
                              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/15">
                                <Music className="w-4 h-4 shrink-0" />
                                <audio src={msg.mediaUrl} controls className="w-full h-9" />
                              </div>
                            ) : (
                              <img
                                src={msg.mediaUrl}
                                alt="Message attachment"
                                referrerPolicy="no-referrer"
                                onClick={() => openLightbox(msg.mediaUrl!, 'image', msg.text)}
                                className="max-h-72 w-full object-cover rounded-xl cursor-zoom-in"
                              />
                            )}
                          </div>
                        )}

                        {msg.text && (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.text}
                          </p>
                        )}
                      </div>

                      <span className="mt-1 px-1 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {formatClockTime(msg.createdAt) || formatTimeAgo(msg.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Follow-Gate OR Message Composer */}
            {!isFollowingPeer ? (
              <div className="p-4 bg-white dark:bg-[#11141D] border-t border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-center sm:text-left">
                  Follow <strong className="text-slate-900 dark:text-white">@{peerProfile.handle}</strong> to send direct messages and start audio or video calls.
                </div>
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={handleFollowPeer}
                  className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {followBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  <span>Follow @{peerProfile.handle}</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 bg-white dark:bg-[#11141D] border-t border-slate-200/80 dark:border-slate-800/80"
              >
                {selectedPreview && (
                  <div className="mb-3 relative inline-flex items-center gap-3 p-2 pr-9 rounded-2xl bg-slate-100 dark:bg-[#171C29] border border-slate-200 dark:border-slate-800">
                    {selectedMediaType === 'video' ? (
                      <video src={selectedPreview} className="w-16 h-16 rounded-xl object-cover" />
                    ) : selectedMediaType === 'audio' ? (
                      <div className="w-12 h-12 rounded-xl bg-violet-600/15 text-violet-500 flex items-center justify-center">
                        <Music className="w-5 h-5" />
                      </div>
                    ) : (
                      <img
                        src={selectedPreview}
                        alt="Selected attachment"
                        className="w-16 h-16 rounded-xl object-cover"
                      />
                    )}
                    <div className="text-xs text-slate-600 dark:text-slate-300 max-w-[180px] truncate">
                      {selectedFile?.name}
                      {uploadPct !== null && (
                        <div className="text-[11px] font-semibold text-violet-500 tabular-nums mt-0.5">
                          Uploading {uploadPct}%
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearAttachment}
                      aria-label="Remove attachment"
                      className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    onChange={handlePickFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach photo, video, or audio"
                    className="min-h-[44px] min-w-[44px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B0E15] text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 flex items-center justify-center shrink-0 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                  </button>

                  <textarea
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    rows={1}
                    placeholder={`Message @${peerProfile.handle}...`}
                    className="flex-1 min-h-[44px] max-h-32 px-4 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-[#0B0E15] border border-transparent focus:border-violet-500 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!draftText.trim() && !selectedFile)}
                    aria-label="Send message"
                    className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-coral-500 text-white font-semibold text-sm flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 disabled:opacity-45 transition-opacity shrink-0"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
};
