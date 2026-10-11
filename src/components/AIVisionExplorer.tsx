/**
 * AIVisionExplorer Component
 * Optional AI-assisted educational learning mode outside the active target game loop.
 * Enables deliberate single-frame capture, explicit user confirmation before transmission,
 * and structured STEM object insights using Gemini 3.8 Flash without continuous streaming.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Info,
  Loader2,
  RefreshCw,
  Target,
  ShieldCheck,
} from 'lucide-react';
import { SoundEffects } from '../services/SoundEffects';

interface DetectedObject {
  name: string;
  detail: string;
}

interface VisionAnalysis {
  sceneSummary: string;
  detectedObjects: DetectedObject[];
  educationalFacts: string[];
  discoveryChallenge: string;
}

interface AIVisionExplorerProps {
  stream: MediaStream | null;
  onReturnToGame: () => void;
}

type VisionStep = 'viewfinder' | 'confirm' | 'analyzing' | 'results' | 'error';

export const AIVisionExplorer: React.FC<AIVisionExplorerProps> = ({
  stream,
  onReturnToGame,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<VisionStep>('viewfinder');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<VisionAnalysis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<{ available: boolean; message: string } | null>(null);

  // Synchronize stream with viewfinder video
  useEffect(() => {
    if (videoRef.current && stream) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [stream]);

  // Check server-side vision availability on mount
  useEffect(() => {
    fetch('/api/vision-status')
      .then((res) => res.json())
      .then((data) => setServerStatus(data))
      .catch(() => {
        setServerStatus({
          available: false,
          message: 'Could not contact server vision endpoint.',
        });
      });
  }, []);

  /**
   * Capture a single still frame from the local video stream.
   * Does NOT send anything over the network yet.
   */
  const handleCaptureSnapshot = () => {
    SoundEffects.playButtonClick();
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setCapturedImage(dataUrl);
    setStep('confirm');
  };

  /**
   * User explicitly confirms that this single snapshot may be transmitted to the server.
   */
  const handleConfirmAndAnalyze = async () => {
    if (!capturedImage) return;

    SoundEffects.playButtonClick();
    setStep('analyzing');
    setErrorMessage('');

    try {
      const response = await fetch('/api/vision-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: capturedImage,
          mimeType: 'image/jpeg',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server reported an error during AI analysis.');
      }

      setAnalysis(data.analysis);
      setStep('results');
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to complete vision analysis.');
      setStep('error');
    }
  };

  const handleRetake = () => {
    SoundEffects.playButtonClick();
    setCapturedImage(null);
    setAnalysis(null);
    setStep('viewfinder');
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-[#030508] text-neutral-100 flex flex-col overflow-hidden select-none">
      {/* Top Navigation Bar */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              SoundEffects.playButtonClick();
              onReturnToGame();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-hud text-neutral-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>RETURN TO GAME</span>
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs font-hud">
            <span className="text-red-400 font-semibold">AI VISION EXPLORER</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-400">Single Snapshot Learning</span>
          </div>
        </div>

        {/* Server status pill */}
        <div className="flex items-center gap-2 text-xs font-hud">
          {serverStatus?.available ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              GEMINI 3.8 FLASH READY
            </span>
          ) : (
            <span className="text-amber-400/80 text-[11px] flex items-center gap-1">
              <Info className="w-3 h-3" />
              FREE-TIER MODE
            </span>
          )}
        </div>
      </header>

      {/* Main Interactive Stage */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden p-2 sm:p-4">
        {/* Step 1: Live Viewfinder */}
        {step === 'viewfinder' && (
          <div className="relative w-full max-w-3xl h-full max-h-[85vh] rounded-3xl overflow-hidden border border-neutral-800 bg-black flex flex-col items-center justify-center shadow-2xl">
            {/* Live Camera Stream Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Dark lens vignette & sci-fi scanning reticle */}
            <div className="absolute inset-0 vr-vignette pointer-events-none" />

            {/* Central Target Guide Frame */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
              <div className="relative w-64 h-64 sm:w-80 sm:h-80 border border-red-500/40 rounded-2xl flex flex-col items-center justify-between p-3">
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-red-400" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-red-400" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-red-400" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-red-400" />

                <span className="font-hud text-[10px] text-red-300 uppercase tracking-widest bg-black/60 px-2 py-0.5 rounded border border-red-500/30">
                  ALIGN OBJECTS IN FRAME
                </span>

                <div className="w-2 h-2 rounded-full bg-red-500/80 shadow-[0_0_8px_#ff2a4b]" />

                <span className="font-hud text-[9px] text-neutral-400 uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded">
                  SINGLE STILL CAPTURE ONLY
                </span>
              </div>
            </div>

            {/* Bottom Floating Capture Controls */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 z-20 px-4">
              <button
                onClick={handleCaptureSnapshot}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-hud font-semibold text-sm tracking-wider shadow-xl shadow-red-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>CAPTURE STILL FOR ANALYSIS</span>
              </button>
              <span className="text-[11px] font-hud text-neutral-400 bg-black/60 px-3 py-1 rounded-full border border-neutral-800">
                You will review and confirm this frame before sending to Gemini.
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation Modal & Freeze Frame Review */}
        {step === 'confirm' && capturedImage && (
          <div className="relative z-30 w-full max-w-lg bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center text-center max-h-[90vh] overflow-y-auto">
            <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-500/40 flex items-center justify-center text-red-400 mb-3">
              <CheckCircle2 className="w-5 h-5" />
            </div>

            <h2 className="text-xl font-hud font-bold text-white tracking-wide">
              CONFIRM FRAME ANALYSIS
            </h2>
            <p className="mt-1 text-xs text-neutral-400 max-w-sm">
              Please review your captured frame before sending. Only this single static image will be transmitted to the Gemini vision model.
            </p>

            {/* Frozen Frame Preview */}
            <div className="mt-4 relative w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-neutral-800 bg-black">
              <img
                src={capturedImage}
                alt="Captured still frame"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/70 border border-neutral-800 text-[10px] font-hud text-neutral-300">
                FROZEN CAPTURE
              </div>
            </div>

            {/* Privacy Safeguards Statement */}
            <div className="mt-4 p-3 rounded-xl bg-neutral-900/70 border border-neutral-800 text-left text-[11px] text-neutral-300 flex flex-col gap-1.5 w-full">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold font-hud text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy & Safety Directives:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-neutral-400 text-[11px]">
                <li>No continuous camera streaming or recording.</li>
                <li>Will not identify people or infer sensitive personal traits.</li>
                <li>Visual estimates only; no spatial anchoring or depth map claims.</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div className="mt-5 flex items-center gap-3 w-full">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-hud text-xs transition-colors"
              >
                RETAKE FRAME
              </button>
              <button
                onClick={handleConfirmAndAnalyze}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-hud font-semibold text-xs tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>CONFIRM & ANALYZE</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Analyzing State */}
        {step === 'analyzing' && (
          <div className="relative z-30 w-full max-w-sm bg-neutral-950/90 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-4" />
            <h3 className="text-lg font-hud font-bold text-white tracking-wide">
              ANALYZING WITH GEMINI
            </h3>
            <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
              Identifying visible ordinary objects and compiling STEM educational facts...
            </p>
            <span className="mt-4 font-hud text-[10px] text-neutral-500">
              MODEL: GEMINI-3.8-FLASH (FREE-TIER)
            </span>
          </div>
        )}

        {/* Step 4: Results Display */}
        {step === 'results' && analysis && (
          <div className="relative z-30 w-full max-w-2xl bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col text-left max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-red-400" />
                <h3 className="font-hud font-bold text-lg text-white tracking-wide">
                  EDUCATIONAL VISION REPORT
                </h3>
              </div>
              <span className="font-hud text-xs text-neutral-400">
                GEMINI 3.8 FLASH
              </span>
            </div>

            {/* Scene Summary */}
            <p className="mt-4 text-xs sm:text-sm text-neutral-300 leading-relaxed italic bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80">
              "{analysis.sceneSummary}"
            </p>

            {/* Detected Objects Section */}
            <div className="mt-4">
              <h4 className="font-hud text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                Visible Objects Identified
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {analysis.detectedObjects.map((obj, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1"
                  >
                    <span className="font-hud text-xs font-bold text-white">
                      {obj.name}
                    </span>
                    <span className="text-[11px] text-neutral-400 leading-snug">
                      {obj.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Educational / STEM Facts */}
            <div className="mt-5">
              <h4 className="font-hud text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
                STEM & Scientific Insights
              </h4>
              <div className="space-y-2">
                {analysis.educationalFacts.map((fact, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800/80 flex items-start gap-2.5 text-xs text-neutral-300 leading-normal"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>{fact}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Challenge */}
            {analysis.discoveryChallenge && (
              <div className="mt-5 p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 flex flex-col gap-1">
                <span className="font-hud text-xs font-bold text-red-300 tracking-wider">
                  LEARNING DISCOVERY CHALLENGE
                </span>
                <p className="text-xs text-neutral-300">
                  {analysis.discoveryChallenge}
                </p>
              </div>
            )}

            {/* Technical Disclaimer Notice */}
            <div className="mt-4 pt-3 border-t border-neutral-900 text-[10px] text-neutral-500 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-neutral-400" />
              <span>
                Observations are 2D visual intelligence estimates and do not provide metric 3D coordinates, exact physical depth, or spatial anchoring.
              </span>
            </div>

            {/* Footer Navigation */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleRetake}
                className="flex-1 py-3 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-hud text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ANALYZE ANOTHER FRAME</span>
              </button>
              <button
                onClick={() => {
                  SoundEffects.playButtonClick();
                  onReturnToGame();
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-hud font-semibold text-xs tracking-wider shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5"
              >
                <Target className="w-3.5 h-3.5" />
                <span>RETURN TO TARGET GAME</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Error / Quota Fallback */}
        {step === 'error' && (
          <div className="relative z-30 w-full max-w-md bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-500/50 flex items-center justify-center text-red-400 mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>

            <h3 className="text-lg font-hud font-bold text-white tracking-wide">
              AI VISION NOTICE
            </h3>
            <p className="mt-2 text-xs text-neutral-300 leading-relaxed bg-red-950/30 border border-red-500/30 p-3 rounded-xl text-left">
              {errorMessage || 'Could not complete frame analysis.'}
            </p>

            <p className="mt-3 text-[11px] text-neutral-400">
              The core RealityPlay VR target practice game remains 100% playable regardless of AI availability or quota.
            </p>

            <div className="mt-5 flex items-center gap-3 w-full">
              <button
                onClick={handleRetake}
                className="flex-1 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-hud text-xs transition-colors"
              >
                RETRY CAPTURE
              </button>
              <button
                onClick={() => {
                  SoundEffects.playButtonClick();
                  onReturnToGame();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-hud font-semibold text-xs tracking-wider transition-all"
              >
                RETURN TO GAME
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
