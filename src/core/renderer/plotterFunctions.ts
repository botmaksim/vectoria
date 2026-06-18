import type { Camera } from "./camera";
import type { ThemeColors } from "./plotter";

function sampleRecursive(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  fn: (x: number, scope: any) => number,
  scope: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
  isFirst: boolean,
  depth: number,
) {
  const MAX_DEPTH = 8;
  const mathHeight =
    camera.screenToMath(0, 0, width, height).y -
    camera.screenToMath(0, height, width, height).y;

  if (Math.abs(y2 - y1) > mathHeight * 2) {
    const p2 = camera.mathToScreen(x2, y2, width, height);
    ctx.moveTo(p2.x, p2.y);
    return;
  }

  const xm = (x1 + x2) / 2;
  const ym = fn(xm, scope);

  if (isNaN(ym)) {
    const p2 = camera.mathToScreen(x2, y2, width, height);
    ctx.moveTo(p2.x, p2.y);
    return;
  }

  const interpolatedY = (y1 + y2) / 2;
  const pixelError = Math.abs(ym - interpolatedY) * camera.state.zoom;

  if (pixelError > 0.5 && depth < MAX_DEPTH) {
    sampleRecursive(
      ctx,
      camera,
      fn,
      scope,
      x1,
      y1,
      xm,
      ym,
      width,
      height,
      isFirst,
      depth + 1,
    );
    sampleRecursive(
      ctx,
      camera,
      fn,
      scope,
      xm,
      ym,
      x2,
      y2,
      width,
      height,
      false,
      depth + 1,
    );
  } else {
    const p1 = camera.mathToScreen(x1, y1, width, height);
    const p2 = camera.mathToScreen(x2, y2, width, height);

    if (isFirst) {
      ctx.moveTo(p1.x, p1.y);
    }
    ctx.lineTo(p2.x, p2.y);
  }
}

/**
 * @brief Renders an explicit mathematical function using adaptive curvature sampling (2nd derivative).
 */
export function plotAdaptive(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  fn: (x: number, scope: any) => any,
  color: string,
  width: number,
  height: number,
  scope: any,
  lw: number,
) {
  const testY = fn(0, scope);
  let arrLen = 1;
  let isArr = false;
  if (testY && testY.toArray) {
    isArr = true;
    arrLen = testY.toArray().length;
  } else if (Array.isArray(testY)) {
    isArr = true;
    arrLen = testY.length;
  }

  for (let j = 0; j < arrLen; j++) {
    const localFn = isArr
      ? (x: number, s: any) => {
          const res = fn(x, s);
          return res.toArray ? res.toArray()[j] : res[j];
        }
      : (fn as (x: number, s: any) => number);

    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();

    const minMath = camera.screenToMath(0, height, width, height);
    const maxMath = camera.screenToMath(width, 0, width, height);

    let x = minMath.x;
    let isFirst = true;

    // Base eps for derivative
    // Target pixel error
    const tolerance = 0.5 / camera.state.zoom;
    
    // Evaluate across the screen at regular intervals, then recursively subdivide
    const intervals = 200; // base resolution
    const dx = (maxMath.x - minMath.x) / intervals;
    
    for (let i = 0; i < intervals; i++) {
        const x1 = minMath.x + i * dx;
        const x2 = minMath.x + (i + 1) * dx;
        const y1 = localFn(x1, scope);
        const y2 = localFn(x2, scope);
        
        sampleRecursive(ctx, camera, localFn, scope, x1, y1, x2, y2, width, height, i === 0, 0);
    }

    ctx.stroke();
  }
}

/**
 * @brief Renders a parametric curve defined by x(t) and y(t).
 */
