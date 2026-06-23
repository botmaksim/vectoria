/**
 * @file plotterVectorField.ts
 * @brief Hydrodynamics and Vector Field Visualizer.
 * @details Implements particle advection over a compiled continuous vector field to simulate fluid motion and curl.
 */
import type { Camera } from "./camera";

const PARTICLE_COUNT = 750;
let particles: { x: number; y: number; age: number }[] | null = null;
let lastWidth = 0;
let lastHeight = 0;

export function plotVectorField(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  vectorData: (
    x: number,
    y: number,
    scope: any,
  ) => { dx: number; dy: number } | null,
  color: string,
  width: number,
  height: number,
  scope: any,
  dt: number,
  odeSpawners: { x: number; y: number }[] = [],
) {
  if (!particles || width !== lastWidth || height !== lastHeight) {
    const mathWidth = width / camera.state.zoom;
    const mathHeight = height / camera.state.zoom;
    particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: camera.state.x + (Math.random() - 0.5) * mathWidth,
      y: camera.state.y + (Math.random() - 0.5) * mathHeight,
      age: Math.random() * 100,
    }));
    lastWidth = width;
    lastHeight = height;
  }

  const minMath = camera.screenToMath(0, height, width, height);
  const maxMath = camera.screenToMath(width, 0, width, height);

  /**
   * Perform Runge-Kutta 4th Order ODE Trajectory calculations
   */
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  for (const sp of odeSpawners) {
    ctx.beginPath();
    let cx = sp.x;
    let cy = sp.y;
    let sc = camera.mathToScreen(cx, cy, width, height);
    ctx.moveTo(sc.x, sc.y);

    let valid = true;
    for (let step = 0; step < 500 && valid; step++) {
      try {
        const h = 0.05;
        const k1 = vectorData(cx, cy, scope);
        if (!k1) { valid = false; break; }
        const k2 = vectorData(
          cx + 0.5 * h * k1.dx,
          cy + 0.5 * h * k1.dy,
          scope,
        );
        if (!k2) { valid = false; break; }
        const k3 = vectorData(
          cx + 0.5 * h * k2.dx,
          cy + 0.5 * h * k2.dy,
          scope,
        );
        if (!k3) { valid = false; break; }
        const k4 = vectorData(cx + h * k3.dx, cy + h * k3.dy, scope);
        if (!k4) { valid = false; break; }

        cx += (h / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx);
        cy += (h / 6) * (k1.dy + 2 * k2.dy + 2 * k3.dy + k4.dy);

        if (isNaN(cx) || isNaN(cy)) {
          valid = false;
          break;
        }

        let nextSc = camera.mathToScreen(cx, cy, width, height);
        ctx.lineTo(nextSc.x, nextSc.y);

        if (
          cx < minMath.x - 10 ||
          cx > maxMath.x + 10 ||
          cy < minMath.y - 10 ||
          cy > maxMath.y + 10
        ) {
          break;
        }
      } catch {
        valid = false;
      }
    }
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sc.x, sc.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = color;

  /**
   * Draw particles representing fluid advection continuously
   */
  for (const p of particles) {
    let v;
    try {
      v = vectorData(p.x, p.y, scope); if (Math.random() < 0.001) console.log("VECTOR DATA:", v);
      if (!v) continue;
    } catch {
      continue;
    }

    if (v && !isNaN(v.dx) && !isNaN(v.dy)) {
      const mag = Math.sqrt(v.dx * v.dx + v.dy * v.dy) + 0.001;
      const speed = Math.min(mag, 10.0);
      p.x += (v.dx / mag) * speed * dt;
      p.y += (v.dy / mag) * speed * dt;
      p.age += dt * 10;
    }

    if (
      p.x < minMath.x ||
      p.x > maxMath.x ||
      p.y < minMath.y ||
      p.y > maxMath.y ||
      p.age > 100
    ) {
      p.x = minMath.x + Math.random() * (maxMath.x - minMath.x);
      p.y = minMath.y + Math.random() * (maxMath.y - minMath.y);
      p.age = 0;
    }

    const sp = camera.mathToScreen(p.x, p.y, width, height);
    ctx.globalAlpha = Math.max(0, 1.0 - p.age / 100);

    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1.0;
}
