/**
 * VRGameView Component
 * Coordinates Three.js 3D rendering, stereoscopic viewport splitting,
 * real-time camera passthrough, device orientation tracking, touch drag aiming,
 * virtual 3D obstacle occlusion, and 700ms gaze dwell / tap-to-hit interactions.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { VRViewRenderer } from '../services/VRViewRenderer';
import { SceneManager } from '../services/SceneManager';
import { TargetManager } from '../services/TargetManager';
import { ObstacleManager } from '../services/ObstacleManager';
import { AimController, AimStatus } from '../services/AimController';
import { GlobalOrientationManager } from '../services/OrientationManager';
import { GlobalPerformanceManager } from '../services/PerformanceManager';
import { GameState, GameStats } from '../services/GameState';
import { HeadsetEyeView } from './HeadsetEyeView';
import { GameHUD } from './GameHUD';

interface VRGameViewProps {
  stream: MediaStream | null;
  onExit: () => void;
  onOpenVisionMode?: () => void;
}

export const VRGameView: React.FC<VRGameViewProps> = ({ stream, onExit, onOpenVisionMode }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // References to engine subsystems
  const rendererRef = useRef<VRViewRenderer | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const targetManagerRef = useRef<TargetManager | null>(null);
  const obstacleManagerRef = useRef<ObstacleManager | null>(null);
  const aimControllerRef = useRef<AimController | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Reactive state
  const [stats, setStats] = useState<GameStats>(GameState.getStats());
  const [aimStatus, setAimStatus] = useState<AimStatus>({
    isTargetLocked: false,
    lockedTargetId: null,
    dwellProgress: 0,
    targetDistance: 0,
    isOccluded: false,
    occludedByName: null,
  });
  const [motionMode, setMotionMode] = useState<'sensor' | 'touch'>('touch');

  // Drag aiming tracking
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Listen to GameState updates
  useEffect(() => {
    const unsubscribe = GameState.subscribe((newStats) => {
      setStats(newStats);
      if (rendererRef.current && rendererRef.current.getVRMode() !== newStats.isVRMode) {
        rendererRef.current.setVRMode(newStats.isVRMode);
      }
      if (targetManagerRef.current) {
        targetManagerRef.current.setStage(newStats.stage);
      }
      if (obstacleManagerRef.current) {
        obstacleManagerRef.current.setStage(newStats.stage);
      }
    });
    return unsubscribe;
  }, []);

  // Initialize Three.js engine and game loop
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    // 1. Initialize SceneManager
    const sceneManager = new SceneManager();
    sceneManagerRef.current = sceneManager;
    const scene = sceneManager.scene;

    // 2. Initialize VRViewRenderer
    const vrRenderer = new VRViewRenderer({
      container: containerRef.current,
      canvas: canvasRef.current,
      isVRMode: stats.isVRMode,
      eyeSeparation: 0.064, // 64mm standard IPD
    });
    rendererRef.current = vrRenderer;

    // 3. Initialize TargetManager
    const targetManager = new TargetManager(scene);
    targetManager.setStage(stats.stage);
    targetManagerRef.current = targetManager;

    // 4. Initialize ObstacleManager
    const obstacleManager = new ObstacleManager(scene);
    obstacleManager.setStage(stats.stage);
    obstacleManagerRef.current = obstacleManager;

    // 5. Initialize AimController
    const aimController = new AimController(
      vrRenderer.getActiveAimCamera(),
      targetManager,
      obstacleManager
    );
    aimController.setOnHit((_targetId, isInstantTap, points, isBonus) => {
      GameState.recordHit(isInstantTap, points, isBonus);
    });
    aimControllerRef.current = aimController;

    // 6. Recenter initial heading
    GlobalOrientationManager.recenterHeading();
    setMotionMode(GlobalOrientationManager.getMotionMode());

    // 7. Render Loop
    let lastTime = performance.now();
    const clock = new THREE.Clock();

    const loop = () => {
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.08); // cap delta for stability
      lastTime = now;
      const elapsed = clock.getElapsedTime();

      // Performance monitoring
      GlobalPerformanceManager.recordFrame(now);

      // Update orientation
      GlobalOrientationManager.updateCamera(vrRenderer.centerCamera, 0.16);
      setMotionMode(GlobalOrientationManager.getMotionMode());

      // Update obstacles
      obstacleManager.update(delta, elapsed);

      // Update targets (floating animations, hit pulses, respawns)
      targetManager.update(delta, elapsed);

      // Update aim raycasting, occlusion, & 700ms gaze dwell
      const currentAim = aimController.update(delta);
      setAimStatus(currentAim);

      // Render stereoscopic or mono views
      vrRenderer.render(scene);

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    // Resize handler
    const handleResize = () => {
      vrRenderer.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      window.removeEventListener('resize', handleResize);
      aimController.dispose();
      targetManager.dispose();
      obstacleManager.dispose();
      sceneManager.dispose();
      vrRenderer.dispose();
      sceneManagerRef.current = null;
      targetManagerRef.current = null;
      obstacleManagerRef.current = null;
      aimControllerRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  // Handle pointer down (detect tap vs drag)
  const handlePointerDown = (e: React.PointerEvent) => {
    // Prevent HUD buttons and links from triggering game tap or aiming drag
    if ((e.target as HTMLElement).closest('button, a, input, header')) {
      return;
    }
    pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  // Handle pointer move (touch / mouse aiming fallback)
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownPosRef.current) return;

    const dx = e.clientX - pointerDownPosRef.current.x;
    const dy = e.clientY - pointerDownPosRef.current.y;

    if (Math.hypot(dx, dy) > 8) {
      isDraggingRef.current = true;
      GlobalOrientationManager.addTouchDelta(dx, dy);
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  // Handle pointer up (trigger tap hit if not dragged)
  const handlePointerUp = (_e: React.PointerEvent) => {
    if (!isDraggingRef.current && pointerDownPosRef.current) {
      aimControllerRef.current?.handleScreenTap();
    }
    pointerDownPosRef.current = null;
    isDraggingRef.current = false;
  };

  const handleToggleVR = useCallback(() => {
    GameState.toggleVRMode();
  }, []);

  const handleRecenter = useCallback(() => {
    GlobalOrientationManager.recenterHeading();
  }, []);

  const handleReplay = useCallback(() => {
    GameState.startGame(stats.isVRMode, stats.gameMode);
  }, [stats.isVRMode, stats.gameMode]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-full h-full min-h-screen bg-black overflow-hidden select-none touch-none cursor-crosshair"
    >
      {/* Top Floating Mini-Bar Controls & Round End Summary */}
      <GameHUD
        score={stats.score}
        bestScore={stats.bestScore}
        hits={stats.hits}
        maxCombo={stats.maxCombo}
        stage={stats.stage}
        stageName={stats.stageName}
        gameStatus={stats.status}
        gameMode={stats.gameMode}
        timeRemaining={stats.timeRemaining}
        isVRMode={stats.isVRMode}
        motionMode={motionMode}
        onExit={onExit}
        onToggleVR={handleToggleVR}
        onRecenter={handleRecenter}
        onReplay={handleReplay}
        onOpenVisionMode={onOpenVisionMode}
      />

      {/* Dual-Eye or Single-Eye Camera Passthrough & Reticle Layer */}
      <div className="absolute inset-0 flex flex-row items-stretch justify-center bg-black">
        {stats.isVRMode ? (
          <>
            {/* Left Eye Port */}
            <HeadsetEyeView
              eyeLabel="L-EYE"
              stream={stream}
              isLocked={aimStatus.isTargetLocked}
              dwellProgress={aimStatus.dwellProgress}
              targetDistance={aimStatus.targetDistance}
              targetType={aimStatus.targetType}
              isOccluded={aimStatus.isOccluded}
              occludedByName={aimStatus.occludedByName}
              score={stats.score}
              hits={stats.hits}
              combo={stats.combo}
              stage={stats.stage}
              timeRemaining={stats.gameMode === 'timed' ? stats.timeRemaining : undefined}
              isVRMode={true}
            />

            {/* Headset Center Divider Line */}
            <div className="w-[3px] h-full bg-[#03060c] border-x border-neutral-900 shadow-2xl z-20 shrink-0" />

            {/* Right Eye Port */}
            <HeadsetEyeView
              eyeLabel="R-EYE"
              stream={stream}
              isLocked={aimStatus.isTargetLocked}
              dwellProgress={aimStatus.dwellProgress}
              targetDistance={aimStatus.targetDistance}
              targetType={aimStatus.targetType}
              isOccluded={aimStatus.isOccluded}
              occludedByName={aimStatus.occludedByName}
              score={stats.score}
              hits={stats.hits}
              combo={stats.combo}
              stage={stats.stage}
              timeRemaining={stats.gameMode === 'timed' ? stats.timeRemaining : undefined}
              isVRMode={true}
            />
          </>
        ) : (
          /* Normal Single Viewport */
          <HeadsetEyeView
            eyeLabel="NORMAL"
            stream={stream}
            isLocked={aimStatus.isTargetLocked}
            dwellProgress={aimStatus.dwellProgress}
            targetDistance={aimStatus.targetDistance}
            targetType={aimStatus.targetType}
            isOccluded={aimStatus.isOccluded}
            occludedByName={aimStatus.occludedByName}
            score={stats.score}
            hits={stats.hits}
            combo={stats.combo}
            stage={stats.stage}
            timeRemaining={stats.gameMode === 'timed' ? stats.timeRemaining : undefined}
            isVRMode={false}
          />
        )}
      </div>

      {/* Transparent Three.js WebGL Canvas for 3D Holographic Targets & Obstacles */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />
    </div>
  );
};
