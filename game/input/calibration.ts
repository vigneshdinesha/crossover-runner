// Per-player STANCE calibration.
//
// Reframed (2026-10-24): a low athletic stance is the *baseline* a ball-handler holds the
// whole time — not an occasional crouch. We calibrate that one "ready" stance; standing up
// out of it is TALL (discouraged, soft-penalized in game), and dropping much lower is DUCK
// (the deliberate get-under-it move). Hip-y is larger when hips are lower, so:
//   TALL   hipY <  tallThreshold        (hips too high — you popped up)
//   READY  tallThreshold ≤ hipY < duck  (athletic stance — where you should live)
//   DUCK   hipY ≥  duckThreshold         (dropped even lower)

export type StanceLevel = "tall" | "ready" | "duck";

export interface Calibration {
  ready: number; // captured athletic-stance hip y
  tallThreshold: number; // below this (hips higher) = TALL
  duckThreshold: number; // at/above this (hips lower) = DUCK
}

const STORAGE_KEY = "crossover-calibration-v2";

// How far above the ready stance counts as "standing up", and how far below counts as a duck.
// TALL_MARGIN is deliberately small: rising even a little out of your stance should flag TALL.
export const TALL_MARGIN = 0.03;
export const DUCK_OFFSET = 0.07;

export function makeCalibration(ready: number): Calibration {
  return {
    ready,
    tallThreshold: ready - TALL_MARGIN,
    duckThreshold: ready + DUCK_OFFSET,
  };
}

/** Classify the current hip height into a stance zone. No reading / no calibration = TALL. */
export function classifyStance(hipHeight: number | null, cal: Calibration | null): StanceLevel {
  if (cal === null || hipHeight === null) return "tall";
  if (hipHeight >= cal.duckThreshold) return "duck";
  if (hipHeight < cal.tallThreshold) return "tall";
  return "ready";
}

export function saveCalibration(cal: Calibration): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cal));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

export function loadCalibration(): Calibration | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.ready === "number" &&
      typeof parsed?.tallThreshold === "number" &&
      typeof parsed?.duckThreshold === "number"
    ) {
      return parsed as Calibration;
    }
    return null;
  } catch {
    return null;
  }
}
