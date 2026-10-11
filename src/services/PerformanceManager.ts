/**
 * PerformanceManager
 * Dynamically tracks FPS, manages quality tiers (high vs performance),
 * throttles particle counts and rendering fidelity on weaker mobile chipsets.
 */

import { GameConfig } from './GameConfig';

export type QualityTier = 'high' | 'performance';

export interface PerformanceStats {
  fps: number;
  qualityTier: QualityTier;
  particleLimit: number;
}

export type PerformanceListener = (stats: PerformanceStats) => void;

export class PerformanceManager {
  private frameCount: number = 0;
  private lastTimestamp: number = performance.now();
  private currentFps: number = 60;
  private qualityTier: QualityTier = 'high';
  private lowFpsCounter: number = 0;
  private highFpsCounter: number = 0;
  private listeners: Set<PerformanceListener> = new Set();

  constructor() {
    this.lastTimestamp = performance.now();
  }

  public subscribe(listener: PerformanceListener): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public recordFrame(now: number) {
    this.frameCount++;
    const delta = now - this.lastTimestamp;

    if (this.frameCount >= GameConfig.performance.fpsCheckInterval) {
      if (delta > 0) {
        this.currentFps = Math.round((this.frameCount * 1000) / delta);
      }

      this.frameCount = 0;
      this.lastTimestamp = now;

      // Quality tier evaluation
      if (this.currentFps < GameConfig.performance.fpsThrottleThreshold) {
        this.lowFpsCounter++;
        this.highFpsCounter = 0;
        if (this.lowFpsCounter >= 2 && this.qualityTier === 'high') {
          this.qualityTier = 'performance';
          this.notify();
        }
      } else if (this.currentFps >= GameConfig.performance.fpsRecoverThreshold) {
        this.highFpsCounter++;
        this.lowFpsCounter = 0;
        if (this.highFpsCounter >= 4 && this.qualityTier === 'performance') {
          this.qualityTier = 'high';
          this.notify();
        }
      } else {
        this.lowFpsCounter = 0;
        this.highFpsCounter = 0;
      }
    }
  }

  public getParticleLimit(): number {
    return this.qualityTier === 'high'
      ? GameConfig.performance.highQualityParticleCount
      : GameConfig.performance.lowQualityParticleCount;
  }

  public getStats(): PerformanceStats {
    return {
      fps: this.currentFps,
      qualityTier: this.qualityTier,
      particleLimit: this.getParticleLimit(),
    };
  }

  private notify() {
    const stats = this.getStats();
    this.listeners.forEach((l) => l(stats));
  }

  public dispose() {
    this.listeners.clear();
  }
}

export const GlobalPerformanceManager = new PerformanceManager();
