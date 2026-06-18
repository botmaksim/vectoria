/**
 * @file plotterData.ts
 * @brief Mathematical rendering utilities for explicit complex transformations.
 *
 * Provides global routines for Discrete Fourier Transforms, Voronoi partitions
 * and Delaunay triangulations integrated with the HTML5 Canvas environment.
 * @param t
 */
import type { Camera } from "./camera";
import { Delaunay } from "d3-delaunay";

const fourierCache = new Map<
  string,
  { coeffs: { freq: number; r: number; phase: number }[]; hash: number }
>();

/**
 * @brief Approximates and visualizes a shape using epicycles via the Discrete Fourier Transform.
 * @param ctx The 2D rendering context.
 * @param camera Viewport camera state.
 * @param dataList The source collection of coordinates.
 * @param color Stroke and point color.
 * @param width Viewport width.
 * @param height Viewport height.
 * @param time Continuous or discrete time value (t).
 * @param id Unique identifier to cache frequency coefficients.
 * @return Active endpoint vector tracked for rendering traces.
 */
export function plotFourier(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  dataList: any[],
  color: string,
  width: number,
  height: number,
  time: number,
  id: string,
) {
  if (!dataList || dataList.length === 0) return;

  let pts: { x: number; y: number }[] = [];
  let stateHash = 0;
  for (const item of dataList) {
    if (item && typeof item.x === "number" && typeof item.y === "number") {
      pts.push(item);
      stateHash += (item.x + item.y) * pts.length;
    } else if (Array.isArray(item) && item.length >= 2) {
      pts.push({ x: item[0], y: item[1] });
      stateHash += (item[0] + item[1]) * pts.length;
    }
  }

  const N = pts.length;
  if (N === 0) return;

  let cached = fourierCache.get(id);
  let coeffs = cached?.coeffs;
  let cachedHash = cached?.hash;

  if (!coeffs || cachedHash !== stateHash) {
    coeffs = [];
    for (let k = 0; k < N; k++) {
      let re = 0,
        im = 0;
      for (let n = 0; n < N; n++) {
        const angle = (2 * Math.PI * k * n) / N;
        re += pts[n].x * Math.cos(angle) + pts[n].y * Math.sin(angle);
        im += -pts[n].x * Math.sin(angle) + pts[n].y * Math.cos(angle);
      }
      re /= N;
      im /= N;
      const r = Math.sqrt(re * re + im * im);
      const phase = Math.atan2(im, re);
      coeffs.push({ freq: k, r, phase });
    }

    coeffs.sort((a, b) => b.r - a.r);
    fourierCache.set(id, { coeffs, hash: stateHash } as any);
  }

  let x = 0;
  let y = 0;

  ctx.lineWidth = 1;

  const t = (time % 10) / 10;

  for (const c of coeffs) {
    const prevX = x;
    const prevY = y;

    const angle = c.freq * t * Math.PI * 2 + c.phase;
    x += c.r * Math.cos(angle);
    y += c.r * Math.sin(angle);

    ctx.strokeStyle = `rgba(150, 150, 150, 0.3)`;
    const c1Sc = camera.mathToScreen(prevX, prevY, width, height);

    const radSc =
      camera.mathToScreen(prevX + c.r, prevY, width, height).x - c1Sc.x;
    if (radSc > 0.5) {
      ctx.beginPath();
      ctx.arc(c1Sc.x, c1Sc.y, radSc, 0, Math.PI * 2);
      ctx.stroke();
    }

    const c2Sc = camera.mathToScreen(x, y, width, height);
    ctx.beginPath();
    ctx.moveTo(c1Sc.x, c1Sc.y);
    ctx.lineTo(c2Sc.x, c2Sc.y);
    ctx.stroke();
  }

  const headSc = camera.mathToScreen(x, y, width, height);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(headSc.x, headSc.y, 3, 0, Math.PI * 2);
  ctx.fill();

  return { x, y };
}

/**
 * @brief Flattens structural multi-format data arrays into sequential coordinate arrays.
 * @param dataList Array of mapped point data structures.
 * @return Flattended geometry array for layout algorithms.
 * @param dataList:any
 */
function processPoints(dataList: any[]) {
  let flatPts: number[] = [];
  for (const item of dataList) {
    if (item && typeof item.x === "number" && typeof item.y === "number") {
      flatPts.push(item.x, item.y);
    } else if (Array.isArray(item) && item.length >= 2) {
      flatPts.push(item[0], item[1]);
    }
  }
  return flatPts;
}

/**
 * @brief Renders a Voronoi diagram on the canvas.
 * @param ctx The 2D rendering context.
 * @param camera The camera defining the viewport math boundaries.
 * @param dataList Array of mapped point data structures.
 * @param color Stroke color.
 * @param width Canvas width in pixels.
 * @param height Canvas height in pixels.
 * @param ctx:CanvasRenderingContext2D
 * @param camera:Camera
 * @param dataList:any
 * @param color:string
 * @param width:number
 * @param height:number
 */
export function plotVoronoi(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  dataList: any[],
  color: string,
  width: number,
  height: number,
) {
  const pts = processPoints(dataList);
  if (pts.length < 4) return;

  const minMath = camera.screenToMath(0, height, width, height);
  const maxMath = camera.screenToMath(width, 0, width, height);

  const delaunay = new Delaunay(pts);
  const voronoi = delaunay.voronoi([
    minMath.x - 10,
    minMath.y - 10,
    maxMath.x + 10,
    maxMath.y + 10,
  ]);

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;

  ctx.beginPath();
  for (let i = 0; i < pts.length / 2; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly) continue;
    for (let j = 0; j < poly.length; j++) {
      const sc = camera.mathToScreen(poly[j][0], poly[j][1], width, height);
      if (j === 0) ctx.moveTo(sc.x, sc.y);
      else ctx.lineTo(sc.x, sc.y);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

/**
 * @brief Renders a Delaunay triangulation network on the canvas.
 * @param ctx The 2D rendering context.
 * @param camera The camera defining the viewport bounds.
 * @param dataList The target point geometry data.
 * @param color Stroke rendering color.
 * @param width View coordinate width.
 * @param height View coordinate height.
 */
export function plotDelaunay(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  dataList: any[],
  color: string,
  width: number,
  height: number,
) {
  const pts = processPoints(dataList);
  if (pts.length < 6) return;

  const delaunay = new Delaunay(pts);
  const triangles = delaunay.triangles;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  for (let i = 0; i < triangles.length; i += 3) {
    const t0 = triangles[i];
    const t1 = triangles[i + 1];
    const t2 = triangles[i + 2];
    const p0 = camera.mathToScreen(pts[t0 * 2], pts[t0 * 2 + 1], width, height);
    const p1 = camera.mathToScreen(pts[t1 * 2], pts[t1 * 2 + 1], width, height);
    const p2 = camera.mathToScreen(pts[t2 * 2], pts[t2 * 2 + 1], width, height);
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p0.x, p0.y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}
