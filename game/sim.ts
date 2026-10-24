// Pure game simulation for Crossover Runner.
// NO Pixi, NO React, NO DOM — just data in, data out. This is the testable "brain".
// Positions are in abstract/normalized units so the simulation stays pixel-agnostic;
// the renderer maps these to actual screen pixels.

export type Lane = 0 | 1;
export type Posture = "run" | "crouch" | "jump";
export type ObstacleKind = "wall" | "lowbar" | "gap" | "token";
export type GameStatus = "ready" | "playing" | "over";

/** What the player is "asking for" this frame. Filled by an InputSource (keyboard or CV). */
export interface InputState {
  lane: Lane; // desired lane. keyboard: arrows. CV: ball hand (0 = left, 1 = right)
  crouch: boolean; // keyboard: down held. CV: hips below calibrated threshold
  jump: boolean; // edge-triggered (post-MVP: between-the-legs)
  dash: boolean; // edge-triggered (post-MVP: behind-the-back)
  tempo: number; // 0..1 → scroll speed. keyboard: fixed. CV: dribble BPM
}

export interface Obstacle {
  id: number;
  lane: Lane;
  y: number; // scrolls toward the runner (added in feature 4.5)
  kind: ObstacleKind;
}

export interface Runner {
  lane: Lane; // the target lane
  x: number; // eased position in lane-space (0..1); slides toward `lane`
  posture: Posture;
  jumpT: number; // jump progress (post-MVP)
}

export interface GameState {
  status: GameStatus;
  runner: Runner;
  obstacles: Obstacle[];
  speed: number; // derived from input.tempo
  score: number;
  combo: number;
  multiplier: number;
  beat: { bpm: number; phase: number };
}

// --- Tuning constants (tweak for game feel) ---
export const LANE_COUNT = 2;
export const LANE_SWITCH_SPEED = 0.15; // fraction of the lane gap closed per frame (dt = 1 ≈ 60fps)
export const BASE_SPEED = 3; // scroll speed at tempo 0
export const SPEED_RANGE = 5; // additional scroll speed at tempo 1

const DEFAULT_BPM = 90;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** A fresh game at the start of a run. */
export function createInitialState(): GameState {
  return {
    status: "playing",
    runner: { lane: 0, x: 0, posture: "run", jumpT: 0 },
    obstacles: [],
    speed: BASE_SPEED,
    score: 0,
    combo: 0,
    multiplier: 1,
    beat: { bpm: DEFAULT_BPM, phase: 0 },
  };
}

/**
 * Advance the world by one frame. Pure: returns a new state, never mutates the input.
 * `dt` is a frame-rate scalar (~1.0 at 60fps, from Pixi's ticker.deltaTime), so the game
 * runs at the same speed regardless of actual frame rate.
 */
export function update(state: GameState, input: InputState, dt: number): GameState {
  // Nothing moves unless we're playing (e.g. after game over).
  if (state.status !== "playing") return state;

  // Target lane from input, clamped to the valid range.
  const targetLane = clamp(input.lane, 0, LANE_COUNT - 1) as Lane;

  // Ease the runner toward its target lane. Linear step, capped so we never overshoot;
  // snap exactly onto the target once we're within one step (avoids endless tiny jitter).
  const step = LANE_SWITCH_SPEED * dt;
  const gap = targetLane - state.runner.x;
  const x = Math.abs(gap) <= step ? targetLane : state.runner.x + clamp(gap, -step, step);

  const posture: Posture = input.crouch ? "crouch" : "run";

  const speed = BASE_SPEED + clamp(input.tempo, 0, 1) * SPEED_RANGE;

  return {
    ...state,
    runner: { ...state.runner, lane: targetLane, x, posture },
    speed,
  };
}
