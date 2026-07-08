import { RemoteParticipant, RemoteTrack, RemoteTrackPublication, Room, RoomEvent, Track } from 'livekit-client';
import { normalizeError } from './lib/errors';
import { connectToLiveKit } from './lib/livekit';
import {
  createIdentity,
  getInitialRoomName,
  getRequiredElement,
  getTokenEndpoint,
  setError,
  setStatus
} from './ui';

type GuestElements = {
  roomInput: HTMLInputElement;
  identityInput: HTMLInputElement;
  connectButton: HTMLButtonElement;
  reconnectButton: HTMLButtonElement;
  disconnectButton: HTMLButtonElement;
  enableSoundButton: HTMLButtonElement;
  remoteVideo: HTMLVideoElement;
  connectionStatus: HTMLElement;
  subscriptionStatus: HTMLElement;
  videoTrackStatus: HTMLElement;
  audioTrackStatus: HTMLElement;
  hostStatus: HTMLElement;
  firstFrameStatus: HTMLElement;
  errorStatus: HTMLElement;
};

export function mountGuest(root: HTMLElement): void {
  root.innerHTML = `
    <div class="layout">
      <section class="panel stack">
        <h2>Remote media</h2>
        <div class="field-grid">
          <label>
            <span class="label">Room</span>
            <input id="room-input" type="text" autocomplete="off" />
          </label>
          <label>
            <span class="label">Identity</span>
            <input id="identity-input" type="text" autocomplete="off" />
          </label>
        </div>
        <video id="remote-video" controls autoplay playsinline></video>
        <div class="inline">
          <button id="connect-button" class="primary" type="button">Connect</button>
          <button id="reconnect-button" type="button">Reconnect</button>
          <button id="disconnect-button" type="button">Disconnect</button>
          <button id="enable-sound-button" type="button">Enable sound</button>
        </div>
      </section>

      <aside class="panel stack">
        <h2>Guest state</h2>
        <div class="status-list">
          <div class="status-row"><strong>LiveKit</strong><span id="connection-status" class="status-value">Disconnected</span></div>
          <div class="status-row"><strong>Subscription</strong><span id="subscription-status" class="status-value">No tracks</span></div>
          <div class="status-row"><strong>Video track</strong><span id="video-track-status" class="status-value">Missing</span></div>
          <div class="status-row"><strong>Audio track</strong><span id="audio-track-status" class="status-value">Missing</span></div>
          <div class="status-row"><strong>Host</strong><span id="host-status" class="status-value">Unknown</span></div>
          <div class="status-row"><strong>First frame</strong><span id="first-frame-status" class="status-value">Not received</span></div>
        </div>
        <div>
          <div class="label">Error</div>
          <div id="error-status" class="error-box">No error</div>
        </div>
      </aside>
    </div>
  `;

  const elements = getGuestElements(root);
  const controller = new GuestController(elements);
  controller.mount();
}

class GuestController {
  private room: Room | null = null;
  private subscribedTracks = new Set<RemoteTrack>();
  private connectStartedAt = 0;
  private firstFrameReceived = false;

  constructor(private readonly elements: GuestElements) {}

  mount(): void {
    this.elements.roomInput.value = getInitialRoomName();
    this.elements.identityInput.value = createIdentity('guest');
    this.elements.enableSoundButton.disabled = true;
    this.bindEvents();
    this.updateButtons();
  }

  private bindEvents(): void {
    this.elements.connectButton.addEventListener('click', () => void this.connect());
    this.elements.reconnectButton.addEventListener('click', () => void this.reconnect());
    this.elements.disconnectButton.addEventListener('click', () => this.disconnect());
    this.elements.enableSoundButton.addEventListener('click', () => void this.playRemoteMedia({ userGesture: true }));

    this.elements.remoteVideo.addEventListener('loadeddata', () => {
      if (!this.firstFrameReceived) {
        this.firstFrameReceived = true;
        const elapsed = Math.round(performance.now() - this.connectStartedAt);
        setStatus(this.elements.firstFrameStatus, `${elapsed} ms after Connect`, 'ok');
      }
    });

    window.addEventListener('pagehide', () => this.cleanup());
  }

  private async connect(): Promise<void> {
    this.clearError();
    this.disconnect();
    this.connectStartedAt = performance.now();
    this.firstFrameReceived = false;

    try {
      setStatus(this.elements.connectionStatus, 'Connecting...', 'warn');
      const connection = await connectToLiveKit({
        tokenEndpoint: getTokenEndpoint(),
        roomName: this.roomName(),
        identity: this.identity(),
        role: 'guest'
      });

      this.room = connection.room;
      this.bindRoomEvents(connection.room);
      setStatus(this.elements.connectionStatus, `Connected as ${connection.tokenResponse.identity}`, 'ok');
      this.attachExistingTracks(connection.room);
    } catch (error) {
      this.showErrorFromUnknown(error, 'Unable to connect guest to LiveKit.');
      setStatus(this.elements.connectionStatus, 'Connection failed', 'error');
    } finally {
      this.updateButtons();
    }
  }