export function plotParametric(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  fn: (t: number, scope: any) => { x: any; y: any },
  color: string,
  width: number,
  height: number,
  scope: any,
  bounds: [number, number] = [0, 2 * Math.PI],
  lw: number,
) {
  try {
    const testP = fn(bounds[0], scope);
    const testX = testP.x?.toArray ? testP.x.toArray() : Array.isArray(testP.x) ? testP.x : [testP.x];
    const testY = testP.y?.toArray ? testP.y.toArray() : Array.isArray(testP.y) ? testP.y : [testP.y];
    const arrLen = Math.max(testX.length, testY.length);

    for (let j = 0; j < arrLen; j++) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();

      const segments = 500;
      const dt = (bounds[1] - bounds[0]) / segments;

      let isFirst = true;
      for (let i = 0; i <= segments; i++) {
        const val = bounds[0] + i * dt;
        try {
          const p = fn(val, scope);
          const pxArr = p.x?.toArray ? p.x.toArray() : Array.isArray(p.x) ? p.x : [p.x];
          const pyArr = p.y?.toArray ? p.y.toArray() : Array.isArray(p.y) ? p.y : [p.y];
          const x = pxArr[j % pxArr.length];
          const y = pyArr[j % pyArr.length];

          if (isNaN(x) || isNaN(y)) {
            isFirst = true;
            continue;
          }

          const screenP = camera.mathToScreen(x, y, width, height);

          if (isFirst) {
            ctx.moveTo(screenP.x, screenP.y);
            isFirst = false;
          } else {
            ctx.lineTo(screenP.x, screenP.y);
          }
        } catch (e) {
          isFirst = true; // Error evaluating this specific point
        }
      }
      ctx.stroke();
    }
  } catch (e) {
    // Initial evaluation failed
  }
}

/**
 * @brief Renders the visual representation of a definite integral.
 */
export function plotIntegral(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  fn: (x: number, scope: any) => any,
  boundsFn: (scope: any) => [number, number],
  color: string,
  width: number,
  height: number,
  scope: any,
  themeColors: ThemeColors,
) {
  const bounds = boundsFn(scope);
  if (isNaN(bounds[0]) || isNaN(bounds[1])) return;

  const minX = Math.min(bounds[0], bounds[1]);
  const maxX = Math.max(bounds[0], bounds[1]);

  const segments = 200;
  const dx = (maxX - minX) / segments;
  let area = 0;

  const scalarFn = (x: number) => {
    let res = fn(x, scope);
    if (Array.isArray(res) || res?.toArray) {
      res = Array.isArray(res) ? res[0] : res.toArray()[0];
    }
    return res as number;
  };

  for (let i = 1; i < segments; i++) {
    area += scalarFn(minX + i * dx) * (i % 2 === 0 ? 2 : 4);
  }
  area += scalarFn(minX) + scalarFn(maxX);
  area *= dx / 3;

  if (bounds[0] > bounds[1]) area = -area;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();

  let started = false;
  for (let i = 0; i <= segments; i++) {
    const x = minX + i * dx;
    const y = scalarFn(x);
    if (isNaN(y)) continue;

    const p = camera.mathToScreen(x, y, width, height);
    if (!started) {
      ctx.moveTo(
        camera.mathToScreen(x, 0, width, height).x,
        camera.mathToScreen(x, 0, width, height).y,
      );
      ctx.lineTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }

  if (started) {
    ctx.lineTo(
      camera.mathToScreen(maxX, 0, width, height).x,
      camera.mathToScreen(maxX, 0, width, height).y,
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  plotAdaptive(ctx, camera, fn, color, width, height, scope, 2);

  const textStr = `Area = ${area.toFixed(4)}`;
  ctx.font = "14px Inter, -apple-system, BlinkMacSystemFont, sans-serif";

  const metrics = ctx.measureText(textStr);
  const textWidth = metrics.width;
  const textHeight = 14;

  const labelX = 20;
  const labelY = height - 40;

  ctx.fillStyle = themeColors.bg;
  ctx.beginPath();
  ctx.roundRect(labelX - 10, labelY - 10, textWidth + 20, textHeight + 20, 8);
  ctx.fill();
  ctx.strokeStyle = themeColors.minor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = themeColors.text;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(textStr, labelX, labelY);
}
