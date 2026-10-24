'use client'

import { useEffect, useRef, useState } from "react";
import { Application } from "pixi.js";
import { createInitialState, update, type GameState, type GameStatus } from "@/game/sim";
import { createRenderer } from "@/game/render";
import type { InputSource } from "@/game/input/InputSource";
import { createKeyboardInput } from "@/game/input/keyboard";

// The playfield size (logical pixels). We'll make this responsive later.
const WIDTH = 400;
const HEIGHT = 600;

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  // The live game state lives in a ref (fast world); the loop reads/writes it every frame.
  const stateRef = useRef<GameState>(createInitialState());
  // A throttled snapshot for the HUD (slow world) — only what React needs to display.
  const [hud, setHud] = useState<{ score: number; status: GameStatus }>({
    score: 0,
    status: "playing",
  });

  useEffect(() => {
    stateRef.current = createInitialState(); // fresh game on (re)mount

    let app: Application | null = null;
    let input: InputSource | null = null;
    let destroyed = false; // Strict Mode guard (init is async, may finish after unmount)

    async function initPixi() {
      const pixiApp = new Application();
      await pixiApp.init({
        width: WIDTH,
        height: HEIGHT,
        background: "#12121c",
        antialias: true,
      });

      if (destroyed) {
        pixiApp.destroy(true, { children: true });
        return;
      }
      app = pixiApp;

      containerRef.current!.appendChild(app.canvas);
      app.canvas.style.display = "block"; // avoid the inline-element descender gap

      const renderer = createRenderer(app, WIDTH, HEIGHT);
      input = createKeyboardInput();
      const source = input;

      let lastHudSync = 0;
      let lastStatus: GameStatus = "playing";

      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime; // ~1.0 at 60fps; keeps speed frame-rate independent
        const state = update(stateRef.current, source.sample(), dt);
        stateRef.current = state;
        renderer.render(state);

        // Sync the HUD a few times a second, and immediately when status flips (game over).
        const now = performance.now();
        if (state.status !== lastStatus || now - lastHudSync > 150) {
          lastStatus = state.status;
          lastHudSync = now;
          setHud({ score: state.score, status: state.status });
        }
      });
    }

    initPixi();

    return () => {
      destroyed = true;
      input?.destroy(); // remove key listeners (otherwise Strict Mode leaks them)
      input = null;
      app?.destroy(true, { children: true });
      app = null;
    };
  }, []);

  function restart() {
    stateRef.current = createInitialState();
    setHud({ score: 0, status: "playing" });
  }

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div style={{ position: "relative", width: WIDTH, height: HEIGHT }}>
        <div ref={containerRef} />

        {/* Score (slow-world HUD) */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 12,
            color: "#fff",
            font: "600 20px system-ui, sans-serif",
            pointerEvents: "none",
          }}
        >
          {hud.score}
        </div>

        {/* Game-over overlay */}
        {hud.status === "over" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(0,0,0,0.55)",
            }}
          >
            <div style={{ textAlign: "center", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>Game Over</div>
              <div style={{ margin: "8px 0 18px", opacity: 0.85 }}>Score: {hud.score}</div>
              <button
                onClick={restart}
                style={{
                  padding: "10px 20px",
                  fontSize: 16,
                  cursor: "pointer",
                  borderRadius: 8,
                  border: "none",
                  background: "#ff4655",
                  color: "#fff",
                }}
              >
                Play again
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
