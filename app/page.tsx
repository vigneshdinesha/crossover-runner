'use client'

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createDribbleTracker, type DribbleTracker } from "@/game/input/dribbleTracker";
import {
  type Calibration,
  type StanceLevel,
  makeCalibration,
  classifyStance,
  saveCalibration,
  loadCalibration,
} from "@/game/input/calibration";

const calBtnStyle: CSSProperties = {
  padding: "16px 28px",
  fontSize: 18,
  fontWeight: 600,
  borderRadius: 10,
  border: "none",
  background: "#ff4655",
  color: "#fff",
  cursor: "pointer",
};

// Colors + labels per stance zone for the live indicator.
const STANCE_UI: Record<StanceLevel, { label: string; bg: string }> = {
  tall: { label: "TOO TALL — get low", bg: "#dc2626" },
  ready: { label: "READY", bg: "#16a34a" },
  duck: { label: "DUCK", bg: "#2563eb" },
};

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Debug overlay (dev only): shows the live hip-height signal.
  const [debugHip, setDebugHip] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  // Calibration state.
  const trackerRef = useRef<DribbleTracker | null>(null);
  const [cal, setCal] = useState<Calibration | null>(null);
  const [capturing, setCapturing] = useState(false);

  // --- Pose tracking via the shared DribbleTracker ---
  useEffect(() => {
    let tracker: DribbleTracker | null = null;
    let cancelled = false;
    let pollId = 0;

    async function start() {
      try {
        tracker = await createDribbleTracker({
          video: videoRef.current!,
          canvas: canvasRef.current,
        });
        if (cancelled) {
          tracker.destroy();
          tracker = null;
          return;
        }
        trackerRef.current = tracker;
        pollId = window.setInterval(() => {
          setDebugHip(tracker!.getSignals().hipHeight);
        }, 100);
      } catch (err) {
        console.error("Pose setup failed", err);
        setError("Could not start pose detection.");
      }
    }
    start();

    return () => {
      cancelled = true;
      clearInterval(pollId);
      tracker?.destroy();
      tracker = null;
      trackerRef.current = null;
    };
  }, []);

  // Load any saved calibration on mount (localStorage is client-only).
  useEffect(() => {
    setCal(loadCalibration());
  }, []);

  // Sample the live hip height for ~1.5s, average it, and build the calibration.
  async function captureStance() {
    const tracker = trackerRef.current;
    if (!tracker || capturing) return;
    setCapturing(true);

    const samples: number[] = [];
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const id = window.setInterval(() => {
        const h = tracker.getSignals().hipHeight;
        if (h !== null) samples.push(h);
        if (performance.now() - start >= 1500) {
          clearInterval(id);
          resolve();
        }
      }, 50);
    });

    setCapturing(false);
    if (samples.length === 0) return; // no pose detected during the window
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const c = makeCalibration(avg);
    setCal(c);
    saveCalibration(c);
  }

  const stance = classifyStance(debugHip, cal);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }

  // --- Dev debug overlay toggle: press "D" to show/hide ---
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "d" || e.key === "D") setShowDebug((v) => !v);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // --- Camera: request the webcam and stream it into the <video> ---
  useEffect(() => {
    let localStream: MediaStream | null = null;

    async function startCamera() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }
      } catch (err) {
        console.error("could not access media devices", err);
        setError("could not access the camera, check device permissions");
      }
    }

    startCamera();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#000" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
          pointerEvents: "none", // passive overlay — never intercept clicks
        }}
      />

      {showDebug && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            padding: "10px 14px",
            background: "rgba(0, 0, 0, 0.6)",
            color: "#0f0",
            font: "16px monospace",
            borderRadius: "8px",
            pointerEvents: "none",
          }}
        >
          hipY: {debugHip === null ? "— (no pose)" : debugHip.toFixed(3)}
          <br />
          <span style={{ color: "#aaa" }}>press D to hide</span>
        </div>
      )}

      {/* Live stance indicator (driven by calibration) */}
      {cal && (
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            padding: "10px 18px",
            borderRadius: "8px",
            font: "700 20px system-ui, sans-serif",
            background: STANCE_UI[stance].bg,
            color: "#fff",
            pointerEvents: "none",
          }}
        >
          {STANCE_UI[stance].label}
        </div>
      )}

      <button
        onClick={toggleFullscreen}
        style={{
          position: "absolute",
          top: cal ? 64 : 16,
          right: 16,
          padding: "10px 16px",
          fontSize: 15,
          borderRadius: 8,
          border: "none",
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        ⛶ Fullscreen
      </button>

      {error && (
        <p
          style={{
            position: "absolute",
            top: 72,
            left: 16,
            color: "#fff",
            background: "crimson",
            padding: "8px 12px",
            borderRadius: 6,
            font: "15px system-ui, sans-serif",
          }}
        >
          {error}
        </p>
      )}

      {/* Calibration panel — large, floating over the camera at the bottom */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 28,
          transform: "translateX(-50%)",
          width: "min(92vw, 580px)",
          padding: 24,
          borderRadius: 14,
          background: "rgba(0,0,0,0.72)",
          color: "#fff",
          font: "16px system-ui, sans-serif",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Stance calibration</div>
        <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 16 }}>
          Get into your athletic dribbling stance — knees bent, hips low — and hold while capturing.
          This becomes your <strong>READY</strong> baseline.
        </div>
        <button onClick={captureStance} disabled={capturing} style={calBtnStyle}>
          {capturing ? "Hold your stance…" : cal ? "Re-capture stance" : "Capture dribble stance"}
        </button>
        <div style={{ marginTop: 18, font: "15px monospace", opacity: 0.9 }}>
          {cal === null ? (
            "not calibrated yet"
          ) : (
            <>
              ready: {cal.ready.toFixed(3)} · tall&lt;{cal.tallThreshold.toFixed(3)} · duck≥
              {cal.duckThreshold.toFixed(3)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
