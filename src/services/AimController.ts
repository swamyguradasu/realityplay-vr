/**
 * AimController
 * Performs center-screen raycasting along the virtual viewing axis,
 * checks for virtual obstacle occlusion,
 * tracks gaze dwell (700ms threshold) with progress charging,
 * enforces hit cooldowns, handles tap-to-activate hits, and coordinates audio cues.
 */

import * as THREE from 'three';
import { TargetManager, TargetItem } from './TargetManager';
import { ObstacleManager } from './ObstacleManager';
import { SoundEffects } from './SoundEffects';
import { GameConfig } from './GameConfig';

export interface AimStatus {
  isTargetLocked: boolean;
  lockedTargetId: string | null;
  targetType?: string;
  dwellProgress: number; // 0.0 to 1.0
  targetDistance: number;
  isOccluded: boolean;
  occludedByName: string | null;
}

export type HitCallback = (targetId: string, isInstantTap: boolean, points: number, isBonus: boolean) => void;

export class AimController {
  private raycaster: THREE.Raycaster;
  private camera: THREE.Camera;
  private targetManager: TargetManager;
  private obstacleManager: ObstacleManager | null = null;
  private onHitCallback: HitCallback | null = null;

  private lockedTargetId: string | null = null;
  private currentDwellTime: number = 0;
  private readonly dwellThreshold: number = GameConfig.aiming.dwellDurationSeconds;
  private lastAcquiredTargetId: string | null = null;
  private hitCooldownRemaining: number = 0;

  // Reusable vectors for zero GC allocation in render loop
  private readonly centerDirection = new THREE.Vector3(0, 0, -1);
  private readonly forwardVec = new THREE.Vector3();
  private readonly targetDirVec = new THREE.Vector3();

  constructor(camera: THREE.Camera, targetManager: TargetManager, obstacleManager?: ObstacleManager) {
    this.camera = camera;
    this.targetManager = targetManager;
    this.obstacleManager = obstacleManager || null;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = GameConfig.aiming.maxRaycastDistance;
  }

  public setObstacleManager(obstacleManager: ObstacleManager) {
    this.obstacleManager = obstacleManager;
  }

  public setOnHit(callback: HitCallback) {
    this.onHitCallback = callback;
  }

  /**
   * Called every frame in the render loop.
   */
  public update(delta: number): AimStatus {
    // Process hit cooldown
    if (this.hitCooldownRemaining > 0) {
      this.hitCooldownRemaining -= delta;
      this.resetLock();
      return {
        isTargetLocked: false,
        lockedTargetId: null,
        dwellProgress: 0,
        targetDistance: 0,
        isOccluded: false,
        occludedByName: null,
      };
    }

    const activeTargets = this.targetManager.getActiveTargets();
    if (activeTargets.length === 0) {
      this.resetLock();
      return {
        isTargetLocked: false,
        lockedTargetId: null,
        dwellProgress: 0,
        targetDistance: 0,
        isOccluded: false,
        occludedByName: null,
      };
    }

    // Set raycaster along camera forward vector
    this.forwardVec.copy(this.centerDirection).applyQuaternion(this.camera.quaternion).normalize();
    this.raycaster.set(this.camera.position, this.forwardVec);

    // 1. Raycast Obstacles first (to detect occlusion)
    let closestObstacleDist = Infinity;
    let occludingObstacleName: string | null = null;

    if (this.obstacleManager) {
      const obstacleColliders = this.obstacleManager.getColliders();
      if (obstacleColliders.length > 0) {
        const obsIntersects = this.raycaster.intersectObjects(obstacleColliders, false);
        if (obsIntersects.length > 0) {
          closestObstacleDist = obsIntersects[0].distance;
          const matched = this.obstacleManager.getObstacleByCollider(obsIntersects[0].object);
          occludingObstacleName = matched ? matched.name : 'Virtual Energy Barrier';
        }
      }
    }

    // 2. Raycast Targets
    const hitBoxes = activeTargets.map((t) => t.hitBoxMesh);
    const targetIntersects = this.raycaster.intersectObjects(hitBoxes, false);

    let focusedTarget: TargetItem | null = null;
    let targetDistance: number = 0;

    if (targetIntersects.length > 0) {
      const hitBox = targetIntersects[0].object;
      focusedTarget = activeTargets.find((t) => t.hitBoxMesh === hitBox) || null;
      if (focusedTarget) {
        targetDistance = targetIntersects[0].distance;
      }
    }

    // 3. Angular cone fallback for smooth mobile gyro aiming
    if (!focusedTarget) {
      let closestAngle = Infinity;
      for (const target of activeTargets) {
        this.targetDirVec.copy(target.mesh.position).sub(this.camera.position).normalize();
        const dot = this.forwardVec.dot(this.targetDirVec);
        const angularThreshold = Math.cos((target.radius * GameConfig.aiming.angularToleranceMultiplier) / target.distance);
        if (dot >= angularThreshold) {
          const angle = Math.acos(Math.min(1, Math.max(-1, dot)));
          if (angle < closestAngle) {
            closestAngle = angle;
            focusedTarget = target;
            targetDistance = target.distance;
          }
        }
      }
    }

    // 4. Test Obstacle Occlusion
    if (focusedTarget && closestObstacleDist < targetDistance) {
      // The obstacle is in front of the target along this line of sight!
      this.resetLock();
      return {
        isTargetLocked: false,
        lockedTargetId: focusedTarget.id,
        targetType: focusedTarget.type,
        dwellProgress: 0,
        targetDistance,
        isOccluded: true,
        occludedByName: occludingObstacleName,
      };
    }

    // 5. Process Unoccluded Target Dwell
    if (focusedTarget) {
      if (this.lockedTargetId === focusedTarget.id) {
        // Continue dwell
        this.currentDwellTime += delta;
        const progress = Math.min(1.0, this.currentDwellTime / this.dwellThreshold);

        SoundEffects.updateDwellSound(progress);

        if (this.currentDwellTime >= this.dwellThreshold) {
          // 700ms Gaze dwell fulfilled!
          const hitId = focusedTarget.id;
          this.triggerHit(hitId, false);
          return {
            isTargetLocked: false,
            lockedTargetId: null,
            dwellProgress: 0,
            targetDistance: 0,
            isOccluded: false,
            occludedByName: null,
          };
        }

        return {
          isTargetLocked: true,
          lockedTargetId: this.lockedTargetId,
          targetType: focusedTarget.type,
          dwellProgress: progress,
          targetDistance: targetDistance || focusedTarget.distance,
          isOccluded: false,
          occludedByName: null,
        };
      } else {
        // Acquired new target
        this.lockedTargetId = focusedTarget.id;
        this.currentDwellTime = 0;

        if (this.lastAcquiredTargetId !== focusedTarget.id) {
          this.lastAcquiredTargetId = focusedTarget.id;
          SoundEffects.playTargetAcquired();
        }

        return {
          isTargetLocked: true,
          lockedTargetId: this.lockedTargetId,
          targetType: focusedTarget.type,
          dwellProgress: 0,
          targetDistance: targetDistance || focusedTarget.distance,
          isOccluded: false,
          occludedByName: null,
        };
      }
    } else {
      this.resetLock();
      return {
        isTargetLocked: false,
        lockedTargetId: null,
        dwellProgress: 0,
        targetDistance: 0,
        isOccluded: false,
        occludedByName: null,
      };
    }
  }

