/**
 * TargetManager
 * Manages 5 distinct 3D target types in spherical coordinates:
 * A. Holographic bullseye: Concentric 3D rings, glowing center, smooth rotation, energy pulses.
 * B. Floating energy sphere: Translucent outer shell, inner glowing core, rotating rings, particle halo.
 * C. Geometric target: Rotating crystalline octahedron with glowing edges.
 * D. Moving target: Smoothly glides along bounded 3D Lissajous paths with natural banking.
 * E. Bonus target: Golden plasma orb with spinning satellites, awarded higher points.
 *
 * Includes object pooling, floating 3D hit score markers, expanding shockwave rings,
 * and adaptive hit burst particles.
 */

import * as THREE from 'three';
import { GameConfig } from './GameConfig';
import { GlobalPerformanceManager } from './PerformanceManager';

export type TargetType = 'bullseye' | 'sphere' | 'geometric' | 'moving' | 'bonus';

export interface TargetItem {
  id: string;
  type: TargetType;
  position: THREE.Vector3;
  basePosition: THREE.Vector3;
  distance: number;
  azimuth: number;
  elevation: number;
  radius: number;
  points: number;
  mesh: THREE.Group;
  hitBoxMesh: THREE.Mesh;
  active: boolean;
  isHit: boolean;
  hitTime: number;
  dissolveProgress: number;
  respawnCountdown: number;
  pulseOffset: number;
  // Kinetic moving path parameters
  isMoving: boolean;
  moveSpeed: number;
  movePhase: number;
  moveAmplitude: THREE.Vector3;
  // Dynamic components
  rotatables: THREE.Object3D[];
  coreMesh: THREE.Mesh | null;
}

export interface HitPulseParticle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

export interface FloatingScoreMarker {
  group: THREE.Group;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
}

export class TargetManager {
  private targets: TargetItem[] = [];
  private scene: THREE.Scene;
  private particleGroup: THREE.Group;
  private particles: HitPulseParticle[] = [];
  private floatingScores: FloatingScoreMarker[] = [];
  private readonly maxTargetCount: number = GameConfig.gameplay.maxActiveTargets;

  // Reusable assets
  private particleGeo: THREE.BufferGeometry;
  private shockwaveGeo: THREE.BufferGeometry;

