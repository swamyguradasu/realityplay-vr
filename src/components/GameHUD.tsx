/**
 * GameHUD Component
 * Minimalist top controls, live stage & timer advisories,
 * volume controls, and Round Completion summary overlay:
 * - Exit experience cleanly
 * - Toggle VR / Normal mode
 * - Recenter heading calibration
 * - Audio mute toggle & volume slider
 * - Round Complete celebration & Replay action
 * - Portrait warning indicator
 */

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  Compass,
  Smartphone,
  Eye,
  Sparkles,
  Trophy,
  Flame,
  Shield,
  Play,
} from 'lucide-react';
import { SoundEffects } from '../services/SoundEffects';
import { GameStatus } from '../services/GameState';

interface GameHUDProps {
  score: number;
  bestScore: number;
  hits: number;
  maxCombo: number;
  stage: number;
  stageName: string;
  gameStatus: GameStatus;
  gameMode: 'timed' | 'practice';
  timeRemaining: number;
  isVRMode: boolean;
  motionMode: 'sensor' | 'touch';
  onExit: () => void;
  onToggleVR: () => void;
  onRecenter: () => void;
  onReplay: () => void;
  onOpenVisionMode?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  score,
  bestScore,
  hits,
  maxCombo,
  stage,
  stageName,
  gameStatus,
  gameMode,
  timeRemaining,
  isVRMode,
  motionMode,
  onExit,
  onToggleVR,
  onRecenter,
  onReplay,
  onOpenVisionMode,
}) => {
  const [isMuted, setIsMuted] = useState(SoundEffects.getIsMuted());
  const [volume, setVolume] = useState(SoundEffects.getMasterVolume());
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showPortraitNotice, setShowPortraitNotice] = useState(true);

  // Check orientation for landscape recommendation
  useEffect(() => {
    const checkOrientation = () => {
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = SoundEffects.toggleMute();
    setIsMuted(muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    SoundEffects.setMasterVolume(newVol);
    if (newVol > 0 && isMuted) {
      SoundEffects.setMuted(false);
      setIsMuted(false);
    }
  };

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    SoundEffects.playButtonClick();
    onRecenter();
  };

  const handleToggleVR = (e: React.MouseEvent) => {
    e.stopPropagation();
    SoundEffects.playButtonClick();
    onToggleVR();
  };

  const handleExit = (e: React.MouseEvent) => {
    e.stopPropagation();
    SoundEffects.playButtonClick();
    onExit();
  };

  const handleReplayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    SoundEffects.playButtonClick();
    onReplay();
  };

  const isNewRecord = score > 0 && score >= bestScore;

  return (
    <>
      {/* Top Floating Mini-Bar Controls */}
      <header className="fixed top-2 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-6 pointer-events-none">
        {/* Left: Score, Stage & Timer */}
        <div className="flex items-center gap-2 sm:gap-3 bg-black/65 backdrop-blur-md px-3 py-1.5 rounded-full border border-neutral-800 text-xs font-hud pointer-events-auto">
          <span className="text-red-400 font-semibold tracking-wider">REALITYPLAY</span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-300">
            PTS <strong className="text-white ml-0.5">{score}</strong>
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-amber-400 font-medium hidden xs:inline">
            S{stage}: {stageName}
          </span>
          <span className="text-neutral-600 hidden xs:inline">·</span>
          {gameMode === 'timed' ? (
            <span
              className={`font-bold ${
                timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-neutral-300'
              }`}
            >
              ⏱ {timeRemaining}s
            </span>
          ) : (
            <span className="text-emerald-400 font-medium">FREEPLAY</span>
          )}
        </div>

        {/* Right: Operational Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Recenter heading */}
          <button
            onClick={handleRecenter}
            title="Recenter Heading"
            aria-label="Recenter Heading"
            className="flex items-center gap-1 bg-black/65 hover:bg-neutral-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-neutral-800 text-neutral-300 text-xs font-hud transition-colors"
          >
            <Compass className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">RECENTER</span>
          </button>

          {/* VR / Normal View Toggle */}
          <button
            onClick={handleToggleVR}
            title={isVRMode ? 'Switch to Normal View' : 'Switch to VR Dual-Eye'}
            aria-label={isVRMode ? 'Switch to Normal View' : 'Switch to VR Dual-Eye'}
            className="flex items-center gap-1.5 bg-black/65 hover:bg-neutral-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-neutral-800 text-neutral-300 text-xs font-hud transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-red-400" />
            <span>{isVRMode ? 'VR' : '2D'}</span>
          </button>

          {/* AI Vision Explorer Trigger */}
          {onOpenVisionMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                SoundEffects.playButtonClick();
                onOpenVisionMode();
              }}
              title="AI Vision Learning Mode"
              aria-label="AI Vision Learning Mode"
              className="flex items-center gap-1 bg-amber-950/40 hover:bg-amber-900/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-amber-500/40 text-amber-300 text-xs font-hud transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">AI VISION</span>
            </button>
          )}

          {/* Volume control with hover/click slider */}
          <div className="relative flex items-center">
            <button
              onClick={handleToggleMute}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowVolumeSlider(!showVolumeSlider);
              }}
              title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 rounded-full bg-black/65 hover:bg-neutral-900/80 backdrop-blur-md border border-neutral-800 text-neutral-300 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-neutral-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-red-400" />
              )}
            </button>
          </div>

          {/* Exit Game */}
          <button
            onClick={handleExit}
            title="Exit Game"
            aria-label="Exit Game"
            className="p-1.5 rounded-full bg-red-950/40 hover:bg-red-900/60 backdrop-blur-md border border-red-500/40 text-red-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Motion Mode Status Hint (Discreet bottom helper) */}
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-60 text-[10px] font-hud text-neutral-400 tracking-wider">
        {motionMode === 'sensor'
          ? 'GYRO AIM · 700MS GAZE DWELL OR TAP TO FIRE'
          : 'TOUCH DRAG AIM · 700MS GAZE DWELL OR TAP TO FIRE'}
      </div>

      {/* Landscape Orientation Advisory (shown in portrait mode) */}
      {isPortrait && showPortraitNotice && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-30 max-w-sm w-[90%] bg-neutral-950/90 backdrop-blur-md border border-neutral-800 p-2.5 rounded-xl shadow-xl flex items-center justify-between text-xs text-neutral-300 font-hud">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-red-400 rotate-90 shrink-0" />
            <span>Rotate to Landscape for optimal VR headset alignment</span>
          </div>
          <button
            onClick={() => setShowPortraitNotice(false)}
            className="p-1 text-neutral-500 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clean Round Complete Modal Overlay */}
      {gameStatus === 'complete' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-neutral-950/90 border border-neutral-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl flex flex-col items-center">
            {/* Header Icon */}
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4">
              <Trophy className="w-8 h-8 text-amber-400 animate-bounce" />
            </div>

            {/* Title */}
            <h2 className="text-2xl font-hud font-bold text-white tracking-wide">
              ROUND COMPLETE
            </h2>
            <p className="text-xs text-neutral-400 font-hud mt-1">
              Time elapsed: {GameConfig.gameplay.timedRoundDurationSeconds}s · Final Session Report
            </p>

            {/* New Record Banner */}
            {isNewRecord && (
              <div className="mt-3 px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full text-xs font-hud text-amber-300 font-semibold tracking-wider">
                ★ NEW PERSONAL BEST! ★
              </div>
            )}

            {/* Score & Stats Grid */}
            <div className="w-full grid grid-cols-2 gap-3 mt-6">
              <div className="bg-neutral-900/80 p-3.5 rounded-2xl border border-neutral-800/80 flex flex-col items-center">
                <span className="text-[11px] text-neutral-400 font-hud">FINAL SCORE</span>
                <span className="text-2xl font-bold font-hud text-white mt-1">{score}</span>
              </div>
              <div className="bg-neutral-900/80 p-3.5 rounded-2xl border border-neutral-800/80 flex flex-col items-center">
                <span className="text-[11px] text-neutral-400 font-hud">TARGETS HIT</span>
                <span className="text-2xl font-bold font-hud text-white mt-1">{hits}</span>
              </div>
              <div className="bg-neutral-900/80 p-3.5 rounded-2xl border border-neutral-800/80 flex flex-col items-center">
                <span className="text-[11px] text-neutral-400 font-hud flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" /> MAX STREAK
                </span>
                <span className="text-xl font-bold font-hud text-amber-400 mt-1">
                  {maxCombo > 1 ? `x${maxCombo}` : '1'}
                </span>
              </div>
              <div className="bg-neutral-900/80 p-3.5 rounded-2xl border border-neutral-800/80 flex flex-col items-center">
                <span className="text-[11px] text-neutral-400 font-hud flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-blue-400" /> STAGE REACHED
                </span>
                <span className="text-xl font-bold font-hud text-blue-400 mt-1">
                  STAGE {stage}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5 mt-6">
              <button
                onClick={handleReplayClick}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-hud font-semibold text-sm tracking-wide shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>PLAY AGAIN</span>
              </button>

              <button
                onClick={handleExit}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-hud text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                <span>EXIT TO MENU</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
