/**
 * GameConfig
 * Centralized configuration for RealityPlay VR.
 * Controls scoring, aiming dwell thresholds, difficulty progression,
 * target parameters, obstacle parameters, audio defaults, and performance limits.
 */

export const GameConfig = {
  // Aiming & Activation
  aiming: {
    dwellDurationSeconds: 0.70, // 700 ms gaze dwell to trigger hit
    tapActivationEnabled: true,
    postHitCooldownSeconds: 0.25, // 250 ms cooldown preventing rapid double hits
    maxRaycastDistance: 35.0, // meters
    angularToleranceMultiplier: 1.35, // Hand tremor tolerance cone for mobile
  },

  // Scoring
  scoring: {
    targetPoints: {
      bullseye: 100,
      sphere: 120,
      geometric: 150,
      moving: 150,
      bonus: 300,
    },
    comboStreakWindowSeconds: 3.5, // hits within 3.5s increase combo
    comboBonusPerStreak: 25, // extra points per combo level
    maxComboMultiplier: 8,
  },

  // Rounds & Progression
  gameplay: {
    timedRoundDurationSeconds: 60,
    maxActiveTargets: 6,
    stages: [
      {
        stageNumber: 1,
        name: 'Initiation',
        thresholdScore: 0,
        description: 'Calm targets · Holographic bullseyes & energy spheres',
        hasMovingTargets: false,
        hasObstacles: false,
        hasBonusTargets: false,
      },
      {
        stageNumber: 2,
        name: 'Kinetic Drift',
        thresholdScore: 400,
        description: 'Kinetic targets in motion',
        hasMovingTargets: true,
        hasObstacles: false,
        hasBonusTargets: true,
      },
      {
        stageNumber: 3,
        name: 'Energy Barriers',
        thresholdScore: 900,
        description: 'Virtual energy barriers deployed',
        hasMovingTargets: true,
        hasObstacles: true,
        obstacleCount: 2,
        hasBonusTargets: true,
      },
      {
        stageNumber: 4,
        name: 'Overdrive',
        thresholdScore: 1600,
        description: 'Fast movement & dynamic barriers',
        hasMovingTargets: true,
        hasObstacles: true,
        obstacleCount: 4,
        hasBonusTargets: true,
      },
    ],
  },

  // Audio Settings
  audio: {
    defaultMasterVolume: 0.7,
    ambientDroneVolume: 0.12,
    soundEffectsVolume: 0.75,
  },

  // Performance Limits
  performance: {
    maxPixelRatio: 1.75,
    highQualityParticleCount: 24,
    lowQualityParticleCount: 10,
    fpsCheckInterval: 60, // frames
    fpsThrottleThreshold: 42, // trigger low quality mode if FPS falls below this
    fpsRecoverThreshold: 54, // recover high quality mode if FPS stays above this
  },
} as const;
