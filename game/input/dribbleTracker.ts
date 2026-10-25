import { FilesetResolver, PoseLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

// MediaPipe pose landmark indices (the 33-point model).
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

/** Live, framework-agnostic signals read from the player's body. Grows as we add moves. */
export interface DribbleSignals {
  // Averaged hip y in [0,1]. Larger = hips lower in frame = deeper stance. null if no pose.
  hipHeight: number | null;
}

export interface DribbleTracker {
  /** Latest signals. Returns a stable object; read its fields each frame. */
  getSignals(): DribbleSignals;
  destroy(): void;
}

export interface DribbleTrackerOptions {
  video: HTMLVideoElement;
  /** If provided, the pose skeleton is drawn onto it (for the CV page / debugging). */
  canvas?: HTMLCanvasElement | null;
}

/**
 * Loads the MediaPipe pose model and runs a detection loop on the given video, updating a
 * signals object every frame. Both the CV page and the game read from one of these — the
 * game loop just samples getSignals() at its own rate (CV may update slower; that's fine).
 */
export async function createDribbleTracker(
  opts: DribbleTrackerOptions,
): Promise<DribbleTracker> {
  const { video, canvas } = opts;

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm",
  );
  const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numPoses: 1,
  });

  const ctx = canvas ? canvas.getContext("2d") : null;
  const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

  const signals: DribbleSignals = { hipHeight: null };

  // Light exponential smoothing on hip height — tames per-frame jitter so stance zones
  // don't flicker, at the cost of a little latency (~2 frames). Higher = more responsive.
  const HIP_SMOOTHING = 0.5;
  let smoothedHip: number | null = null;

  let animationId = 0;
  let lastVideoTime = -1;
  let stopped = false;

  function loop() {
    if (!stopped && video.videoWidth > 0 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;

      const result = poseLandmarker.detectForVideo(video, performance.now());

      // Optional skeleton drawing.
      if (canvas && ctx && drawingUtils) {
        if (canvas.width !== video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const landmarks of result.landmarks) {
          drawingUtils.drawLandmarks(landmarks, { radius: 4 });
          drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS);
        }
      }

      // Signals.
      if (result.landmarks.length > 0) {
        const pose = result.landmarks[0];
        const raw = (pose[LEFT_HIP].y + pose[RIGHT_HIP].y) / 2;
        smoothedHip =
          smoothedHip === null ? raw : smoothedHip + HIP_SMOOTHING * (raw - smoothedHip);
        signals.hipHeight = smoothedHip;
      } else {
        smoothedHip = null;
        signals.hipHeight = null;
      }
    }
    animationId = requestAnimationFrame(loop);
  }

  loop();

  return {
    getSignals: () => signals,
    destroy: () => {
      stopped = true;
      cancelAnimationFrame(animationId);
      poseLandmarker.close();
    },
  };
}
