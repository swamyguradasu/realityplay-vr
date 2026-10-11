/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { GlobalCameraManager } from './services/CameraManager';
import { GlobalOrientationManager } from './services/OrientationManager';
import { GameState, GameStats, GameMode } from './services/GameState';
import { SoundEffects } from './services/SoundEffects';
import { StartScreen } from './components/StartScreen';
import { VRGameView } from './components/VRGameView';
import { AIVisionExplorer } from './components/AIVisionExplorer';

export default function App() {
  const [gameStats, setGameStats] = useState<GameStats>(GameState.getStats());
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeMode, setActiveMode] = useState<'game' | 'vision'>('game');

  // Subscribe to GameState updates
  useEffect(() => {
    const unsub = GameState.subscribe((newStats) => {
      setGameStats(newStats);
    });
    return unsub;
  }, []);

  // Subscribe to CameraManager updates
  useEffect(() => {
    const unsub = GlobalCameraManager.subscribe({
      onStreamReady: (newStream) => {
        setStream(newStream);
      },
    });
    return unsub;
  }, []);

  // Handle visibility changes gracefully
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        SoundEffects.stopDwellSound();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleStart = async (
    isVRMode: boolean,
    useSimulation: boolean,
    gameMode: GameMode = 'timed'
  ) => {
    setActiveMode('game');
    // 1. Request orientation sensor permission on user click gesture (critical for iOS)
    await GlobalOrientationManager.requestSensorPermission();

    // 2. Start camera feed or simulated desktop feed
    if (useSimulation) {
      GlobalCameraManager.startSimulatedFeed();
    } else {
      const success = await GlobalCameraManager.startCamera();
      if (!success) {
        const errorMsg = GlobalCameraManager.getErrorMessage();
        throw new Error(errorMsg || 'Unable to open camera stream.');
      }
    }

    // 3. Start game state with selected mode
    GameState.startGame(isVRMode, gameMode);

    // 4. Safely attempt fullscreen and landscape orientation lock when supported (Android / WebXR browsers)
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      const screenAny = window.screen as unknown as { orientation?: { lock?: (m: string) => Promise<void> } };
      if (screenAny?.orientation?.lock) {
        await screenAny.orientation.lock('landscape');
      }
    } catch {
      // Gracefully handled: iOS Safari and desktop browsers do not allow orientation locking
    }
  };

  const handleStartVisionMode = async () => {
    // Start camera (or simulated fallback) and launch vision explorer
    let hasStream = !!GlobalCameraManager.getStream();
    if (!hasStream) {
      const success = await GlobalCameraManager.startCamera();
      if (!success) {
        GlobalCameraManager.startSimulatedFeed();
      }
    }
    setActiveMode('vision');
    GameState.startGame(false, 'practice');
  };

  const handleExit = () => {
    // Clean up hardware resources and audio
    GlobalCameraManager.stopCameraTracks();
    GlobalOrientationManager.stopSensorListeners();
    SoundEffects.cleanup();
    GameState.exitGame();
    setActiveMode('game');
    setStream(null);

    // Safely exit fullscreen if active
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <main className="w-screen h-screen overflow-hidden bg-black text-white select-none">
      {gameStats.status === 'playing' || gameStats.status === 'complete' ? (
        activeMode === 'vision' ? (
          <AIVisionExplorer
            stream={stream}
            onReturnToGame={() => setActiveMode('game')}
          />
        ) : (
          <VRGameView
            stream={stream}
            onExit={handleExit}
            onOpenVisionMode={() => setActiveMode('vision')}
          />
        )
      ) : (
        <StartScreen
          onStart={handleStart}
          onStartVisionMode={handleStartVisionMode}
          bestScore={gameStats.bestScore}
        />
      )}
    </main>
  );
}
