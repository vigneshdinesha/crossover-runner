import { Application, Graphics } from "pixi.js";
import { FIELD_HEIGHT, OBSTACLE_HEIGHT, type GameState } from "@/game/sim";

/**
 * The Renderer is a dumb mirror: it owns Pixi display objects and, each frame, updates
 * their look/position from GameState. It never decides game logic — if something is in the
 * wrong spot that's a render bug; if the wrong thing happened that's a simulation bug.
 */
export interface Renderer {
  render(state: GameState): void;
  destroy(): void;
}

// Runner visuals (pixels).
const RUNNER_W = 48;
const RUNNER_H = 64;
const RUNNER_BOTTOM_MARGIN = 100; // distance from the bottom edge to the runner's feet

export function createRenderer(app: Application, width: number, height: number): Renderer {
  // Map lane-space x (0..1 from the sim) to a pixel center. Two lanes: centers at 25% / 75%.
  const leftCenter = width * 0.25;
  const rightCenter = width * 0.75;
  const laneToPixelX = (laneSpaceX: number) =>
    leftCenter + (rightCenter - leftCenter) * laneSpaceX;

  const feetY = height - RUNNER_BOTTOM_MARGIN;

  // Field units (sim) → pixels (screen).
  const fieldToPixelY = (fieldY: number) => (fieldY / FIELD_HEIGHT) * height;

  // --- Static background: fill + a center divider between the two lanes ---
  const bg = new Graphics();
  bg.rect(0, 0, width, height).fill(0x12121c);
  bg.moveTo(width / 2, 0)
    .lineTo(width / 2, height)
    .stroke({ width: 2, color: 0x2a2a3c });
  app.stage.addChild(bg);

  // --- Obstacles (drawn below the runner, redrawn each frame) ---
  const obstacles = new Graphics();
  app.stage.addChild(obstacles);

  // --- The runner (on top, redrawn each frame from state) ---
  const runner = new Graphics();
  app.stage.addChild(runner);

  function drawObstacles(state: GameState) {
    const h = fieldToPixelY(OBSTACLE_HEIGHT);
    obstacles.clear();
    for (const o of state.obstacles) {
      const cx = laneToPixelX(o.lane);
      const top = fieldToPixelY(o.y);
      if (o.kind === "wall") {
        // A block filling the lane — you must be in the OTHER lane.
        const w = RUNNER_W * 1.4;
        obstacles.roundRect(cx - w / 2, top, w, h, 6).fill(0xffa502);
      } else {
        // A low bar spanning the whole field — you must crouch under it (can't sidestep).
        const w = width * 0.9;
        const barH = h * 0.5;
        obstacles.roundRect(width / 2 - w / 2, top + (h - barH) / 2, w, barH, 4).fill(0xffd32a);
      }
    }
  }

  function drawRunner(state: GameState) {
    const cx = laneToPixelX(state.runner.x);
    // Crouch = shorter, but feet stay planted (grow upward from feetY).
    const h = state.runner.posture === "crouch" ? RUNNER_H * 0.5 : RUNNER_H;

    runner.clear();
    runner.roundRect(cx - RUNNER_W / 2, feetY - h, RUNNER_W, h, 8).fill(0xff4655);
  }

  return {
    render(state) {
      drawObstacles(state);
      drawRunner(state);
    },
    destroy() {
      bg.destroy();
      obstacles.destroy();
      runner.destroy();
    },
  };
}
