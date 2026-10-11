/**
 * OrientationManager
 * Handles DeviceOrientationEvent sensors, iOS permission gating,
 * screen orientation adjustments, smooth quaternion damping,
 * heading calibration/re-centering, and touch/mouse drag aiming fallback.
 */

import * as THREE from 'three';

export type MotionMode = 'sensor' | 'touch';

export interface OrientationState {
  mode: MotionMode;
  isPermissionGranted: boolean;
  isSensorAvailable: boolean;
  alpha: number;
  beta: number;
  gamma: number;
}

export class OrientationManager {
  private mode: MotionMode = 'touch';
  private isPermissionGranted: boolean = false;
  private isSensorAvailable: boolean = false;
  private hasReceivedFirstSensorEvent: boolean = false;

  // Raw sensor values
  private alpha: number = 0;
  private beta: number = 0;
  private gamma: number = 0;
  private screenOrientation: number = 0;

  // Smoothing & Quaternions
  private targetQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private currentQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private headingYawOffset: number = 0;
  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private readonly forwardDirection = new THREE.Vector3(0, 0, -1);

  // Touch drag fallback
  private touchYaw: number = 0;
  private touchPitch: number = 0;
  private targetTouchYaw: number = 0;
  private targetTouchPitch: number = 0;

  // Helpers
  private readonly zee = new THREE.Vector3(0, 0, 1);
  private readonly euler = new THREE.Euler();
  private readonly q0 = new THREE.Quaternion();
  private readonly q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -PI/2 on X

  private boundOnDeviceOrientation: (e: DeviceOrientationEvent) => void;
  private boundOnScreenOrientationChange: () => void;

  constructor() {
    this.boundOnDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.boundOnScreenOrientationChange = this.updateScreenOrientation.bind(this);
    this.updateScreenOrientation();
  }

