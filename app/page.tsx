'use client'

import { useRef, useEffect, useState } from "react";
import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

export default function Home() {

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Pose detection: load the model once, then draw the skeleton every frame ---
  useEffect(() => {
    let poseLandmarker: PoseLandmarker | null = null;
    let animationId = 0;
    let cancelled = false; // guard: setup is async and may finish after unmount

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm"
      );

      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });

      // If the component unmounted while the model was downloading, bail out cleanly.
      if (cancelled) {
        poseLandmarker.close();
        return;
      }

      const video = videoRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const drawingUtils = new DrawingUtils(ctx);

      let lastVideoTime = -1;

      function renderLoop() {
        // Only run detection when the video has advanced to a NEW frame.
        if (video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;

          // Size the drawing buffer to the real video resolution (once).
          // Without this the canvas stays 300x150 and the skeleton misaligns.
          if (canvas.width !== video.videoWidth) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          // Ask: where is the body in this frame? (synchronous in VIDEO mode)
          const result = poseLandmarker!.detectForVideo(video, performance.now());

          // Clear last frame's skeleton first, or trails smear.
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          for (const landmarks of result.landmarks) {
            drawingUtils.drawLandmarks(landmarks, { radius: 4 });
            drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS);
          }
        }

        animationId = requestAnimationFrame(renderLoop); // schedule next frame
      }

      renderLoop(); // kick it off
    }

    setup().catch((err) => {
      console.error("Pose setup failed", err);
      setError("Could not start pose detection.");
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      poseLandmarker?.close();
    };
  }, []);

  // --- Camera: request the webcam and stream it into the <video> ---
  useEffect(() => {
    // Keep track of stream instance for component cleanup
    let localStream: MediaStream | null = null;

    async function startCamera() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

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
    <div style={{ position: "relative", width: "100%", maxWidth: "640px" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          display: "block",
          borderRadius: "8px",
          transform: "scaleX(-1)", // mirror so it reads like a mirror
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0, // pin to the same corner as the video
          left: 0,
          width: "100%",
          height: "100%",
          transform: "scaleX(-1)", // mirror the canvas the SAME way as the video
        }}
      />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