  private async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }

  private disconnect(): void {
    this.detachAllTracks();

    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }

    setStatus(this.elements.connectionStatus, 'Disconnected', 'idle');
    setStatus(this.elements.subscriptionStatus, 'No tracks', 'idle');
    setStatus(this.elements.videoTrackStatus, 'Missing', 'idle');
    setStatus(this.elements.audioTrackStatus, 'Missing', 'idle');
    setStatus(this.elements.hostStatus, 'Unknown', 'idle');
    setStatus(this.elements.firstFrameStatus, 'Not received', 'idle');
    this.updateButtons();
  }

  private bindRoomEvents(room: Room): void {
    room
      .on(RoomEvent.ConnectionStateChanged, (state) => {
        setStatus(this.elements.connectionStatus, `LiveKit ${String(state)}`, state === 'connected' ? 'ok' : 'warn');
      })
      .on(RoomEvent.Reconnecting, () => setStatus(this.elements.connectionStatus, 'Reconnecting...', 'warn'))
      .on(RoomEvent.Reconnected, () => setStatus(this.elements.connectionStatus, 'Reconnected', 'ok'))
      .on(RoomEvent.Disconnected, () => setStatus(this.elements.connectionStatus, 'Disconnected', 'warn'))
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        this.attachTrack(track, publication, participant);
      })
      .on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        this.detachTrack(track);
        setStatus(this.elements.hostStatus, `Track lost from ${participant.identity}: ${publication.trackName}`, 'warn');
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        setStatus(this.elements.hostStatus, `${participant.identity} connected`, 'ok');
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        setStatus(this.elements.hostStatus, `${participant.identity} disconnected`, 'warn');
      });
  }

  private attachExistingTracks(room: Room): void {
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        if (publication.track) {
          this.attachTrack(publication.track, publication, participant);
        }
      }
    }
  }

  private attachTrack(track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant): void {
    this.subscribedTracks.add(track);
    setStatus(this.elements.subscriptionStatus, `${this.subscribedTracks.size} subscribed track(s)`, 'ok');
    setStatus(this.elements.hostStatus, `Receiving from ${participant.identity}`, 'ok');

    if (track.kind === Track.Kind.Video) {
      track.attach(this.elements.remoteVideo);
      setStatus(this.elements.videoTrackStatus, `${publication.trackName || 'video'} subscribed`, 'ok');
      void this.playRemoteMedia();
      return;
    }

    if (track.kind === Track.Kind.Audio) {
      track.attach(this.elements.remoteVideo);
      setStatus(this.elements.audioTrackStatus, `${publication.trackName || 'audio'} subscribed`, 'ok');
      void this.playRemoteMedia({ markAudioPlaying: true });
    }
  }

  private detachTrack(track: RemoteTrack): void {
    track.detach(this.elements.remoteVideo);
    this.subscribedTracks.delete(track);

    if (track.kind === Track.Kind.Video) {
      setStatus(this.elements.videoTrackStatus, 'Missing', 'warn');
    }

    if (track.kind === Track.Kind.Audio) {
      setStatus(this.elements.audioTrackStatus, 'Missing', 'warn');
    }

    if (this.subscribedTracks.size === 0) {
      this.elements.remoteVideo.removeAttribute('src');
      this.elements.remoteVideo.srcObject = null;
    }

    setStatus(
      this.elements.subscriptionStatus,
      this.subscribedTracks.size > 0 ? `${this.subscribedTracks.size} subscribed track(s)` : 'No tracks',
      this.subscribedTracks.size > 0 ? 'ok' : 'warn'
    );
  }

  private detachAllTracks(): void {
    for (const track of this.subscribedTracks) {
      track.detach(this.elements.remoteVideo);
    }

    this.subscribedTracks.clear();
    this.elements.remoteVideo.removeAttribute('src');
    this.elements.remoteVideo.srcObject = null;
    this.elements.enableSoundButton.disabled = true;
  }

  private async playRemoteMedia(options: { userGesture?: boolean; markAudioPlaying?: boolean } = {}): Promise<void> {
    try {
      if (options.userGesture) {
        this.elements.remoteVideo.muted = false;
      }

      await this.elements.remoteVideo.play();
      this.elements.enableSoundButton.disabled = true;
      if (options.markAudioPlaying) {
        setStatus(this.elements.audioTrackStatus, 'Audio playing', 'ok');
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      this.elements.enableSoundButton.disabled = false;
      this.showErrorFromUnknown(error, 'Browser blocked remote audio autoplay. Press Enable sound.');
    }
  }

  private roomName(): string {
    return this.elements.roomInput.value.trim() || getInitialRoomName();
  }

  private identity(): string {
    const value = this.elements.identityInput.value.trim();
    if (value) {
      return value;
    }

    const identity = createIdentity('guest');
    this.elements.identityInput.value = identity;
    return identity;
  }

  private updateButtons(): void {
    const connected = Boolean(this.room);
    this.elements.disconnectButton.disabled = !connected;
  }

  private cleanup(): void {
    this.disconnect();
  }

  private clearError(): void {
    setError(this.elements.errorStatus, null);
  }

  private showErrorFromUnknown(error: unknown, fallback: string): void {
    const normalized = normalizeError(error, fallback);
    setError(this.elements.errorStatus, `${normalized.message} (${normalized.code})`);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getGuestElements(root: HTMLElement): GuestElements {
  return {
    roomInput: getRequiredElement(root, '#room-input'),
    identityInput: getRequiredElement(root, '#identity-input'),
    connectButton: getRequiredElement(root, '#connect-button'),
    reconnectButton: getRequiredElement(root, '#reconnect-button'),
    disconnectButton: getRequiredElement(root, '#disconnect-button'),
    enableSoundButton: getRequiredElement(root, '#enable-sound-button'),
    remoteVideo: getRequiredElement(root, '#remote-video'),
    connectionStatus: getRequiredElement(root, '#connection-status'),
    subscriptionStatus: getRequiredElement(root, '#subscription-status'),
    videoTrackStatus: getRequiredElement(root, '#video-track-status'),
    audioTrackStatus: getRequiredElement(root, '#audio-track-status'),
    hostStatus: getRequiredElement(root, '#host-status'),
    firstFrameStatus: getRequiredElement(root, '#first-frame-status'),
    errorStatus: getRequiredElement(root, '#error-status')
  };
}
