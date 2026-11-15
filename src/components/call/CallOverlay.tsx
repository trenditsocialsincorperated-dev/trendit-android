import React, { useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { useCall } from '@/contexts/CallContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { formatCallDuration } from '@/utils/formatters';

export const CallOverlay: React.FC = () => {
  const {
    activeCall,
    peerUser,
    isIncomingRinging,
    callStatusText,
    durationSec,
    isMicMuted,
    isCameraOff,
    isMinimized,
    localVideoTrack,
    remoteUsers,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCamera,
    flipCamera,
    setMinimized,
  } = useCall();

  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteContainerRef = useRef<HTMLDivElement | null>(null);

  const primaryRemoteVideoUser = remoteUsers.find((u) => Boolean(u.videoTrack));

  useEffect(() => {
    const el = localContainerRef.current;
    if (!el || !localVideoTrack || isCameraOff || isMinimized) return;
    localVideoTrack.play(el);
    return () => {
      try {
        localVideoTrack.stop();
      } catch {}
    };
  }, [localVideoTrack, isCameraOff, isMinimized]);

  useEffect(() => {
    const el = remoteContainerRef.current;
    if (!el || !primaryRemoteVideoUser?.videoTrack || isMinimized) return;
    primaryRemoteVideoUser.videoTrack.play(el);
    return () => {
      try {
        primaryRemoteVideoUser.videoTrack?.stop();
      } catch {}
    };
  }, [primaryRemoteVideoUser, isMinimized]);

  if (!activeCall) return null;

  const peerName = peerUser?.displayName || activeCall.callerName || 'Trendit Member';
  const peerHandle = peerUser?.handle || activeCall.callerHandle || 'user';
  const isVideoCall = activeCall.type === 'video';

  // Floating Minimized Pill
  if (isMinimized && !isIncomingRinging) {
    return (
      <div className="fixed top-16 right-4 z-[95] flex items-center gap-3 rounded-2xl bg-slate-900/95 text-white border border-white/15 px-3.5 py-2.5 shadow-2xl backdrop-blur-xl">
        <UserAvatar user={peerUser} name={peerName} size="sm" />
        <div className="min-w-0">
          <div className="text-xs font-bold truncate max-w-[120px]">{peerName}</div>
          <div className="text-[11px] font-mono tabular-nums text-emerald-400">
            {activeCall.status === 'accepted' ? formatCallDuration(durationSec) : callStatusText}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand call"
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={endCall}
          aria-label="End call"
          className="p-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live call"
      className="fixed inset-0 z-[95] bg-[#06080D] text-white flex flex-col justify-between overflow-hidden"
    >
      {/* Remote Video Full-Bleed Canvas */}
      <div className="absolute inset-0">
        {primaryRemoteVideoUser?.videoTrack ? (
          <div ref={remoteContainerRef} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#120D26] via-[#090B12] to-[#1A0D1C] flex flex-col items-center justify-center p-6">
            <div className="p-1.5 rounded-full bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-coral-500 shadow-2xl mb-5">
              <UserAvatar user={peerUser} name={peerName} size="2xl" />
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white text-center">
              {peerName}
            </h2>
            <p className="text-sm text-slate-400 mt-1">@{peerHandle}</p>
            <p className="mt-4 text-sm font-medium text-violet-300 font-mono tabular-nums">
              {activeCall.status === 'accepted' && !isIncomingRinging
                ? formatCallDuration(durationSec)
                : callStatusText}
            </p>
          </div>
        )}
      </div>

      {/* Top Scrim Header */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 pt-safe bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          {primaryRemoteVideoUser?.videoTrack && (
            <>
              <UserAvatar user={peerUser} name={peerName} size="sm" />
              <div>
                <div className="text-sm font-bold">{peerName}</div>
                <div className="text-xs text-white/75 font-mono tabular-nums">
                  {activeCall.status === 'accepted'
                    ? formatCallDuration(durationSec)
                    : callStatusText}
                </div>
              </div>
            </>
          )}
          {!primaryRemoteVideoUser?.videoTrack && (
            <span className="text-xs font-semibold text-white/75">
              Trendit {isVideoCall ? 'HD Video' : 'Voice'} Call
            </span>
          )}
        </div>

        {!isIncomingRinging && (
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize call window"
            className="min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md flex items-center justify-center"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Local Camera PiP Preview */}
      {localVideoTrack && !isCameraOff && !isIncomingRinging && (
        <div className="absolute right-4 top-20 z-20 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden border border-white/25 bg-slate-900 shadow-2xl">
          <div ref={localContainerRef} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Bottom Call Controls */}
      <div className="relative z-10 px-6 py-8 pb-safe bg-gradient-to-t from-black/90 via-black/50 to-transparent">
        {isIncomingRinging ? (
          <div className="flex items-center justify-center gap-12">
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={declineCall}
                aria-label="Decline call"
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs font-medium text-white/80">Decline</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={acceptCall}
                aria-label="Accept call"
                className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
              >
                {isVideoCall ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
              </button>
              <span className="text-xs font-medium text-white/80">Accept</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={toggleMic}
              aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`w-13 h-13 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                isMicMuted
                  ? 'bg-white text-slate-900'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
              className={`w-13 h-13 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${
                isCameraOff
                  ? 'bg-white/15 hover:bg-white/25 text-white/80'
                  : 'bg-violet-600 hover:bg-violet-500 text-white'
              }`}
            >
              {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            {!isCameraOff && (
              <button
                type="button"
                onClick={flipCamera}
                aria-label="Switch camera"
                className="w-13 h-13 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-md transition-colors"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={endCall}
              aria-label="End call"
              className="w-15 h-15 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
