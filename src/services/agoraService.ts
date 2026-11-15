import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from 'agora-rtc-sdk-ng';
import type { CallType } from '@/types';
import { getAgoraNumericUid } from '@/utils/formatters';

AgoraRTC.setLogLevel(3); // Only warnings & errors

export const TRENDIT_AGORA_APP_ID =
  import.meta.env.VITE_AGORA_APP_ID || '02fde73deba244599248162cca0c8baf';

export interface AgoraSessionCallbacks {
  onRemoteUsersChanged: (users: IAgoraRTCRemoteUser[]) => void;
  onConnectionStateChange: (state: string) => void;
  onError?: (message: string) => void;
}

class AgoraCallEngine {
  private client: IAgoraRTCClient | null = null;
  private localAudioTrack: IMicrophoneAudioTrack | null = null;
  private localVideoTrack: ICameraVideoTrack | null = null;
  private remoteUsers = new Map<string, IAgoraRTCRemoteUser>();
  private joinedChannel: string | null = null;
  private currentCameraIndex = 0;

  private async requestServerToken(channel: string, uid: number): Promise<{ token: string | null; appId: string }> {
    const endpoints = ['/.netlify/functions/agora-token', '/api/agora-token'];
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName: channel, uid }),
        });
        if (res.ok) {
          const data = await res.json();
          const token =
            typeof data?.token === 'string' && data.token && data.token !== data.appId
              ? data.token
              : null;
          return {
            token,
            appId: data?.appId || TRENDIT_AGORA_APP_ID,
          };
        }
      } catch {
        // Try next endpoint
      }
    }
    return { token: null, appId: TRENDIT_AGORA_APP_ID };
  }

  async joinChannel(
    channel: string,
    firebaseUid: string,
    callType: CallType,
    callbacks: AgoraSessionCallbacks
  ): Promise<{
    localAudioTrack: IMicrophoneAudioTrack | null;
    localVideoTrack: ICameraVideoTrack | null;
  }> {
    await this.leaveChannel();

    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    this.client = client;
    this.remoteUsers.clear();

    const emitRemotes = () => {
      callbacks.onRemoteUsersChanged(Array.from(this.remoteUsers.values()));
    };

    client.on('user-published', async (user, mediaType) => {
      try {
        await client.subscribe(user, mediaType);
        this.remoteUsers.set(String(user.uid), user);
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
        emitRemotes();
      } catch (err) {
        console.error('Agora subscribe error:', err);
        callbacks.onError?.('Could not receive remote audio/video stream.');
      }
    });

    client.on('user-unpublished', (user) => {
      this.remoteUsers.set(String(user.uid), user);
      emitRemotes();
    });

    client.on('user-left', (user) => {
      this.remoteUsers.delete(String(user.uid));
      emitRemotes();
    });

    client.on('connection-state-change', (curState) => {
      callbacks.onConnectionStateChange(curState);
    });

    const numericUid = getAgoraNumericUid(firebaseUid);
    const { token, appId } = await this.requestServerToken(channel, numericUid);

    await client.join(appId, channel, token, numericUid);
    this.joinedChannel = channel;

    this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    if (callType === 'video') {
      this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
    } else {
      this.localVideoTrack = null;
    }

    const tracksToPublish: (IMicrophoneAudioTrack | ICameraVideoTrack)[] = [this.localAudioTrack];
    if (this.localVideoTrack) {
      tracksToPublish.push(this.localVideoTrack);
    }

    await client.publish(tracksToPublish);

    return {
      localAudioTrack: this.localAudioTrack,
      localVideoTrack: this.localVideoTrack,
    };
  }

  getLocalVideoTrack(): ICameraVideoTrack | null {
    return this.localVideoTrack;
  }

  async setMicMuted(muted: boolean): Promise<void> {
    if (this.localAudioTrack) {
      await this.localAudioTrack.setMuted(muted);
    }
  }

  async setCameraEnabled(enabled: boolean): Promise<ICameraVideoTrack | null> {
    if (!this.client) return null;

    if (enabled) {
      if (!this.localVideoTrack) {
        this.localVideoTrack = await AgoraRTC.createCameraVideoTrack();
        await this.client.publish([this.localVideoTrack]);
      } else {
        await this.localVideoTrack.setMuted(false);
      }
      return this.localVideoTrack;
    } else {
      if (this.localVideoTrack) {
        await this.localVideoTrack.setMuted(true);
      }
      return this.localVideoTrack;
    }
  }

  async switchCamera(): Promise<boolean> {
    if (!this.localVideoTrack) return false;
    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length < 2) return false;
      this.currentCameraIndex = (this.currentCameraIndex + 1) % cameras.length;
      await this.localVideoTrack.setDevice(cameras[this.currentCameraIndex].deviceId);
      return true;
    } catch (err) {
      console.warn('Camera switch failed:', err);
      return false;
    }
  }

  async leaveChannel(): Promise<void> {
    const tracks = [this.localAudioTrack, this.localVideoTrack].filter(Boolean);
    for (const track of tracks) {
      try {
        track?.stop();
      } catch {}
      try {
        track?.close();
      } catch {}
    }

    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.remoteUsers.clear();

    if (this.client && this.joinedChannel) {
      try {
        await this.client.leave();
      } catch (err) {
        console.warn('Agora leave warning:', err);
      }
    }

    if (this.client) {
      this.client.removeAllListeners();
      this.client = null;
    }
    this.joinedChannel = null;
  }
}

export const agoraEngine = new AgoraCallEngine();
