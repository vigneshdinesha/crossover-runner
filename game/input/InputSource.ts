import type { InputState } from "@/game/sim";

/**
 * The seam that makes the whole project work. The game loop calls `sample()` once per
 * frame and gets back an InputState — it never knows or cares whether that came from the
 * keyboard or from computer vision. Feature #5 adds a second implementation (dribbling)
 * without touching the simulation or renderer.
 */
export interface InputSource {
  sample(): InputState;
  destroy(): void;
}

const IDLE: InputState = { lane: 0, crouch: false, jump: false, dash: false, tempo: 0 };

/**
 * Placeholder source: always returns neutral input, so the runner just sits in lane 0.
 * Lets us wire and verify the render loop before the real keyboard source lands (step 4.4).
 */
export function createIdleInput(): InputSource {
  return {
    sample: () => IDLE,
    destroy: () => {},
  };
}
