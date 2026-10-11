/**
 * VRViewRenderer
 * Manages Three.js WebGLRenderer, Perspective Cameras (Center, Left Eye, Right Eye),
 * stereoscopic eye separation (IPD parallax), scissor viewports,
 * and context restoration.
 */

import * as THREE from 'three';

export interface VRRendererConfig {
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  isVRMode: boolean;
  eyeSeparation: number; // Virtual IPD in meters (default: 0.064m / 64mm)
}

export class VRViewRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private isVRMode: boolean;
  private eyeSeparation: number;

  // Cameras
  public centerCamera: THREE.PerspectiveCamera;
  public leftCamera: THREE.PerspectiveCamera;
  public rightCamera: THREE.PerspectiveCamera;

  private width: number = 0;
  private height: number = 0;
  private isContextLost: boolean = false;

  private boundContextLost: (e: Event) => void;
  private boundContextRestored: () => void;
  public readonly dividerWidth: number = 3;

  constructor(config: VRRendererConfig) {
    this.container = config.container;
    this.canvas = config.canvas;
    this.isVRMode = config.isVRMode;
    this.eyeSeparation = config.eyeSeparation || 0.064;

    this.boundContextLost = (e: Event) => {
      e.preventDefault();
      this.isContextLost = true;
    };

    this.boundContextRestored = () => {
      this.isContextLost = false;
      this.renderer.setClearColor(0x000000, 0);
      this.resize();
    };

    // Initialize transparent WebGL renderer so camera feed shines through
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: false,
    });

    this.renderer.setClearColor(0x000000, 0); // 100% transparent background
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // Create cameras (75 deg vertical FOV suitable for mobile VR)
    const fov = 75;
    const near = 0.1;
    const far = 100;

    this.centerCamera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.leftCamera = new THREE.PerspectiveCamera(fov, 1, near, far);
    this.rightCamera = new THREE.PerspectiveCamera(fov, 1, near, far);

    // Initial position
    this.centerCamera.position.set(0, 0, 0);
    this.leftCamera.position.set(-this.eyeSeparation / 2, 0, 0);
    this.rightCamera.position.set(this.eyeSeparation / 2, 0, 0);

    this.setupContextListeners();
    this.resize();
  }

  private setupContextListeners() {
    this.canvas.addEventListener('webglcontextlost', this.boundContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.boundContextRestored);
  }

  public setVRMode(isVR: boolean) {
    this.isVRMode = isVR;
    this.resize();
  }

  public getVRMode(): boolean {
    return this.isVRMode;
  }

  public resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 100);
    this.height = Math.max(rect.height, 100);

    this.renderer.setSize(this.width, this.height, false);

    if (this.isVRMode) {
      // Dual-eye split: Each eye gets half the canvas width minus divider half
      const eyeWidth = Math.floor((this.width - this.dividerWidth) / 2);
      const aspect = eyeWidth / this.height;

      this.leftCamera.aspect = aspect;
      this.leftCamera.updateProjectionMatrix();

      this.rightCamera.aspect = aspect;
      this.rightCamera.updateProjectionMatrix();
    } else {
      // Normal single viewport
      const aspect = this.width / this.height;
      this.centerCamera.aspect = aspect;
      this.centerCamera.updateProjectionMatrix();
    }
  }

  /**
   * Synchronize eye camera positions & rotations with central camera orientation.
   */
  public syncCameras() {
    const q = this.centerCamera.quaternion;

    // Apply orientation quaternion to both eyes
    this.leftCamera.quaternion.copy(q);
    this.rightCamera.quaternion.copy(q);

    // Offset eye positions relative to heading
    const eyeOffset = new THREE.Vector3(this.eyeSeparation / 2, 0, 0).applyQuaternion(q);

    this.leftCamera.position.copy(this.centerCamera.position).sub(eyeOffset);
    this.rightCamera.position.copy(this.centerCamera.position).add(eyeOffset);
  }

  /**
   * Render scene to canvas.
   */
  public render(scene: THREE.Scene) {
    if (this.isContextLost) return;

    this.syncCameras();

    if (this.isVRMode) {
      const eyeWidth = Math.floor((this.width - this.dividerWidth) / 2);
      const rightStartX = this.width - eyeWidth;

      this.renderer.setScissorTest(true);

      // Left Eye
      this.renderer.setScissor(0, 0, eyeWidth, this.height);
      this.renderer.setViewport(0, 0, eyeWidth, this.height);
      this.renderer.render(scene, this.leftCamera);

      // Right Eye
      this.renderer.setScissor(rightStartX, 0, eyeWidth, this.height);
      this.renderer.setViewport(rightStartX, 0, eyeWidth, this.height);
      this.renderer.render(scene, this.rightCamera);

      this.renderer.setScissorTest(false);
    } else {
      // Normal single viewport
      this.renderer.setScissorTest(false);
      this.renderer.setViewport(0, 0, this.width, this.height);
      this.renderer.render(scene, this.centerCamera);
    }
  }

  public getActiveAimCamera(): THREE.PerspectiveCamera {
    return this.centerCamera;
  }

  public dispose() {
    this.canvas.removeEventListener('webglcontextlost', this.boundContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.boundContextRestored);
    this.renderer.dispose();
  }
}
