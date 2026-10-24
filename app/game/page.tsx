'use client'

import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";

// The playfield size (logical pixels). We'll make this responsive later.
const WIDTH = 400;
const HEIGHT = 600;

export default function GamePage() {
  // The <div> we'll drop Pixi's <canvas> into.
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let app: Application | null = null;
    let destroyed = false; // Strict Mode guard (init is async, may finish after unmount)

    async function initPixi() {
      const pixiApp = new Application();

      // v8: init is async and must be awaited before using the app.
      await pixiApp.init({
        width: WIDTH,
        height: HEIGHT,
        background: "#12121c",
        antialias: true,
      });

      // If React tore us down while the above was awaiting, clean up and bail.
      if (destroyed) {
        pixiApp.destroy(true, { children: true });
        return;
      }
      app = pixiApp;

      // Attach Pixi's canvas (app.canvas in v8) into our div.
      containerRef.current!.appendChild(app.canvas);

      // Placeholder square, just to prove rendering works. Removed next step.
      const square = new Graphics().rect(WIDTH / 2 - 50, HEIGHT / 2 - 50, 100, 100).fill(0xff4655);
      app.stage.addChild(square);
    }

    initPixi();

    return () => {
      destroyed = true;
      // destroy(true, ...) also removes the canvas from the DOM.
      app?.destroy(true, { children: true });
      app = null;
    };
  }, []);

  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <div ref={containerRef} />
    </main>
  );
}
