import type { InputState } from "@/game/sim";
import type { InputSource } from "./InputSource";

// Keyboard has no dribble tempo, so we feed a fixed mid value; it drives scroll speed
// once obstacles exist (step 4.5). Visuals don't depend on it yet.
const DEFAULT_TEMPO = 0.6;

/**
 * Keyboard control for development. Maps keys onto the same InputState the CV source will
 * later produce:
 *   ← / A  → crossover to the LEFT lane (lane 0)   — latched: you stay until you cross back
 *   → / D  → crossover to the RIGHT lane (lane 1)
 *   ↓ / S  → crouch (held)
 */
export function createKeyboardInput(): InputSource {
  let lane: 0 | 1 = 0;
  let crouch = false;

  function onKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        lane = 0;
        e.preventDefault();
        break;
      case "ArrowRight":
      case "d":
      case "D":
        lane = 1;
        e.preventDefault();
        break;
      case "ArrowDown":
      case "s":
      case "S":
        crouch = true;
        e.preventDefault();
        break;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
      case "s":
      case "S":
        crouch = false;
        break;
    }
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    sample: (): InputState => ({
      lane,
      crouch,
      jump: false, // wired post-MVP
      dash: false, // wired post-MVP
      tempo: DEFAULT_TEMPO,
    }),
    destroy: () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
