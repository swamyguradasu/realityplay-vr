/**
 * HeadsetEyeView Component
 * Renders an individual headset eye port with rounded barrel curvature,
 * cinematic lens vignette, live video mirror, peripheral tactical HUD ticks,
 * stage indicators, timer readouts, and central reticle.
 */

import React, { useEffect, useRef } from 'react';
import { Reticle } from './Reticle';

interface HeadsetEyeViewProps {
  eyeLabel?: 'L-EYE' | 'R-EYE' | 'NORMAL';
  stream: MediaStream | null;
  isLocked: boolean;
  dwellProgress: number;
  targetDistance?: number;
  targetType?: string;
  isOccluded?: boolean;
  occludedByName?: string | null;
  score: number;
  hits: number;
  combo: number;
  stage: number;
  timeRemaining?: number;
  isVRMode: boolean;
}

export const HeadsetEyeView: React.FC<HeadsetEyeViewProps> = ({
  eyeLabel = 'NORMAL',
  stream,
  isLocked,
  dwellProgress,
  targetDistance,
  targetType,
  isOccluded = false,
  occludedByName,
  score,
  hits,
  combo,
  stage,
  timeRemaining,
  isVRMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Synchronize stream with this eye's local video element
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [stream]);

  return (
    <div
      className={`relative flex-1 h-full bg-black flex items-center justify-center overflow-hidden ${
        isVRMode ? 'p-1.5 sm:p-2.5' : 'p-0'
      }`}
    >
      {/* Headset Eyepiece Aperture */}
      <div
        className={`relative w-full h-full overflow-hidden bg-black ${
          isVRMode
            ? 'rounded-[32px] sm:rounded-[44px] border border-neutral-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.95)]'
            : 'rounded-none'
        }`}
      >
        {/* Live Camera Stream Video Passthrough */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          disablePictureInPicture
          onLoadedMetadata={() => {
            videoRef.current?.play().catch(() => {});
          }}
          onCanPlay={() => {
            videoRef.current?.play().catch(() => {});
          }}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-102"
        />

        {/* Fallback subtle dark backdrop if video is initializing */}
        {!stream && (
          <div className="absolute inset-0 bg-neutral-950/90 flex items-center justify-center pointer-events-none">
            <span className="font-hud text-xs text-red-500/50 uppercase tracking-widest">
              Awaiting Video Passthrough...
            </span>
          </div>
        )}

        {/* Barrel Lens Vignette Overlay */}
        <div className="absolute inset-0 vr-vignette pointer-events-none" />

        {/* Subtle Horizontal Horizon Marks */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-between px-6 opacity-30">
          <div className="w-5 h-[1px] bg-red-400" />
          <div className="w-5 h-[1px] bg-red-400" />
        </div>

        {/* Peripheral Top HUD Info */}
        <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none text-neutral-300 font-hud text-[11px] sm:text-xs">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-semibold">{eyeLabel}</span>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-400">STG {stage}</span>
            <span className="text-neutral-500">·</span>
            <span className="text-neutral-400">HITS: {hits}</span>
            {combo > 1 && (
              <span className="text-amber-400 font-bold animate-pulse">
                x{combo}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {timeRemaining !== undefined && (
              <>
                <span className={`font-bold ${timeRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-neutral-300'}`}>
                  {timeRemaining}s
                </span>
                <span className="text-neutral-500">·</span>
              </>
            )}
            <span className="text-neutral-400">SCORE</span>
            <span className="text-white font-bold tracking-wider">{score}</span>
          </div>
        </div>

        {/* Peripheral Corner Bracket Tick Marks */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-red-500/30 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-red-500/30 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-red-500/30 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-red-500/30 pointer-events-none" />

        {/* Central Aiming Reticle with Gaze Dwell Charging & Occlusion */}
        <Reticle
          isLocked={isLocked}
          dwellProgress={dwellProgress}
          distance={targetDistance}
          targetType={targetType}
          isOccluded={isOccluded}
          occludedByName={occludedByName}
        />
      </div>
    </div>
  );
};
