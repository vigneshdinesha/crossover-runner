import { describe, it, expect } from "vitest";
import {
  createInitialState,
  update,
  BASE_SPEED,
  SPEED_RANGE,
  type InputState,
} from "./sim";

// A neutral input: left lane, no moves, stopped tempo. Spread and override per test.
const idle: InputState = { lane: 0, crouch: false, jump: false, dash: false, tempo: 0 };

describe("createInitialState", () => {
  it("starts playing, in lane 0, at rest", () => {
    const s = createInitialState();
    expect(s.status).toBe("playing");
    expect(s.runner.lane).toBe(0);
    expect(s.runner.x).toBe(0);
    expect(s.runner.posture).toBe("run");
  });
});

describe("update — lane switching (the crossover)", () => {
  it("starts moving toward lane 1 but does not teleport in one frame", () => {
    const s = update(createInitialState(), { ...idle, lane: 1 }, 1);
    expect(s.runner.lane).toBe(1); // target updates immediately
    expect(s.runner.x).toBeGreaterThan(0); // ...but the visible position slides
    expect(s.runner.x).toBeLessThan(1);
  });

  it("eventually reaches the far lane exactly (snaps, no overshoot)", () => {
    let s = createInitialState();
    for (let i = 0; i < 100; i++) s = update(s, { ...idle, lane: 1 }, 1);
    expect(s.runner.x).toBe(1);
  });

  it("crossing back returns all the way to lane 0", () => {
    let s = createInitialState();
    for (let i = 0; i < 100; i++) s = update(s, { ...idle, lane: 1 }, 1);
    for (let i = 0; i < 100; i++) s = update(s, { ...idle, lane: 0 }, 1);
    expect(s.runner.lane).toBe(0);
    expect(s.runner.x).toBe(0);
  });

  it("scales movement by dt (bigger dt → farther in one frame)", () => {
    const base = createInitialState();
    const small = update(base, { ...idle, lane: 1 }, 0.5);
    const big = update(base, { ...idle, lane: 1 }, 2);
    expect(big.runner.x).toBeGreaterThan(small.runner.x);
  });
});

describe("update — posture", () => {
  it("crouch input sets crouch posture", () => {
    const s = update(createInitialState(), { ...idle, crouch: true }, 1);
    expect(s.runner.posture).toBe("crouch");
  });

  it("releasing crouch returns to run", () => {
    let s = update(createInitialState(), { ...idle, crouch: true }, 1);
    s = update(s, { ...idle, crouch: false }, 1);
    expect(s.runner.posture).toBe("run");
  });
});

describe("update — tempo drives speed", () => {
  it("tempo 0 → BASE_SPEED, tempo 1 → BASE_SPEED + SPEED_RANGE", () => {
    expect(update(createInitialState(), { ...idle, tempo: 0 }, 1).speed).toBe(BASE_SPEED);
    expect(update(createInitialState(), { ...idle, tempo: 1 }, 1).speed).toBe(
      BASE_SPEED + SPEED_RANGE,
    );
  });
});

describe("update — purity & status gate", () => {
  it("does not mutate the input state", () => {
    const s = createInitialState();
    const snapshotX = s.runner.x;
    update(s, { ...idle, lane: 1 }, 1);
    expect(s.runner.x).toBe(snapshotX); // original untouched
  });

  it("is a no-op when the game is over", () => {
    const over = { ...createInitialState(), status: "over" as const };
    const next = update(over, { ...idle, lane: 1 }, 1);
    expect(next).toBe(over); // same reference back, nothing changed
  });
});