  /**
   * Screen tap fallback: instantly hits target under reticle if unoccluded.
   */
  public handleScreenTap(): boolean {
    if (this.hitCooldownRemaining > 0) return false;

    // First check if an obstacle is currently in the way
    if (this.obstacleManager) {
      this.forwardVec.copy(this.centerDirection).applyQuaternion(this.camera.quaternion).normalize();
      this.raycaster.set(this.camera.position, this.forwardVec);

      const obstacleColliders = this.obstacleManager.getColliders();
      const obsIntersects = this.raycaster.intersectObjects(obstacleColliders, false);

      const activeTargets = this.targetManager.getActiveTargets();
      const hitBoxes = activeTargets.map((t) => t.hitBoxMesh);
      const targetIntersects = this.raycaster.intersectObjects(hitBoxes, false);

      if (obsIntersects.length > 0) {
        const obsDist = obsIntersects[0].distance;
        if (targetIntersects.length > 0 && obsDist < targetIntersects[0].distance) {
          // Blocked by obstacle!
          SoundEffects.playObstacleBlocked();
          return false;
        }
      }
    }

    let targetId = this.lockedTargetId;

    if (!targetId) {
      // Instant raycast check
      const activeTargets = this.targetManager.getActiveTargets();
      this.forwardVec.copy(this.centerDirection).applyQuaternion(this.camera.quaternion).normalize();
      this.raycaster.set(this.camera.position, this.forwardVec);

      const hitBoxes = activeTargets.map((t) => t.hitBoxMesh);
      const intersects = this.raycaster.intersectObjects(hitBoxes, false);
      if (intersects.length > 0) {
        const found = activeTargets.find((t) => t.hitBoxMesh === intersects[0].object);
        if (found) targetId = found.id;
      }
    }

    if (targetId) {
      this.triggerHit(targetId, true);
      return true;
    }
    return false;
  }

  private triggerHit(targetId: string, isInstantTap: boolean) {
    this.resetLock();
    this.hitCooldownRemaining = GameConfig.aiming.postHitCooldownSeconds;

    const result = this.targetManager.registerHit(targetId);
    if (result.success) {
      if (result.isBonus) {
        SoundEffects.playBonusHit();
      } else {
        SoundEffects.playTargetHit();
      }
      this.onHitCallback?.(targetId, isInstantTap, result.points, result.isBonus);
    }
  }

  private resetLock() {
    this.lockedTargetId = null;
    this.currentDwellTime = 0;
    this.lastAcquiredTargetId = null;
    SoundEffects.stopDwellSound();
  }

  public dispose() {
    this.resetLock();
    this.onHitCallback = null;
  }
}
