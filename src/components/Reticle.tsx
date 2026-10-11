/**
 * Reticle Component
 * Precise glowing circular reticle with SVG charge ring (700ms gaze dwell),
 * center bullseye pip, peripheral tick marks, distance readouts,
 * and virtual obstacle occlusion alert.
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ReticleProps {
  isLocked: boolean;
  dwellProgress: number; // 0.0 to 1.0
  distance?: number;
  targetType?: string;
  isOccluded?: boolean;
  occludedByName?: string | null;
}

export const Reticle: React.FC<ReticleProps> = ({
  isLocked,
  dwellProgress,
  distance,
  targetType,
  isOccluded = false,
  occludedByName,
}) => {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - dwellProgress * circumference;

  const isBonusTarget = targetType === 'bonus';

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Outer static guidance ring */}
        <div
          className={`absolute inset-0 rounded-full border transition-all duration-200 ${
            isOccluded
              ? 'border-amber-500/80 border-dashed scale-100 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
              : isLocked
              ? isBonusTarget
                ? 'border-amber-400 scale-105 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
                : 'border-red-500/80 scale-105 shadow-[0_0_15px_rgba(255,42,75,0.6)]'
              : 'border-red-500/30 border-dashed scale-100'
          }`}
        />

        {/* Dynamic Gaze Dwell Charging Circle */}
        <svg className="w-22 h-22 -rotate-90" viewBox="0 0 60 60">
          <circle
            cx="30"
            cy="30"
            r={radius}
            fill="none"
            stroke={isOccluded ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 42, 75, 0.15)'}
            strokeWidth="2.5"
          />
          {dwellProgress > 0 && !isOccluded && (
            <circle
              cx="30"
              cy="30"
              r={radius}
              fill="none"
              stroke={isBonusTarget ? '#fbbf24' : '#ff2a4b'}
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                filter: isBonusTarget
                  ? 'drop-shadow(0 0 8px #fbbf24)'
                  : 'drop-shadow(0 0 6px #ff2a4b)',
                transition: 'stroke-dashoffset 35ms linear',
              }}
            />
          )}
        </svg>

        {/* Crosshair Cardinal Tick Marks */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={`absolute top-1 w-0.5 h-2.5 transition-colors ${
              isOccluded
                ? 'bg-amber-400'
                : isLocked
                ? isBonusTarget
                  ? 'bg-amber-300'
                  : 'bg-red-400'
                : 'bg-red-500/40'
            }`}
          />
          <div
            className={`absolute bottom-1 w-0.5 h-2.5 transition-colors ${
              isOccluded
                ? 'bg-amber-400'
                : isLocked
                ? isBonusTarget
                  ? 'bg-amber-300'
                  : 'bg-red-400'
                : 'bg-red-500/40'
            }`}
          />
          <div
            className={`absolute left-1 h-0.5 w-2.5 transition-colors ${
              isOccluded
                ? 'bg-amber-400'
                : isLocked
                ? isBonusTarget
                  ? 'bg-amber-300'
                  : 'bg-red-400'
                : 'bg-red-500/40'
            }`}
          />
          <div
            className={`absolute right-1 h-0.5 w-2.5 transition-colors ${
              isOccluded
                ? 'bg-amber-400'
                : isLocked
                ? isBonusTarget
                  ? 'bg-amber-300'
                  : 'bg-red-400'
                : 'bg-red-500/40'
            }`}
          />
        </div>

        {/* Center Bullseye Pip */}
        <div
          className={`w-2 h-2 rounded-full transition-transform duration-150 ${
            isOccluded
              ? 'bg-amber-400 scale-110 shadow-[0_0_8px_#f59e0b]'
              : isLocked
              ? isBonusTarget
                ? 'bg-amber-300 scale-125 shadow-[0_0_12px_#fbbf24]'
                : 'bg-white scale-125 shadow-[0_0_8px_#ffffff]'
              : 'bg-red-500/80 scale-100 shadow-[0_0_4px_#ff2a4b]'
          }`}
        />

        {/* Virtual Obstacle Occlusion Indicator */}
        {isOccluded && (
          <div className="absolute -bottom-8 flex flex-col items-center whitespace-nowrap">
            <span className="inline-flex items-center gap-1 font-hud text-[10px] text-amber-300 font-semibold tracking-wider bg-black/80 px-2 py-0.5 rounded border border-amber-500/60 shadow-lg">
              <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />
              <span>BLOCKED · {occludedByName || 'BARRIER'}</span>
            </span>
          </div>
        )}

        {/* Normal Target Lock & Distance Indicator */}
        {!isOccluded && isLocked && distance && (
          <div className="absolute -bottom-8 flex flex-col items-center whitespace-nowrap">
            <span
              className={`font-hud text-[10px] font-semibold tracking-wider bg-black/75 px-2 py-0.5 rounded border ${
                isBonusTarget
                  ? 'text-amber-300 border-amber-400/70 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
                  : 'text-red-300 border-red-500/50'
              }`}
            >
              {isBonusTarget ? 'BONUS ' : 'LOCK '}
              {distance.toFixed(1)}M
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
