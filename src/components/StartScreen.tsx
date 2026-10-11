/**
 * StartScreen Component
 * Onboarding and permission gateway for RealityPlay VR.
 * Solicits camera and sensor permissions strictly on explicit user gesture.
 * Provides mode selection (Timed 60s vs Free Practice; Dual-Eye VR vs 2D Single View)
 * and fallback to simulated desktop passthrough mode.
 */

import React, { useState } from 'react';
import {
  Camera,
  Compass,
  Eye,
  Monitor,
  AlertCircle,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Timer,
  Crosshair,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { SoundEffects } from '../services/SoundEffects';
import { GameMode } from '../services/GameState';

interface StartScreenProps {
  onStart: (modeVR: boolean, useSimulation: boolean, gameMode: GameMode) => Promise<void>;
  onStartVisionMode?: () => void;
  bestScore: number;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  onStartVisionMode,
  bestScore,
}) => {
  const [isVRMode, setIsVRMode] = useState<boolean>(true);
  const [gameMode, setGameMode] = useState<GameMode>('timed');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleStartRealCamera = async () => {
    setIsLoading(true);
    setErrorMessage('');
    SoundEffects.unlockAudio();
    SoundEffects.playButtonClick();

    try {
      await onStart(isVRMode, false, gameMode);
    } catch (err: unknown) {
      setErrorMessage(
        (err as Error)?.message ||
          'Could not start camera feed. You can use Desktop Demo Mode below.'
      );
      setIsLoading(false);
    }
  };

  const handleStartSimulation = async () => {
    setIsLoading(true);
    setErrorMessage('');
    SoundEffects.unlockAudio();
    SoundEffects.playButtonClick();

    try {
      await onStart(isVRMode, true, gameMode);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to start demo.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#030508] text-neutral-100 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Subtle background ambient grid & radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,42,75,0.09),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0a0f18_1px,transparent_1px),linear-gradient(to_bottom,#0a0f18_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-35 pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-lg bg-neutral-950/85 backdrop-blur-xl border border-neutral-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center my-auto">
        {/* Futuristic VR Reticle Logo Insignia */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center animate-reticle-pulse">
            <div className="w-10 h-10 rounded-full border border-red-500/70 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ff2a4b]" />
            </div>
          </div>
          <div className="absolute -top-1 w-2 h-0.5 bg-red-400" />
          <div className="absolute -bottom-1 w-2 h-0.5 bg-red-400" />
          <div className="absolute -left-1 h-2 w-0.5 bg-red-400" />
          <div className="absolute -right-1 h-2 w-0.5 bg-red-400" />
        </div>

        {/* Title & Tagline */}
        <h1 className="text-2xl sm:text-3xl font-hud font-bold tracking-wider text-white">
          REALITYPLAY <span className="text-red-500">VR</span>
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-neutral-400 max-w-sm leading-relaxed">
          Futuristic mobile camera-based 3D target challenge. Lock onto holographic nodes with 700ms gaze dwell or instant tap.
        </p>

        {/* Best Score Counter */}
        {bestScore > 0 && (
          <div className="mt-3.5 inline-flex items-center gap-2 px-3 py-1 bg-neutral-900/80 rounded-full border border-neutral-800 text-xs font-hud text-neutral-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>PERSONAL BEST:</span>
            <strong className="text-white font-bold">{bestScore} PTS</strong>
          </div>
        )}

        {/* Viewport Mode Tabs (Dual-Eye vs 2D) */}
        <div className="w-full mt-5 bg-neutral-900/90 p-1 rounded-2xl border border-neutral-800/80 flex items-center">
          <button
            type="button"
            onClick={() => setIsVRMode(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-hud font-medium rounded-xl transition-all ${
              isVRMode
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Dual-Eye VR Mode</span>
          </button>
          <button
            type="button"
            onClick={() => setIsVRMode(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-hud font-medium rounded-xl transition-all ${
              !isVRMode
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Single View (2D)</span>
          </button>
        </div>

        {/* Game Mode Tabs (Timed 60s vs Practice) */}
        <div className="w-full mt-2.5 bg-neutral-900/60 p-1 rounded-2xl border border-neutral-800/60 flex items-center">
          <button
            type="button"
            onClick={() => setGameMode('timed')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-hud font-medium rounded-xl transition-all ${
              gameMode === 'timed'
                ? 'bg-neutral-800 text-amber-300 border border-amber-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Timer className="w-3.5 h-3.5 text-amber-400" />
            <span>60s Challenge</span>
          </button>
          <button
            type="button"
            onClick={() => setGameMode('practice')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-hud font-medium rounded-xl transition-all ${
              gameMode === 'practice'
                ? 'bg-neutral-800 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Free Practice</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="w-full grid grid-cols-3 gap-2 mt-4 text-[11px] font-hud text-neutral-400">
          <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800 flex flex-col items-center text-center">
            <Crosshair className="w-4 h-4 text-red-400 mb-1" />
            <span>700ms Gaze or Tap to Hit</span>
          </div>
          <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800 flex flex-col items-center text-center">
            <ShieldAlert className="w-4 h-4 text-amber-400 mb-1" />
            <span>Avoid Virtual Energy Barriers</span>
          </div>
          <div className="bg-neutral-900/60 p-2 rounded-xl border border-neutral-800 flex flex-col items-center text-center">
            <Sparkles className="w-4 h-4 text-amber-300 mb-1" />
            <span>Bonus Gold Nodes: 300 Pts</span>
          </div>
        </div>

        {/* Error / Recovery Notice */}
        {errorMessage && (
          <div className="w-full mt-4 p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-left text-xs text-red-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <strong className="font-semibold block mb-0.5">Camera Notice</strong>
              {errorMessage}
            </div>
          </div>
        )}

        {/* Primary Action: Start Experience */}
        <button
          type="button"
          onClick={handleStartRealCamera}
          disabled={isLoading}
          className="w-full mt-5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-hud font-semibold text-sm tracking-wide shadow-lg shadow-red-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-60"
        >
          <Camera className="w-4 h-4" />
          <span>{isLoading ? 'CALIBRATING SENSORS...' : 'START EXPERIENCE'}</span>
        </button>

        {/* Secondary Action: Desktop / Demo Simulation Mode */}
        <button
          type="button"
          onClick={handleStartSimulation}
          disabled={isLoading}
          className="w-full mt-2.5 py-2 px-4 rounded-xl bg-neutral-900/70 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white font-hud text-xs transition-colors flex items-center justify-center gap-2"
        >
          <Monitor className="w-3.5 h-3.5 text-neutral-400" />
          <span>Desktop Demo Mode (No Camera Required)</span>
        </button>

        {/* Optional Action: AI Vision Learning Mode */}
        {onStartVisionMode && (
          <button
            type="button"
            onClick={() => {
              SoundEffects.unlockAudio();
              SoundEffects.playButtonClick();
              onStartVisionMode();
            }}
            disabled={isLoading}
            className="w-full mt-2 py-2 px-4 rounded-xl bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-700/80 text-amber-300 hover:text-amber-200 font-hud text-xs transition-colors flex items-center justify-center gap-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Vision Learning Mode (Snapshot STEM Insights)</span>
          </button>
        )}

        {/* Privacy & Hardware Guidance Note */}
        <div className="mt-5 pt-4 border-t border-neutral-900 w-full flex flex-col gap-1.5 text-[11px] text-neutral-400 leading-normal">
          <div className="flex items-center justify-center gap-1.5 text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>100% On-Device Privacy: Camera stream is processed locally.</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-neutral-500">
            <Compass className="w-3 h-3 text-red-400/70" />
            <span>Uses gyro sensors for phone tracking or touch-drag aiming fallback.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