  /**
   * Request permission for DeviceOrientation (required on iOS 13+).
   * Must be invoked during a user gesture (e.g. Start button).
   */
  public async requestSensorPermission(): Promise<boolean> {
    const DeviceOrientationEventAny = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    if (typeof DeviceOrientationEventAny?.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEventAny.requestPermission();
        if (response === 'granted') {
          this.isPermissionGranted = true;
          this.startSensorListeners();
          return true;
        } else {
          this.isPermissionGranted = false;
          this.mode = 'touch';
          return false;
        }
      } catch {
        this.isPermissionGranted = false;
        this.mode = 'touch';
        return false;
      }
    } else {
      // Non-iOS or older browser where permission is implicit
      this.isPermissionGranted = true;
      this.startSensorListeners();
      return true;
    }
  }

  public startSensorListeners() {
    window.addEventListener('deviceorientation', this.boundOnDeviceOrientation, true);
    window.addEventListener('orientationchange', this.boundOnScreenOrientationChange, false);
    if (window.screen?.orientation) {
      window.screen.orientation.addEventListener('change', this.boundOnScreenOrientationChange);
    }
  }

  public stopSensorListeners() {
    window.removeEventListener('deviceorientation', this.boundOnDeviceOrientation, true);
    window.removeEventListener('orientationchange', this.boundOnScreenOrientationChange, false);
    if (window.screen?.orientation) {
      window.screen.orientation.removeEventListener('change', this.boundOnScreenOrientationChange);
    }
  }

  private updateScreenOrientation() {
    if (window.screen?.orientation?.angle !== undefined) {
      this.screenOrientation = window.screen.orientation.angle;
    } else if (typeof window.orientation === 'number') {
      this.screenOrientation = window.orientation;
    } else {
      this.screenOrientation = 0;
    }
  }

  private onDeviceOrientation(event: DeviceOrientationEvent) {
    if (event.alpha === null || event.beta === null || event.gamma === null) {
      return;
    }

    // Ignore static all-zero dummy readings commonly emitted by desktop browsers without gyroscopes
    if (event.alpha === 0 && event.beta === 0 && event.gamma === 0) {
      return;
    }

    if (!this.hasReceivedFirstSensorEvent) {
      this.hasReceivedFirstSensorEvent = true;
      this.isSensorAvailable = true;
      this.mode = 'sensor';
      // First orientation calibrates forward
      setTimeout(() => this.recenterHeading(), 100);
    }

    this.alpha = event.alpha;
    this.beta = event.beta;
    this.gamma = event.gamma;

    // Convert alpha, beta, gamma to 3D orientation quaternion
    const alphaRad = THREE.MathUtils.degToRad(this.alpha);
    const betaRad = THREE.MathUtils.degToRad(this.beta);
    const gammaRad = THREE.MathUtils.degToRad(this.gamma);
    const orientRad = THREE.MathUtils.degToRad(this.screenOrientation);

    this.euler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
    this.targetQuaternion.setFromEuler(this.euler);
    this.targetQuaternion.multiply(this.q1);
    this.targetQuaternion.multiply(this.q0.setFromAxisAngle(this.zee, -orientRad));
  }

  /**
   * Calibrate heading so the current physical direction faces straight forward (Z = -1),
   * preserving the true vertical gravity axis so the horizon never tilts diagonally.
   */
  public recenterHeading() {
    if (this.mode === 'sensor' && this.hasReceivedFirstSensorEvent) {
      // Calculate current horizontal yaw angle of the sensor camera
      const fwd = new THREE.Vector3().copy(this.forwardDirection).applyQuaternion(this.targetQuaternion);
      this.headingYawOffset = Math.atan2(fwd.x, -fwd.z);
    } else {
      this.targetTouchYaw = 0;
      this.targetTouchPitch = 0;
      this.touchYaw = 0;
      this.touchPitch = 0;
    }
  }

  /**
   * Touch / mouse drag offset for aiming fallback or manual nudge.
   */
  public addTouchDelta(deltaX: number, deltaY: number) {
    const sensitivity = 0.0035;
    this.targetTouchYaw -= deltaX * sensitivity;
    this.targetTouchPitch -= deltaY * sensitivity;

    // Clamp pitch between -80 and +80 degrees
    const maxPitch = Math.PI * 0.44;
    this.targetTouchPitch = Math.max(-maxPitch, Math.min(maxPitch, this.targetTouchPitch));
  }

  /**
   * Update the Three.js camera quaternion smoothly.
   */
  public updateCamera(camera: THREE.Camera, dampingFactor: number = 0.15) {
    // Smooth touch interpolation
    this.touchYaw += (this.targetTouchYaw - this.touchYaw) * dampingFactor;
    this.touchPitch += (this.targetTouchPitch - this.touchPitch) * dampingFactor;

    if (this.mode === 'sensor' && this.hasReceivedFirstSensorEvent) {
      // Sensor active: rotate purely around world Up axis by negative heading offset
      const yawCorrectionQ = new THREE.Quaternion().setFromAxisAngle(this.worldUp, -this.headingYawOffset);
      const calibratedSensorQ = new THREE.Quaternion().copy(yawCorrectionQ).multiply(this.targetQuaternion);

      // If user also touches to nudge
      if (Math.abs(this.touchYaw) > 0.001 || Math.abs(this.touchPitch) > 0.001) {
        const touchEuler = new THREE.Euler(this.touchPitch, this.touchYaw, 0, 'YXZ');
        const touchQ = new THREE.Quaternion().setFromEuler(touchEuler);
        calibratedSensorQ.multiply(touchQ);
      }

      this.currentQuaternion.slerp(calibratedSensorQ, dampingFactor);
      camera.quaternion.copy(this.currentQuaternion);
    } else {
      // Touch-only fallback mode: smooth Euler orbit
      const touchEuler = new THREE.Euler(this.touchPitch, this.touchYaw, 0, 'YXZ');
      const touchQ = new THREE.Quaternion().setFromEuler(touchEuler);
      this.currentQuaternion.slerp(touchQ, dampingFactor);
      camera.quaternion.copy(this.currentQuaternion);
    }
  }

  public getMotionMode(): MotionMode {
    return this.mode;
  }

  public setMotionMode(mode: MotionMode) {
    this.mode = mode;
  }

  public isSensorReady(): boolean {
    return this.isSensorAvailable && this.hasReceivedFirstSensorEvent;
  }

  public getState(): OrientationState {
    return {
      mode: this.mode,
      isPermissionGranted: this.isPermissionGranted,
      isSensorAvailable: this.isSensorAvailable,
      alpha: this.alpha,
      beta: this.beta,
      gamma: this.gamma,
    };
  }

  public dispose() {
    this.stopSensorListeners();
    this.hasReceivedFirstSensorEvent = false;
  }
}

export const GlobalOrientationManager = new OrientationManager();
