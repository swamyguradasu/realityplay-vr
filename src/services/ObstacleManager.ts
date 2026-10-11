/**
 * ObstacleManager
 * Manages virtual 3D obstacles within the Three.js scene.
 * Features:
 * - Rotating holographic panels with glowing borders
 * - Moving energy gates (oscillating portal barriers)
 * - Floating crystalline shield prisms
 * - Transparent force-field rings
 * - Raycastable collision meshes to block target aiming
 * - Gradual stage progression: inactive in Stage 1 & 2, active in Stages 3 & 4.
 */

import * as THREE from 'three';

export type ObstacleType = 'panel' | 'gate' | 'prism' | 'ring';

export interface ObstacleItem {
  id: string;
  name: string;
  type: ObstacleType;
  mesh: THREE.Group;
  colliderMesh: THREE.Mesh;
  basePosition: THREE.Vector3;
  motionSpeed: number;
  motionAmplitude: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  phaseOffset: number;
  active: boolean;
}

export class ObstacleManager {
  private scene: THREE.Scene;
  private obstacles: ObstacleItem[] = [];
  private group: THREE.Group;
  private sharedGeometries: { [key: string]: THREE.BufferGeometry } = {};
  private sharedMaterials: { [key: string]: THREE.Material } = {};

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.initSharedResources();
    this.createObstacles();
  }

  private initSharedResources() {
    // 1. Holographic panel geometry & material
    this.sharedGeometries.panel = new THREE.PlaneGeometry(1.6, 1.1);
    this.sharedMaterials.panelMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sharedMaterials.panelFrameMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });

    // 2. Gate geometry & material
    this.sharedGeometries.gateBar = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 12);
    this.sharedGeometries.gateBeam = new THREE.PlaneGeometry(1.4, 0.12);
    this.sharedMaterials.gateMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sharedMaterials.gateFrameMat = new THREE.MeshBasicMaterial({
      color: 0x7e22ce,
      transparent: true,
      opacity: 0.75,
    });

    // 3. Prism geometry & material
    this.sharedGeometries.prism = new THREE.BoxGeometry(0.9, 1.4, 0.4);
    this.sharedMaterials.prismMat = new THREE.MeshBasicMaterial({
      color: 0xec4899,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // 4. Force-field ring geometry & material
    this.sharedGeometries.ring = new THREE.TorusGeometry(1.1, 0.06, 12, 36);
    this.sharedMaterials.ringMat = new THREE.MeshBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  private createObstacles() {
    // Curated obstacle placements that occasionally cross target trajectories
    // without permanently blocking the center screen.
    const configs: Array<{
      type: ObstacleType;
      name: string;
      pos: THREE.Vector3;
      rotSpeed: THREE.Vector3;
      motionAmp: THREE.Vector3;
      motionSpeed: number;
    }> = [
      // Obstacle 0: Holographic Panel on the Left Arc
      {
        type: 'panel',
        name: 'Holo-Shield Alpha',
        pos: new THREE.Vector3(-2.2, 0.4, -4.2),
        rotSpeed: new THREE.Vector3(0, 0.25, 0.1),
        motionAmp: new THREE.Vector3(0.4, 0.3, 0.2),
        motionSpeed: 0.8,
      },
      // Obstacle 1: Moving Energy Gate on the Right Arc
      {
        type: 'gate',
        name: 'Energy Gate Beta',
        pos: new THREE.Vector3(2.4, -0.3, -4.5),
        rotSpeed: new THREE.Vector3(0, -0.2, 0),
        motionAmp: new THREE.Vector3(0.5, 0.4, 0.3),
        motionSpeed: 0.7,
      },
      // Obstacle 2: Floating Prism in Upper Center-Right
      {
        type: 'prism',
        name: 'Barrier Prism Gamma',
        pos: new THREE.Vector3(1.4, 1.5, -5.2),
        rotSpeed: new THREE.Vector3(0.3, 0.4, 0.2),
        motionAmp: new THREE.Vector3(0.3, 0.2, 0.4),
        motionSpeed: 0.9,
      },
      // Obstacle 3: Force-Field Ring in Lower Center-Left
      {
        type: 'ring',
        name: 'Force-Ring Delta',
        pos: new THREE.Vector3(-1.6, -1.2, -4.8),
        rotSpeed: new THREE.Vector3(0.2, 0.3, 0.5),
        motionAmp: new THREE.Vector3(0.4, 0.3, 0.3),
        motionSpeed: 0.75,
      },
    ];

    configs.forEach((cfg, idx) => {
      const obstacleGroup = new THREE.Group();
      let colliderMesh: THREE.Mesh;

      if (cfg.type === 'panel') {
        // Transparent surface
        const surface = new THREE.Mesh(this.sharedGeometries.panel, this.sharedMaterials.panelMat);
        obstacleGroup.add(surface);

        // Glowing wireframe border
        const edges = new THREE.EdgesGeometry(this.sharedGeometries.panel);
        const wireframe = new THREE.LineSegments(edges, this.sharedMaterials.panelFrameMat);
        obstacleGroup.add(wireframe);

        // Collider box
        const colGeo = new THREE.BoxGeometry(1.65, 1.15, 0.2);
        colliderMesh = new THREE.Mesh(
          colGeo,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        obstacleGroup.add(colliderMesh);
      } else if (cfg.type === 'gate') {
        // Vertical portal posts
        const postLeft = new THREE.Mesh(this.sharedGeometries.gateBar, this.sharedMaterials.gateFrameMat);
        postLeft.position.set(-0.7, 0, 0);
        const postRight = new THREE.Mesh(this.sharedGeometries.gateBar, this.sharedMaterials.gateFrameMat);
        postRight.position.set(0.7, 0, 0);

        // Animated laser cross-beams
        const beam1 = new THREE.Mesh(this.sharedGeometries.gateBeam, this.sharedMaterials.gateMat);
        beam1.position.set(0, 0.35, 0);
        const beam2 = new THREE.Mesh(this.sharedGeometries.gateBeam, this.sharedMaterials.gateMat);
        beam2.position.set(0, -0.35, 0);

        obstacleGroup.add(postLeft, postRight, beam1, beam2);

        // Collider box
        const colGeo = new THREE.BoxGeometry(1.6, 1.8, 0.3);
        colliderMesh = new THREE.Mesh(
          colGeo,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        obstacleGroup.add(colliderMesh);
      } else if (cfg.type === 'prism') {
        const prismMesh = new THREE.Mesh(this.sharedGeometries.prism, this.sharedMaterials.prismMat);
        const edges = new THREE.EdgesGeometry(this.sharedGeometries.prism);
        const edgeLine = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0xf472b6, transparent: true, opacity: 0.8 })
        );
        obstacleGroup.add(prismMesh, edgeLine);

        // Collider
        colliderMesh = new THREE.Mesh(
          this.sharedGeometries.prism,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        obstacleGroup.add(colliderMesh);
      } else {
        // Force-field ring
        const ringMesh = new THREE.Mesh(this.sharedGeometries.ring, this.sharedMaterials.ringMat);
        obstacleGroup.add(ringMesh);

        // Inner translucent disc
        const discGeo = new THREE.CircleGeometry(1.05, 24);
        const disc = new THREE.Mesh(
          discGeo,
          new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        obstacleGroup.add(disc);

        // Collider cylinder
        const colGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.3, 16);
        colliderMesh = new THREE.Mesh(
          colGeo,
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        colliderMesh.rotation.x = Math.PI / 2;
        obstacleGroup.add(colliderMesh);
      }

      obstacleGroup.position.copy(cfg.pos);
      obstacleGroup.visible = false; // initially inactive until stage enables it
      this.group.add(obstacleGroup);

      this.obstacles.push({
        id: `obs-${idx}`,
        name: cfg.name,
        type: cfg.type,
        mesh: obstacleGroup,
        colliderMesh,
        basePosition: cfg.pos.clone(),
        motionSpeed: cfg.motionSpeed,
        motionAmplitude: cfg.motionAmp,
        rotationSpeed: cfg.rotSpeed,
        phaseOffset: idx * 1.5,
        active: false,
      });
    });
  }

  /**
   * Update active obstacles based on game stage.
   * Stage 1 & 2: 0 obstacles.
   * Stage 3: 2 obstacles.
   * Stage 4: 4 obstacles.
   */
  public setStage(stageNumber: number) {
    let activeCount = 0;
    if (stageNumber >= 4) {
      activeCount = 4;
    } else if (stageNumber === 3) {
      activeCount = 2;
    }

    this.obstacles.forEach((obs, idx) => {
      obs.active = idx < activeCount;
      obs.mesh.visible = obs.active;
    });
  }

  /**
   * Animate obstacles every frame.
   */
  public update(delta: number, elapsed: number) {
    this.obstacles.forEach((obs) => {
      if (!obs.active) return;

      const t = elapsed * obs.motionSpeed + obs.phaseOffset;

      // Smooth bounded oscillation
      obs.mesh.position.x = obs.basePosition.x + Math.sin(t) * obs.motionAmplitude.x;
      obs.mesh.position.y = obs.basePosition.y + Math.cos(t * 0.9) * obs.motionAmplitude.y;
      obs.mesh.position.z = obs.basePosition.z + Math.sin(t * 0.6) * obs.motionAmplitude.z;

      // Smooth rotations
      obs.mesh.rotation.x += obs.rotationSpeed.x * delta;
      obs.mesh.rotation.y += obs.rotationSpeed.y * delta;
      obs.mesh.rotation.z += obs.rotationSpeed.z * delta;

      obs.mesh.updateMatrixWorld(true);
    });
  }

  /**
   * Return raycastable collider meshes of all currently active obstacles.
   */
  public getColliders(): THREE.Mesh[] {
    return this.obstacles.filter((o) => o.active).map((o) => o.colliderMesh);
  }

  public getObstacleByCollider(colliderMesh: THREE.Object3D): ObstacleItem | undefined {
    return this.obstacles.find((o) => o.colliderMesh === colliderMesh);
  }

  public dispose() {
    this.scene.remove(this.group);
    Object.values(this.sharedGeometries).forEach((g) => g.dispose());
    Object.values(this.sharedMaterials).forEach((m) => m.dispose());
    this.obstacles = [];
  }
}
