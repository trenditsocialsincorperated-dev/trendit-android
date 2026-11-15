import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { IAgoraRTCRemoteUser, ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { db } from '@/services/firebase';
import { agoraEngine } from '@/services/agoraService';
import { checkIsFollowing, getUserProfile } from '@/services/userService';
import { recordCallHistoryItem } from '@/services/dmService';
import { sendSocialNotification, sendCallStatusPush } from '@/services/notificationService';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { CallSession, CallType, UserProfile } from '@/types';
import { dmThreadId, makeAgoraChannelName } from '@/utils/formatters';

interface CallContextValue {
  activeCall: CallSession | null;
  peerUser: UserProfile | null;
  isIncomingRinging: boolean;
  callStatusText: string;
  durationSec: number;
  isMicMuted: boolean;
  isCameraOff: boolean;
  isMinimized: boolean;
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  startCall: (targetUid: string, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  flipCamera: () => Promise<void>;
  setMinimized: (minimized: boolean) => void;
}

const CallContext = createContext<CallContextValue>({
  activeCall: null,
  peerUser: null,
  isIncomingRinging: false,
  callStatusText: '',
  durationSec: 0,
  isMicMuted: false,
  isCameraOff: false,
  isMinimized: false,
  localVideoTrack: null,
  remoteUsers: [],
  startCall: async () => {},
  acceptCall: async () => {},
  declineCall: async () => {},
  endCall: async () => {},
  toggleMic: async () => {},
  toggleCamera: async () => {},
  flipCamera: async () => {},
  setMinimized: () => {},
});

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const { showToast } = useToast();

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [peerUser, setPeerUser] = useState<UserProfile | null>(null);
  const [isIncomingRinging, setIsIncomingRinging] = useState(false);
  const [callStatusText, setCallStatusText] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isMinimized, setMinimized] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  const activeCallIdRef = useRef<string | null>(null);
  const connectedAtMsRef = useRef<number | null>(null);
  const historyWrittenRef = useRef<boolean>(false);
  const callDocUnsubRef = useRef<Unsubscribe | null>(null);
  const stopRingtone = useCallback(() => {
    const nativePush = (window as any).Capacitor?.Plugins?.NativePush;
    nativePush?.stopIncomingCallAlert?.().catch?.(() => {});
  }, []);

  const startRingtone = useCallback((callerName = 'Trendit user') => {
    const nativePush = (window as any).Capacitor?.Plugins?.NativePush;
    nativePush?.startIncomingCallAlert?.({ callerName }).catch?.(() => {});
  }, []);

  const cleanupCallState = useCallback(async () => {
    stopRingtone();
    if (callDocUnsubRef.current) {
      callDocUnsubRef.current();
      callDocUnsubRef.current = null;
    }
    await agoraEngine.leaveChannel();
    activeCallIdRef.current = null;
    connectedAtMsRef.current = null;
    historyWrittenRef.current = false;
    setActiveCall(null);
    setPeerUser(null);
    setIsIncomingRinging(false);
    setCallStatusText('');
    setDurationSec(0);
    setIsMicMuted(false);
    setIsCameraOff(false);
    setMinimized(false);
    setLocalVideoTrack(null);
    setRemoteUsers([]);
  }, [stopRingtone]);

  // Live call duration timer
  useEffect(() => {
    if (!activeCall || isIncomingRinging || activeCall.status !== 'accepted') return;
    const interval = window.setInterval(() => {
      if (connectedAtMsRef.current) {
        setDurationSec(Math.max(0, Math.floor((Date.now() - connectedAtMsRef.current) / 1000)));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeCall, isIncomingRinging]);

  // Listen for incoming calls on Firestore `calls` collection
  useEffect(() => {
    if (!userProfile?.uid) return;

    const q = query(collection(db, 'calls'), where('calleeUid', '==', userProfile.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type !== 'added' && change.type !== 'modified') return;
          if (activeCallIdRef.current) return;

          const data = change.doc.data();
          if (
            !data ||
            data.status !== 'ringing' ||
            data.callerUid === userProfile.uid ||
            !data.channel
          ) {
            return;
          }

          const callId = change.doc.id;
          activeCallIdRef.current = callId;
          connectedAtMsRef.current = null;
          historyWrittenRef.current = false;

          const callerProfile = await getUserProfile(data.callerUid);
          setPeerUser(callerProfile);
          setActiveCall({
            id: callId,
            callerUid: data.callerUid,
            calleeUid: data.calleeUid,
            callerName: callerProfile?.displayName || data.callerName || 'Trendit User',
            callerHandle: callerProfile?.handle,
            callerAvatar: callerProfile?.photoURL || null,
            type: data.type === 'video' ? 'video' : 'audio',
            channel: data.channel,
            status: 'ringing',
          });
          setIsIncomingRinging(true);
          setIsCameraOff(data.type !== 'video');
          setCallStatusText(`Incoming ${data.type === 'video' ? 'video' : 'audio'} call...`);
          startRingtone(callerProfile?.displayName || data.callerName || 'Trendit user');

          // Watch call doc in case caller hangs up before we answer
          if (callDocUnsubRef.current) callDocUnsubRef.current();
          callDocUnsubRef.current = onSnapshot(doc(db, 'calls', callId), (callSnap) => {
            const latest = callSnap.data();
            if (!latest) return;
            if (latest.status === 'ended' || latest.status === 'declined') {
              cleanupCallState();
            } else if (latest.status === 'accepted') {
              stopRingtone();
              setActiveCall((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
            }
          });
        });
      },
      (err) => {
        console.warn('Incoming call listener error:', err);
      }
    );

    return () => {
      unsub();
    };
  }, [userProfile?.uid, cleanupCallState, startRingtone]);

  const startCall = useCallback(
    async (targetUid: string, type: CallType) => {
      if (!userProfile?.uid) return;
      if (activeCallIdRef.current) {
        showToast('You already have an active call in progress.', 'info');
        return;
      }

      const followed = await checkIsFollowing(userProfile.uid, targetUid);
      if (!followed) {
        showToast('Follow this user first to start an audio or video call.', 'error');
        return;
      }

      try {
        const targetProfile = await getUserProfile(targetUid);
        const threadId = dmThreadId(userProfile.uid, targetUid);

        await setDoc(
          doc(db, 'dmThreads', threadId),
          {
            participants: [userProfile.uid, targetUid],
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const callId = `${threadId}_${Date.now()}`;
        const channel = makeAgoraChannelName();
        activeCallIdRef.current = callId;
        connectedAtMsRef.current = null;
        historyWrittenRef.current = false;

        const callRef = doc(db, 'calls', callId);
        await setDoc(callRef, {
          callerUid: userProfile.uid,
          calleeUid: targetUid,
          type,
          channel,
          status: 'ringing',
          createdAt: serverTimestamp(),
        });

        setPeerUser(targetProfile);
        setActiveCall({
          id: callId,
          callerUid: userProfile.uid,
          calleeUid: targetUid,
          type,
          channel,
          status: 'ringing',
        });
        setIsIncomingRinging(false);
        setIsMicMuted(false);
        setIsCameraOff(type !== 'video');
        setMinimized(false);
        setCallStatusText('Ringing...');

        sendSocialNotification({
          recipientUid: targetUid,
          sender: userProfile,
          type: 'call',
          text: `${userProfile.displayName} is calling you (${type}).`,
          callId,
        }).catch(() => {});

        if (callDocUnsubRef.current) callDocUnsubRef.current();
        callDocUnsubRef.current = onSnapshot(callRef, async (snap) => {
          const data = snap.data();
          if (!data) return;

          if (data.status === 'declined' || data.status === 'ended') {
            setCallStatusText(data.status === 'declined' ? 'Call declined' : 'Call ended');
            if (!historyWrittenRef.current) {
              historyWrittenRef.current = true;
              const wasAccepted = Boolean(connectedAtMsRef.current || data.acceptedAt);
              const secs = connectedAtMsRef.current
                ? Math.max(0, Math.round((Date.now() - connectedAtMsRef.current) / 1000))
                : 0;
              await recordCallHistoryItem({
                callId,
                callerUid: userProfile.uid,
                calleeUid: targetUid,
                callType: type,
                callStatus: wasAccepted ? 'accepted' : 'declined',
                durationSec: secs,
              }).catch(() => {});
            }
            window.setTimeout(() => {
              cleanupCallState();
            }, 400);
            return;
          }

          if (data.status === 'accepted' && !connectedAtMsRef.current) {
            connectedAtMsRef.current = Date.now();
            setActiveCall((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
            setCallStatusText('Connected');
          }
        });

        const { localVideoTrack: videoTrack } = await agoraEngine.joinChannel(
          channel,
          userProfile.uid,
          type,
          {
            onRemoteUsersChanged: (users) => setRemoteUsers([...users]),
            onConnectionStateChange: (state) => {
              if (state === 'CONNECTED' && connectedAtMsRef.current) {
                setCallStatusText('Connected');
              } else if (state === 'RECONNECTING') {
                setCallStatusText('Reconnecting...');
              }
            },
            onError: (msg) => showToast(msg, 'error'),
          }
        );

        setLocalVideoTrack(videoTrack);
      } catch (err: any) {
        console.error('Start call failed:', err);
        showToast(err?.message || 'Could not start call. Check microphone/camera permissions.', 'error');
        await cleanupCallState();
      }
    },
    [userProfile, showToast, cleanupCallState]
  );

  const acceptCall = useCallback(async () => {
    const callId = activeCallIdRef.current;
    if (!callId || !userProfile?.uid || !activeCall) return;

    try {
      stopRingtone();
      setCallStatusText('Connecting...');

      const callRef = doc(db, 'calls', callId);
      const snap = await getDoc(callRef);
      const data = snap.data();
      if (!data || data.status !== 'ringing' || !data.channel) {
        showToast('This call is no longer available.', 'info');
        await cleanupCallState();
        return;
      }

      const callType: CallType = data.type === 'video' ? 'video' : 'audio';
      const { localVideoTrack: videoTrack } = await agoraEngine.joinChannel(
        data.channel,
        userProfile.uid,
        callType,
        {
          onRemoteUsersChanged: (users) => setRemoteUsers([...users]),
          onConnectionStateChange: (state) => {
            if (state === 'CONNECTED') setCallStatusText('Connected');
            else if (state === 'RECONNECTING') setCallStatusText('Reconnecting...');
          },
          onError: (msg) => showToast(msg, 'error'),
        }
      );

      setLocalVideoTrack(videoTrack);

      await updateDoc(callRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      connectedAtMsRef.current = Date.now();
      setIsIncomingRinging(false);
      setActiveCall((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
      setCallStatusText('Connected');
    } catch (err: any) {
      console.error('Accept call failed:', err);
      showToast(err?.message || 'Could not answer call. Verify camera/microphone permissions.', 'error');
      await cleanupCallState();
    }
  }, [activeCall, userProfile?.uid, stopRingtone, cleanupCallState, showToast]);

  const declineCall = useCallback(async () => {
    stopRingtone();
    const callId = activeCallIdRef.current;
    if (callId) {
      await updateDoc(doc(db, 'calls', callId), {
        status: 'declined',
        endedAt: serverTimestamp(),
      }).catch(() => {});
    }
    await cleanupCallState();
  }, [stopRingtone, cleanupCallState]);

  const endCall = useCallback(async () => {
    const callId = activeCallIdRef.current;
    stopRingtone();

    if (callId && userProfile?.uid) {
      try {
        const callRef = doc(db, 'calls', callId);
        const snap = await getDoc(callRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.status !== 'ended' && data.status !== 'declined') {
            await updateDoc(callRef, {
              status: 'ended',
              endedAt: serverTimestamp(),
            });
            if (data.callerUid === userProfile.uid) {
              await sendCallStatusPush(data.calleeUid, callId, 'ended');
            }
          }

          if (data.callerUid === userProfile.uid && !historyWrittenRef.current) {
            historyWrittenRef.current = true;
            const wasAccepted = Boolean(
              data.status === 'accepted' || data.acceptedAt || connectedAtMsRef.current
            );
            const secs = connectedAtMsRef.current
              ? Math.max(0, Math.round((Date.now() - connectedAtMsRef.current) / 1000))
              : 0;
            await recordCallHistoryItem({
              callId,
              callerUid: data.callerUid,
              calleeUid: data.calleeUid,
              callType: data.type === 'video' ? 'video' : 'audio',
              callStatus: wasAccepted ? 'accepted' : 'declined',
              durationSec: wasAccepted ? secs : 0,
            }).catch(() => {});
          }
        }
      } catch (err) {
        console.warn('End call cleanup warning:', err);
      }
    }

    await cleanupCallState();
  }, [userProfile?.uid, stopRingtone, cleanupCallState]);

  const toggleMic = useCallback(async () => {
    const nextMuted = !isMicMuted;
    await agoraEngine.setMicMuted(nextMuted);
    setIsMicMuted(nextMuted);
  }, [isMicMuted]);

  const toggleCamera = useCallback(async () => {
    const nextOff = !isCameraOff;
    const track = await agoraEngine.setCameraEnabled(!nextOff);
    setLocalVideoTrack(track);
    setIsCameraOff(nextOff);
  }, [isCameraOff]);

  const flipCamera = useCallback(async () => {
    const switched = await agoraEngine.switchCamera();
    if (!switched) {
      showToast('No secondary camera detected on this device.', 'info');
    }
  }, [showToast]);

  return (
    <CallContext.Provider
      value={{
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
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCamera,
        flipCamera,
        setMinimized,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export function useCall() {
  return useContext(CallContext);
}