  // Current stage flags
  private currentStage: number = 1;
  private hasMovingTargets: boolean = false;
  private hasBonusTargets: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);

    this.particleGeo = new THREE.PlaneGeometry(0.08, 0.08);
    this.shockwaveGeo = new THREE.RingGeometry(0.05, 0.15, 32);

    this.initInitialTargets();
  }

  public setStage(stageNumber: number) {
    this.currentStage = stageNumber;
    const stageConfig = GameConfig.gameplay.stages.find((s) => s.stageNumber === stageNumber);
    if (stageConfig) {
      this.hasMovingTargets = stageConfig.hasMovingTargets;
      this.hasBonusTargets = stageConfig.hasBonusTargets;
    }
  }

  /**
   * Factory: Holographic Bullseye (Type A)
   */
  private createBullseyeMesh(radius: number): {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    rotatables: THREE.Object3D[];
    core: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const rotatables: THREE.Object3D[] = [];

    // Outer neon-red ring
    const outerGeo = new THREE.RingGeometry(radius * 0.90, radius, 48);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xff2a4b,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const outerRing = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerRing);

    // Mid white ring with slight Z offset for true 3D depth
    const midGeo = new THREE.RingGeometry(radius * 0.60, radius * 0.65, 36);
    const midMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const midRing = new THREE.Mesh(midGeo, midMat);
    midRing.position.z = 0.05;
    group.add(midRing);

    // Inner neon-red ring
    const innerGeo = new THREE.RingGeometry(radius * 0.35, radius * 0.40, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xff2a4b,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const innerRing = new THREE.Mesh(innerGeo, innerMat);
    innerRing.position.z = 0.1;
    group.add(innerRing);

    // Glowing 3D central sphere pip
    const coreGeo = new THREE.SphereGeometry(radius * 0.15, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.z = 0.12;
    group.add(core);

    // 4 peripheral rotating cardinal tick brackets
    const ticks = new THREE.Group();
    const tickMat = new THREE.MeshBasicMaterial({
      color: 0xff5270,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const tickGeo = new THREE.PlaneGeometry(radius * 0.035, radius * 0.22);
      const tick = new THREE.Mesh(tickGeo, tickMat);
      tick.position.set(
        Math.cos(angle) * (radius * 1.08),
        Math.sin(angle) * (radius * 1.08),
        0.02
      );
      tick.rotation.z = angle + Math.PI / 2;
      ticks.add(tick);
    }
    group.add(ticks);
    rotatables.push(ticks);

    // Raycast hit sphere
    const hitBox = this.createHitBoxMesh(radius);
    group.add(hitBox);

    return { group, hitBox, rotatables, core };
  }

  /**
   * Factory: Floating Energy Sphere (Type B)
   */
  private createEnergySphereMesh(radius: number): {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    rotatables: THREE.Object3D[];
    core: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const rotatables: THREE.Object3D[] = [];

    // Outer translucent icosahedron shell
    const shellGeo = new THREE.IcosahedronGeometry(radius * 0.85, 1);
    const shellMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    group.add(shell);
    rotatables.push(shell);

    // Inner glowing core sphere
    const coreGeo = new THREE.SphereGeometry(radius * 0.35, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.95,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Dual counter-rotating orbital rings
    const ringGeo = new THREE.TorusGeometry(radius * 0.95, radius * 0.03, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 3;
    group.add(ring1);
    rotatables.push(ring1);

    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.y = Math.PI / 3;
    group.add(ring2);
    rotatables.push(ring2);

    const hitBox = this.createHitBoxMesh(radius);
    group.add(hitBox);

    return { group, hitBox, rotatables, core };
  }

  /**
   * Factory: Geometric Target (Type C)
   */
  private createGeometricMesh(radius: number): {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    rotatables: THREE.Object3D[];
    core: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const rotatables: THREE.Object3D[] = [];

    // Rotating 3D Octahedron
    const octGeo = new THREE.OctahedronGeometry(radius * 0.8, 0);
    const octMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const octMesh = new THREE.Mesh(octGeo, octMat);

    // Glowing edges
    const edges = new THREE.EdgesGeometry(octGeo);
    const edgeLine = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0xd8b4fe, transparent: true, opacity: 0.9 })
    );
    octMesh.add(edgeLine);

    group.add(octMesh);
    rotatables.push(octMesh);

    // Floating inner crystalline diamond
    const coreGeo = new THREE.DodecahedronGeometry(radius * 0.3, 0);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const hitBox = this.createHitBoxMesh(radius);
    group.add(hitBox);

    return { group, hitBox, rotatables, core };
  }

  /**
   * Factory: Moving Drone Target (Type D)
   */
  private createMovingDroneMesh(radius: number): {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    rotatables: THREE.Object3D[];
    core: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const rotatables: THREE.Object3D[] = [];

    // Center thruster core
    const coreGeo = new THREE.CylinderGeometry(radius * 0.15, radius * 0.25, radius * 0.6, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    group.add(core);

    // Dual swept holographic wing shields
    const wingGeo = new THREE.RingGeometry(radius * 0.65, radius * 0.85, 24, 1, 0, Math.PI * 0.7);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const wingLeft = new THREE.Mesh(wingGeo, wingMat);
    wingLeft.rotation.z = Math.PI * 0.15;
    group.add(wingLeft);

    const wingRight = new THREE.Mesh(wingGeo, wingMat);
    wingRight.rotation.z = -Math.PI * 0.85;
    group.add(wingRight);

    rotatables.push(wingLeft, wingRight);

    // Front targeting reticle disc
    const frontRingGeo = new THREE.TorusGeometry(radius * 0.5, radius * 0.03, 8, 24);
    const frontRing = new THREE.Mesh(frontRingGeo, wingMat);
    frontRing.position.z = 0.2;
    group.add(frontRing);
    rotatables.push(frontRing);

    const hitBox = this.createHitBoxMesh(radius * 1.15);
    group.add(hitBox);

    return { group, hitBox, rotatables, core };
  }

  /**
   * Factory: Golden Bonus Target (Type E)
   */
  private createBonusMesh(radius: number): {
    group: THREE.Group;
    hitBox: THREE.Mesh;
    rotatables: THREE.Object3D[];
    core: THREE.Mesh;
  } {
    const group = new THREE.Group();
    const rotatables: THREE.Object3D[] = [];

    // Brilliant golden core sphere
    const coreGeo = new THREE.SphereGeometry(radius * 0.45, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24, // Bright amber gold
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    // Outer golden plasma cage
    const cageGeo = new THREE.IcosahedronGeometry(radius * 0.9, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    group.add(cage);
    rotatables.push(cage);

    // Orbiting satellite mini-nodes
    const satGroup = new THREE.Group();
    const satGeo = new THREE.SphereGeometry(radius * 0.12, 8, 8);
    const satMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const sat = new THREE.Mesh(satGeo, satMat);
      sat.position.set(Math.cos(angle) * (radius * 1.15), Math.sin(angle) * (radius * 1.15), 0);
      satGroup.add(sat);
    }
    group.add(satGroup);
    rotatables.push(satGroup);

    const hitBox = this.createHitBoxMesh(radius * 1.25);
    group.add(hitBox);

    return { group, hitBox, rotatables, core };
  }

  private createHitBoxMesh(radius: number): THREE.Mesh {
    const hitBoxGeo = new THREE.SphereGeometry(radius * 1.25, 12, 12);
    const hitBoxMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    return new THREE.Mesh(hitBoxGeo, hitBoxMat);
  }

  private sphericalToCartesian(azimuth: number, elevation: number, distance: number): THREE.Vector3 {
    const y = Math.sin(elevation) * distance;
    const groundDist = Math.cos(elevation) * distance;
    const x = Math.sin(azimuth) * groundDist;
    const z = -Math.cos(azimuth) * groundDist;
    return new THREE.Vector3(x, y, z);
  }

  private initInitialTargets() {
    // 6 balanced starting positions in front visual hemisphere
    const specs: Array<{
      type: TargetType;
      azimuth: number;
      elevation: number;
      dist: number;
      rad: number;
    }> = [
      { type: 'bullseye', azimuth: -0.18, elevation: 0.08, dist: 5.5, rad: 0.44 },
      { type: 'sphere', azimuth: 0.22, elevation: 0.14, dist: 6.0, rad: 0.46 },
      { type: 'geometric', azimuth: -0.45, elevation: -0.10, dist: 5.0, rad: 0.42 },
      { type: 'bullseye', azimuth: 0.50, elevation: -0.06, dist: 5.8, rad: 0.45 },
      { type: 'sphere', azimuth: 0.04, elevation: 0.25, dist: 6.8, rad: 0.50 },
      { type: 'geometric', azimuth: -0.72, elevation: 0.16, dist: 6.2, rad: 0.46 },
    ];

    specs.forEach((spec, idx) => {
      this.spawnTarget(spec.type, spec.azimuth, spec.elevation, spec.dist, spec.rad, idx);
    });
  }

  private spawnTarget(
    type: TargetType,
    azimuth: number,
    elevation: number,
    dist: number,
    rad: number,
    index: number
  ) {
    const pos = this.sphericalToCartesian(azimuth, elevation, dist);
    let meshData: {
      group: THREE.Group;
      hitBox: THREE.Mesh;
      rotatables: THREE.Object3D[];
      core: THREE.Mesh | null;
    };

    let points = GameConfig.scoring.targetPoints.bullseye;
    switch (type) {
      case 'sphere':
        meshData = this.createEnergySphereMesh(rad);
        points = GameConfig.scoring.targetPoints.sphere;
        break;
      case 'geometric':
        meshData = this.createGeometricMesh(rad);
        points = GameConfig.scoring.targetPoints.geometric;
        break;
      case 'moving':
        meshData = this.createMovingDroneMesh(rad);
        points = GameConfig.scoring.targetPoints.moving;
        break;
      case 'bonus':
        meshData = this.createBonusMesh(rad);
        points = GameConfig.scoring.targetPoints.bonus;
        break;
      default:
        meshData = this.createBullseyeMesh(rad);
        points = GameConfig.scoring.targetPoints.bullseye;
        break;
    }

    meshData.group.position.copy(pos);
    meshData.group.lookAt(0, 0, 0);
    this.scene.add(meshData.group);

    const isMoving = type === 'moving';

    const target: TargetItem = {
      id: `target-${idx_counter++}-${Date.now()}`,
      type,
      position: pos.clone(),
      basePosition: pos.clone(),
      distance: dist,
      azimuth,
      elevation,
      radius: rad,
      points,
      mesh: meshData.group,
      hitBoxMesh: meshData.hitBox,
      active: true,
      isHit: false,
      hitTime: 0,
      dissolveProgress: 0,
      respawnCountdown: 0,
      pulseOffset: index * 1.1,
      isMoving,
      moveSpeed: 0.8 + Math.random() * 0.4,
      movePhase: Math.random() * Math.PI * 2,
      moveAmplitude: new THREE.Vector3(0.9, 0.4, 0.5),
      rotatables: meshData.rotatables,
      coreMesh: meshData.core,
    };

    this.targets.push(target);
  }

  /**
   * Update all targets, floating text, and hit particles every frame.
   */
  public update(delta: number, elapsed: number) {
    this.targets.forEach((target) => {
      // Handle respawn timer
      if (!target.active && target.respawnCountdown > 0) {
        target.respawnCountdown -= delta;
        if (target.respawnCountdown <= 0) {
          this.respawnTarget(target);
        }
        return;
      }

      if (!target.active) return;

      if (target.isHit) {
        // Disintegration animation (250ms)
        target.dissolveProgress += delta * 4.0;
        const p = Math.min(1, target.dissolveProgress);

        const scale = 1 + p * 0.9;
        target.mesh.scale.set(scale, scale, scale);

        const fadeOpacity = Math.max(0, 1 - p);
        target.mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.Material;
            if ('opacity' in mat) {
              (mat as THREE.MeshBasicMaterial).opacity = fadeOpacity;
            }
          }
        });

        if (p >= 1) {
          target.active = false;
          target.mesh.visible = false;
          target.respawnCountdown = 1.2 + Math.random() * 0.8;
        }
      } else {
        // Active floating animation
        const t = elapsed * 1.5 + target.pulseOffset;

        if (target.isMoving) {
          // Smooth bounded Lissajous path in spherical space (never teleports)
          const mt = elapsed * target.moveSpeed + target.movePhase;
          const deltaAzimuth = Math.sin(mt) * 0.22;
          const deltaElevation = Math.cos(mt * 1.3) * 0.08;

          const currentAzimuth = target.azimuth + deltaAzimuth;
          const currentElevation = target.elevation + deltaElevation;
          const newPos = this.sphericalToCartesian(currentAzimuth, currentElevation, target.distance);

          target.mesh.position.copy(newPos);
          target.mesh.lookAt(0, 0, 0);

          // Bank into turn
          target.mesh.rotation.z = Math.cos(mt) * 0.25;
        } else {
          // Calm hover
          const bob = Math.sin(t) * 0.04;
          target.mesh.position.y = target.basePosition.y + bob;

          const breathe = 1 + Math.sin(t * 1.2) * 0.03;
          target.mesh.scale.set(breathe, breathe, breathe);
        }

        // Rotate decorative components
        target.rotatables.forEach((r, idx) => {
          const dir = idx % 2 === 0 ? 1 : -1;
          r.rotation.z += delta * (0.6 * dir);
        });

        target.mesh.updateMatrixWorld(true);
      }
    });

    // Update active hit particles and floating score labels
    this.updateParticles(delta);
    this.updateFloatingScores(delta);
  }

  /**
   * Spawn glowing particles & expanding shockwave ring on hit.
   */
  private spawnHitEffects(position: THREE.Vector3, type: TargetType, pointsAwarded: number) {
    const particleLimit = GlobalPerformanceManager.getParticleLimit();

    // Determine target color theme
    let colorHex = 0xff2a4b;
    if (type === 'sphere') colorHex = 0x00f0ff;
    if (type === 'geometric') colorHex = 0xa855f7;
    if (type === 'moving') colorHex = 0x10b981;
    if (type === 'bonus') colorHex = 0xfbbf24;

    const particleMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // 1. Particle burst
    for (let i = 0; i < particleLimit; i++) {
      const angle = (i / particleLimit) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 1.8 + Math.random() * 2.2;
      const mesh = new THREE.Mesh(this.particleGeo, particleMat.clone());
      mesh.position.copy(position);

      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 1.5
      );

      this.particleGroup.add(mesh);
      this.particles.push({
        position: mesh.position,
        velocity,
        mesh,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.2,
      });
    }

    // 2. Expanding shockwave ring
    const shockMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const shockMesh = new THREE.Mesh(this.shockwaveGeo, shockMat);
    shockMesh.position.copy(position);
    shockMesh.lookAt(0, 0, 0);
    this.particleGroup.add(shockMesh);

    this.particles.push({
      position: shockMesh.position,
      velocity: new THREE.Vector3(0, 0, 0),
      mesh: shockMesh,
      life: 0,
      maxLife: 0.28,
    });

    // 3. Floating 3D score indicator (+100, +300 BONUS!)
    this.spawnFloatingScore(position, pointsAwarded, type === 'bonus');
  }

  private spawnFloatingScore(position: THREE.Vector3, points: number, isBonus: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = isBonus ? 'bold 36px monospace' : 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isBonus ? '#fbbf24' : '#ffffff';
    ctx.shadowColor = isBonus ? '#f59e0b' : '#ff2a4b';
    ctx.shadowBlur = 8;
    const text = isBonus ? `+${points} BONUS!` : `+${points}`;
    ctx.fillText(text, 128, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 1,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(1.2, 0.45, 1);
    sprite.position.copy(position).add(new THREE.Vector3(0, 0.4, 0));

    const group = new THREE.Group();
    group.add(sprite);
    this.particleGroup.add(group);

    this.floatingScores.push({
      group,
      life: 0,
      maxLife: 0.75,
      velocity: new THREE.Vector3(0, 0.6, 0),
    });
  }

  private updateFloatingScores(delta: number) {
    for (let i = this.floatingScores.length - 1; i >= 0; i--) {
      const fs = this.floatingScores[i];
      fs.life += delta;
      if (fs.life >= fs.maxLife) {
        this.particleGroup.remove(fs.group);
        fs.group.traverse((c) => {
          if (c instanceof THREE.Sprite) {
            c.material.map?.dispose();
            c.material.dispose();
          }
        });
        this.floatingScores.splice(i, 1);
      } else {
        fs.group.position.addScaledVector(fs.velocity, delta);
        const progress = fs.life / fs.maxLife;
        fs.group.traverse((c) => {
          if (c instanceof THREE.Sprite) {
            c.material.opacity = Math.max(0, 1 - progress);
          }
        });
      }
    }
  }

  private updateParticles(delta: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      } else {
        p.mesh.position.addScaledVector(p.velocity, delta);
        const progress = p.life / p.maxLife;

        if (p.mesh.geometry === this.shockwaveGeo) {
          const s = 1 + progress * 4.5;
          p.mesh.scale.set(s, s, s);
        } else {
          const s = 1 - progress * 0.35;
          p.mesh.scale.set(s, s, s);
        }

        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = Math.max(0, 1 - progress);
      }
    }
  }

  /**
   * Respawn target dynamically using stage difficulty parameters.
   */
  private respawnTarget(target: TargetItem) {
    // Determine new target type based on stage rules
    let newType: TargetType = 'bullseye';
    const rand = Math.random();

    if (this.hasBonusTargets && rand < 0.15) {
      newType = 'bonus';
    } else if (this.hasMovingTargets && rand < 0.45) {
      newType = 'moving';
    } else if (rand < 0.65) {
      newType = 'geometric';
    } else if (rand < 0.85) {
      newType = 'sphere';
    } else {
      newType = 'bullseye';
    }

    // New randomized azimuth and elevation in front visual field
    const azimuth = (Math.random() - 0.5) * 2.6; // ~-75° to +75°
    const elevation = (Math.random() - 0.5) * 0.6; // ~-18° to +18°
    const dist = 4.8 + Math.random() * 3.2; // 4.8m to 8.0m
    const rad = 0.42 + Math.random() * 0.1;

    // Clean up old mesh from scene
    this.scene.remove(target.mesh);
    this.disposeMeshGroup(target.mesh);

    // Create new mesh
    let meshData: {
      group: THREE.Group;
      hitBox: THREE.Mesh;
      rotatables: THREE.Object3D[];
      core: THREE.Mesh | null;
    };
    let points = GameConfig.scoring.targetPoints.bullseye;

    switch (newType) {
      case 'sphere':
        meshData = this.createEnergySphereMesh(rad);
        points = GameConfig.scoring.targetPoints.sphere;
        break;
      case 'geometric':
        meshData = this.createGeometricMesh(rad);
        points = GameConfig.scoring.targetPoints.geometric;
        break;
      case 'moving':
        meshData = this.createMovingDroneMesh(rad);
        points = GameConfig.scoring.targetPoints.moving;
        break;
      case 'bonus':
        meshData = this.createBonusMesh(rad);
        points = GameConfig.scoring.targetPoints.bonus;
        break;
      default:
        meshData = this.createBullseyeMesh(rad);
        points = GameConfig.scoring.targetPoints.bullseye;
        break;
    }

    const newPos = this.sphericalToCartesian(azimuth, elevation, dist);
    meshData.group.position.copy(newPos);
    meshData.group.lookAt(0, 0, 0);
    this.scene.add(meshData.group);

    target.type = newType;
    target.position.copy(newPos);
    target.basePosition.copy(newPos);
    target.distance = dist;
    target.azimuth = azimuth;
    target.elevation = elevation;
    target.radius = rad;
    target.points = points;
    target.mesh = meshData.group;
    target.hitBoxMesh = meshData.hitBox;
    target.rotatables = meshData.rotatables;
    target.coreMesh = meshData.core;
    target.isMoving = newType === 'moving';
    target.isHit = false;
    target.dissolveProgress = 0;
    target.active = true;
    target.mesh.visible = true;
  }

  public registerHit(targetId: string): { success: boolean; points: number; isBonus: boolean } {
    const target = this.targets.find((t) => t.id === targetId && t.active && !t.isHit);
    if (!target) return { success: false, points: 0, isBonus: false };

    target.isHit = true;
    target.hitTime = performance.now();
    target.dissolveProgress = 0;

    const points = target.points;
    const isBonus = target.type === 'bonus';

    this.spawnHitEffects(target.mesh.position, target.type, points);
    return { success: true, points, isBonus };
  }

  public getActiveTargets(): TargetItem[] {
    return this.targets.filter((t) => t.active && !t.isHit);
  }

  private disposeMeshGroup(group: THREE.Group) {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }

  public dispose() {
    this.targets.forEach((target) => {
      this.scene.remove(target.mesh);
      this.disposeMeshGroup(target.mesh);
    });
    this.targets = [];

    this.particles.forEach((p) => {
      this.particleGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    });
    this.particles = [];

    this.floatingScores.forEach((fs) => {
      this.particleGroup.remove(fs.group);
      fs.group.traverse((c) => {
        if (c instanceof THREE.Sprite) {
          c.material.map?.dispose();
          c.material.dispose();
        }
      });
    });
    this.floatingScores = [];

    this.scene.remove(this.particleGroup);
    this.particleGeo.dispose();
    this.shockwaveGeo.dispose();
  }
}

let idx_counter = 0;
