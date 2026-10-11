/**
 * SceneManager
 * Coordinates Three.js scene creation, directional and ambient lighting,
 * and holographic aesthetics.
 */

import * as THREE from 'three';

export class SceneManager {
  public readonly scene: THREE.Scene;
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private pointLight: THREE.PointLight;

  constructor() {
    this.scene = new THREE.Scene();

    // 1. Ambient Light: Balanced for holographic glow against transparent camera feed
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(this.ambientLight);

    // 2. Main Directional Light for 3D specular depth
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    this.dirLight.position.set(0, 6, 6);
    this.scene.add(this.dirLight);

    // 3. Subtle Cyan/Rose Rim Light
    this.pointLight = new THREE.PointLight(0x38bdf8, 1.2, 20);
    this.pointLight.position.set(0, -2, -3);
    this.scene.add(this.pointLight);
  }

  public dispose() {
    this.scene.clear();
  }
}
