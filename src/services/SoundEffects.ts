/**
 * SoundEffects / AudioManager
 * Procedural Web Audio API sound generator for RealityPlay VR.
 * Creates sci-fi targeting, gaze dwell charging, hit bursts, bonus chimes,
 * combo streaks, obstacle deflection, round completion fanfares,
 * and an ambient sci-fi drone without external audio files or dependencies.
 */

import { GameConfig } from './GameConfig';

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = GameConfig.audio.defaultMasterVolume;

  // Dwell charging synth
  private dwellOscillator: OscillatorNode | null = null;
  private dwellGain: GainNode | null = null;

  // Procedural ambient drone
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private isAmbientRunning: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public unlockAudio() {
    this.initContext();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
    if (this.isMuted) {
      this.stopDwellSound();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
    }
    if (this.isMuted) {
      this.stopDwellSound();
    }
  }

  /**
   * Soft activation sound on game start.
   */
  public playGameStart() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Audio interrupted
    }
  }

  /**
   * Subtle high-tech beep when the reticle acquires a target.
   */
  public playTargetAcquired() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // AudioContext interrupted
    }
  }

  /**
   * Continuous rising drone during 700ms gaze dwell.
   */
  public updateDwellSound(progress: number) {
    if (this.isMuted) {
      this.stopDwellSound();
      return;
    }
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (progress <= 0 || progress >= 1) {
      this.stopDwellSound();
      return;
    }

    try {
      const now = this.ctx.currentTime;
      if (!this.dwellOscillator) {
        this.dwellOscillator = this.ctx.createOscillator();
        this.dwellGain = this.ctx.createGain();

        this.dwellOscillator.type = 'triangle';
        this.dwellGain.gain.setValueAtTime(0.02, now);

        this.dwellOscillator.connect(this.dwellGain);
        this.dwellGain.connect(this.masterGain);
        this.dwellOscillator.start(now);
      }

      // Ramp frequency upwards from 320Hz to 780Hz as charge reaches 100%
      const targetFreq = 320 + progress * 460;
      this.dwellOscillator.frequency.setTargetAtTime(targetFreq, now, 0.03);

      const targetGain = 0.02 + progress * 0.06;
      this.dwellGain?.gain.setTargetAtTime(targetGain, now, 0.03);
    } catch {
      // Ignore
    }
  }

  public stopDwellSound() {
    if (this.dwellOscillator) {
      try {
        this.dwellOscillator.stop();
        this.dwellOscillator.disconnect();
      } catch {
        // Ignored
      }
      this.dwellOscillator = null;
    }
    if (this.dwellGain) {
      try {
        this.dwellGain.disconnect();
      } catch {
        // Ignored
      }
      this.dwellGain = null;
    }
  }

  /**
   * Crisp holographic hit burst sound.
   */
  public playTargetHit() {
    this.stopDwellSound();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Fundamental synth punch
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(540, now);
      osc1.frequency.exponentialRampToValueAtTime(140, now + 0.16);

      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // 2. High sparkle chime
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1400, now);
      osc2.frequency.setValueAtTime(1760, now + 0.05);
      osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.12);

      gain2.gain.setValueAtTime(0.12, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);
      osc2.start(now);
      osc2.stop(now + 0.16);
    } catch {
      // AudioContext interrupted
    }
  }

  /**
   * High-energy harmonic chime for Bonus targets.
   */
  public playBonusHit() {
    this.stopDwellSound();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 880, 1174.66, 1760]; // D5, A5, D6, A6

      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        const startTime = now + idx * 0.04;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.28);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.28);
      });
    } catch {
      // Interrupted
    }
  }

  /**
   * Ascending combo streak sound.
   */
  public playComboStreak(combo: number) {
    if (this.isMuted || combo <= 1) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const baseFreq = Math.min(1200, 440 + combo * 80);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch {
      // Interrupted
    }
  }

  /**
   * Dampened buzz when ray hits an occluding virtual obstacle.
   */
  public playObstacleBlocked() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.10);
    } catch {
      // Interrupted
    }
  }

  /**
   * Uplifting sci-fi chord when round completes.
   */
  public playRoundComplete() {
    this.stopDwellSound();
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const chord = [392.0, 493.88, 587.33, 783.99]; // G, B, D, G

      chord.forEach((freq) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.85);
      });
    } catch {
      // Interrupted
    }
  }

  /**
   * Subtle procedural ambient sci-fi background drone.
   */
  public startAmbientDrone() {
    if (this.isAmbientRunning || this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0.001, now);
      this.ambientGain.linearRampToValueAtTime(GameConfig.audio.ambientDroneVolume, now + 2.0);

      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'lowpass';
      this.ambientFilter.frequency.setValueAtTime(260, now);

      this.ambientOsc1 = this.ctx.createOscillator();
      this.ambientOsc1.type = 'sine';
      this.ambientOsc1.frequency.setValueAtTime(55, now); // A1 note

      this.ambientOsc2 = this.ctx.createOscillator();
      this.ambientOsc2.type = 'triangle';
      this.ambientOsc2.frequency.setValueAtTime(82.4, now); // E2 note

      this.ambientOsc1.connect(this.ambientFilter);
      this.ambientOsc2.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.ambientOsc1.start(now);
      this.ambientOsc2.start(now);
      this.isAmbientRunning = true;
    } catch {
      // Interrupted
    }
  }

  public stopAmbientDrone() {
    if (!this.isAmbientRunning) return;
    try {
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      }
      setTimeout(() => {
        try {
          this.ambientOsc1?.stop();
          this.ambientOsc1?.disconnect();
          this.ambientOsc2?.stop();
          this.ambientOsc2?.disconnect();
          this.ambientFilter?.disconnect();
          this.ambientGain?.disconnect();
        } catch {
          // Ignored
        }
        this.ambientOsc1 = null;
        this.ambientOsc2 = null;
        this.ambientFilter = null;
        this.ambientGain = null;
        this.isAmbientRunning = false;
      }, 500);
    } catch {
      this.isAmbientRunning = false;
    }
  }

  /**
   * Subtle click for UI buttons.
   */
  public playButtonClick() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Ignored
    }
  }

  public cleanup() {
    this.stopDwellSound();
    this.stopAmbientDrone();
  }
}

export const SoundEffects = new SoundEffectsService();
