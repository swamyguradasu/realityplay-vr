/**
 * GameState
 * Manages score, hit count, combo streaks, difficulty stages,
 * timed round countdown vs practice mode, round completion,
 * and persistent best score via localStorage.
 */

import { GameConfig } from './GameConfig';
import { SoundEffects } from './SoundEffects';

export type GameStatus = 'intro' | 'playing' | 'paused' | 'complete' | 'exit';
export type GameMode = 'timed' | 'practice';

export interface GameStats {
  score: number;
  hits: number;
  combo: number;
  maxCombo: number;
  bestScore: number;
  status: GameStatus;
  gameMode: GameMode;
  isVRMode: boolean;
  stage: number;
  stageName: string;
  stageDescription: string;
  timeRemaining: number;
  roundDuration: number;
  gameStartTime: number;
  shotsFired: number;
}

export type StateListener = (stats: GameStats) => void;

class GameStateManager {
  private readonly BEST_SCORE_KEY = 'realityplay_vr_best_score';

  private score: number = 0;
  private hits: number = 0;
  private combo: number = 0;
  private maxCombo: number = 0;
  private bestScore: number = 0;
  private status: GameStatus = 'intro';
  private gameMode: GameMode = 'timed';
  private isVRMode: boolean = true;
  private stage: number = 1;
  private timeRemaining: number = GameConfig.gameplay.timedRoundDurationSeconds;
  private roundDuration: number = GameConfig.gameplay.timedRoundDurationSeconds;
  private gameStartTime: number = 0;
  private lastHitTime: number = 0;
  private shotsFired: number = 0;
  private timerIntervalId: number | null = null;

  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.loadBestScore();
  }

  private loadBestScore() {
    try {
      const stored = localStorage.getItem(this.BEST_SCORE_KEY);
      if (stored) {
        this.bestScore = parseInt(stored, 10) || 0;
      }
    } catch {
      this.bestScore = 0;
    }
  }

  private saveBestScore() {
    try {
      localStorage.setItem(this.BEST_SCORE_KEY, this.bestScore.toString());
    } catch {
      // LocalStorage access restricted
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    const stats = this.getStats();
    this.listeners.forEach((l) => l(stats));
  }

  public getStats(): GameStats {
    const currentStageConfig =
      GameConfig.gameplay.stages.find((s) => s.stageNumber === this.stage) ||
      GameConfig.gameplay.stages[0];

    return {
      score: this.score,
      hits: this.hits,
      combo: this.combo,
      maxCombo: this.maxCombo,
      bestScore: this.bestScore,
      status: this.status,
      gameMode: this.gameMode,
      isVRMode: this.isVRMode,
      stage: this.stage,
      stageName: currentStageConfig.name,
      stageDescription: currentStageConfig.description,
      timeRemaining: this.timeRemaining,
      roundDuration: this.roundDuration,
      gameStartTime: this.gameStartTime,
      shotsFired: this.shotsFired,
    };
  }

  public startGame(vrMode: boolean, mode: GameMode = 'timed') {
    this.stopTimer();

    this.score = 0;
    this.hits = 0;
    this.shotsFired = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stage = 1;
    this.isVRMode = vrMode;
    this.gameMode = mode;
    this.status = 'playing';
    this.gameStartTime = Date.now();
    this.lastHitTime = Date.now();
    this.roundDuration = GameConfig.gameplay.timedRoundDurationSeconds;
    this.timeRemaining = this.roundDuration;

    // Start procedural ambient drone and start sound
    SoundEffects.playGameStart();
    SoundEffects.startAmbientDrone();

    if (this.gameMode === 'timed') {
      this.timerIntervalId = window.setInterval(() => {
        if (this.status === 'playing') {
          this.timeRemaining -= 1;
          if (this.timeRemaining <= 0) {
            this.timeRemaining = 0;
            this.completeRound();
          } else {
            this.emit();
          }
        }
      }, 1000);
    }

    this.emit();
  }

  public recordHit(_isInstantTap: boolean, basePoints: number = 100, isBonus: boolean = false) {
    if (this.status !== 'playing') return;

    this.shotsFired += 1;
    const now = Date.now();
    const timeSinceLastHit = (now - this.lastHitTime) / 1000;
    this.lastHitTime = now;

    // Combo streak if hits are under 3.5s apart
    if (timeSinceLastHit < GameConfig.scoring.comboStreakWindowSeconds && this.hits > 0) {
      this.combo = Math.min(GameConfig.scoring.maxComboMultiplier, this.combo + 1);
    } else {
      this.combo = 1;
    }

    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }

    if (this.combo > 1 && !isBonus) {
      SoundEffects.playComboStreak(this.combo);
    }

    // Award base points + combo streak bonus
    const streakBonus = this.combo > 1 ? (this.combo - 1) * GameConfig.scoring.comboBonusPerStreak : 0;
    const totalPoints = basePoints + streakBonus;

    this.score += totalPoints;
    this.hits += 1;

    // Update Difficulty Stage based on score
    this.updateStage();

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.saveBestScore();
    }

    this.emit();
  }

  private updateStage() {
    let newStage = 1;
    for (let i = GameConfig.gameplay.stages.length - 1; i >= 0; i--) {
      if (this.score >= GameConfig.gameplay.stages[i].thresholdScore) {
        newStage = GameConfig.gameplay.stages[i].stageNumber;
        break;
      }
    }
    if (newStage !== this.stage) {
      this.stage = newStage;
    }
  }

  public completeRound() {
    this.stopTimer();
    this.status = 'complete';
    SoundEffects.stopAmbientDrone();
    SoundEffects.playRoundComplete();
    this.emit();
  }

  private stopTimer() {
    if (this.timerIntervalId !== null) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  public setVRMode(isVR: boolean) {
    this.isVRMode = isVR;
    this.emit();
  }

  public toggleVRMode(): boolean {
    this.isVRMode = !this.isVRMode;
    this.emit();
    return this.isVRMode;
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    this.emit();
  }

  public exitGame() {
    this.stopTimer();
    SoundEffects.cleanup();
    this.status = 'intro';
    this.emit();
  }

  public resetBestScore() {
    this.bestScore = 0;
    try {
      localStorage.removeItem(this.BEST_SCORE_KEY);
    } catch {
      // Ignore
    }
    this.emit();
  }
}

export const GameState = new GameStateManager();
