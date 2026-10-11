/**
 * CameraManager
 * Handles browser-native camera lifecycle via navigator.mediaDevices.getUserMedia,
 * environment-facing camera preference, track cleanup, and desktop simulated passthrough mode.
 * Camera video is processed strictly locally and never recorded or transmitted.
 */

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unsupported'
  | 'error'
  | 'simulated';

export interface CameraManagerListener {
  onStatusChange?: (status: CameraStatus, errorMsg?: string) => void;
  onStreamReady?: (stream: MediaStream | null, videoElement: HTMLVideoElement | null) => void;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private status: CameraStatus = 'idle';
  private errorMessage: string = '';
  private listeners: Set<CameraManagerListener> = new Set();
  private simulatedCanvas: HTMLCanvasElement | null = null;
  private simulatedAnimId: number | null = null;

  constructor() {
    this.createVideoElement();
  }

  private createVideoElement() {
    if (typeof document === 'undefined') return;
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    // Set low-latency video attributes
    video.setAttribute('webkit-playsinline', 'true');
    video.style.position = 'fixed';
    video.style.top = '-9999px';
    video.style.left = '-9999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    document.body.appendChild(video);
    this.videoElement = video;
  }

  public subscribe(listener: CameraManagerListener): () => void {
    this.listeners.add(listener);
    // Notify immediate initial state
    listener.onStatusChange?.(this.status, this.errorMessage);
    if (this.stream) {
      listener.onStreamReady?.(this.stream, this.videoElement);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyStatus(status: CameraStatus, errorMsg = '') {
    this.status = status;
    this.errorMessage = errorMsg;
    this.listeners.forEach((l) => l.onStatusChange?.(status, errorMsg));
  }

  public getStatus(): CameraStatus {
    return this.status;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Request rear-facing camera stream after user action.
   */
  public async startCamera(): Promise<boolean> {
    if (!navigator?.mediaDevices?.getUserMedia) {
      this.notifyStatus('unsupported', 'Camera access API is not supported on this device/browser.');
      return false;
    }

    this.notifyStatus('requesting');
    this.stopSimulatedFeed();

    // Use ideal constraints to avoid OverconstrainedError across diverse mobile/desktop cameras
    const constraintsList: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let acquiredStream: MediaStream | null = null;
    let lastError: Error | unknown = null;

    for (const constraint of constraintsList) {
      try {
        acquiredStream = await navigator.mediaDevices.getUserMedia(constraint);
        if (acquiredStream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!acquiredStream) {
      const errName = (lastError as { name?: string })?.name;
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        this.notifyStatus(
          'denied',
          'Camera permission was denied. You can enable it in browser settings or play in Simulated Passthrough mode.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        this.notifyStatus('error', 'No camera detected on this system.');
      } else {
        this.notifyStatus(
          'error',
          'Unable to activate camera. Switching to simulated desktop feed option.'
        );
      }
      return false;
    }

    this.stream = acquiredStream;
    if (this.videoElement) {
      this.videoElement.srcObject = acquiredStream;
      try {
        await this.videoElement.play();
      } catch {
        // Autoplay policy or interrupted
      }
    }

    this.notifyStatus('active');
    this.listeners.forEach((l) => l.onStreamReady?.(this.stream, this.videoElement));
    return true;
  }

  /**
   * Start high-fidelity simulated camera passthrough for desktop testing
   * or when device has no camera available.
   */
  public startSimulatedFeed(): boolean {
    this.stopCameraTracks();

    if (!this.simulatedCanvas) {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      this.simulatedCanvas = canvas;
    }

    const canvas = this.simulatedCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    let frame = 0;
    const renderLoop = () => {
      frame++;
      // Render dynamic atmospheric high-tech indoor room simulator
      const w = canvas.width;
      const h = canvas.height;

      // Dark sci-fi testing hangar / room ambiance
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#090d16');
      grad.addColorStop(0.5, '#0d131f');
      grad.addColorStop(1, '#05080e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Floor perspective grid lines
      ctx.save();
      ctx.strokeStyle = 'rgba(70, 90, 120, 0.25)';
      ctx.lineWidth = 1;

      const horizon = h * 0.55;
      const vpX = w * 0.5;

      for (let x = -w * 0.8; x <= w * 1.8; x += 120) {
        ctx.beginPath();
        ctx.moveTo(vpX, horizon);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Horizontal depth rings
      for (let y = horizon + 20; y <= h; y += (y - horizon) * 0.35 + 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Room wall pillars and horizon glow
      ctx.fillStyle = 'rgba(255, 42, 75, 0.04)';
      ctx.fillRect(0, horizon - 80, w, 160);

      // Cyber optic grain
      const t = frame * 0.02;
      for (let i = 0; i < 6; i++) {
        const ox = (Math.sin(t + i) * 0.4 + 0.5) * w;
        const oy = (Math.cos(t * 0.8 + i) * 0.3 + 0.4) * h;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.arc(ox, oy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      this.simulatedAnimId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    // Capture stream from canvas
    const stream = canvas.captureStream(30);
    this.stream = stream;
    if (this.videoElement) {
      this.videoElement.srcObject = stream;
      this.videoElement.play().catch(() => {});
    }

    this.notifyStatus('simulated');
    this.listeners.forEach((l) => l.onStreamReady?.(this.stream, this.videoElement));
    return true;
  }

  private stopSimulatedFeed() {
    if (this.simulatedAnimId !== null) {
      cancelAnimationFrame(this.simulatedAnimId);
      this.simulatedAnimId = null;
    }
  }

  /**
   * Stop all camera tracks and reset stream cleanly.
   */
  public stopCameraTracks() {
    this.stopSimulatedFeed();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Track stop failed
        }
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }

  public dispose() {
    this.stopCameraTracks();
    if (this.videoElement && this.videoElement.parentNode) {
      this.videoElement.parentNode.removeChild(this.videoElement);
      this.videoElement = null;
    }
    this.listeners.clear();
    this.status = 'idle';
  }
}

export const GlobalCameraManager = new CameraManager();
