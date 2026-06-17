import type { Camera } from "./camera";

/**
 * @brief Renders a discrete mathematical point on the canvas.
 */
export function plotPoint(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: { x: any; y: any },
  color: string,
  width: number,
  height: number,
  style?: "circle" | "cross" | "diamond",
) {
  const xArr = data.x?.toArray
    ? data.x.toArray()
    : Array.isArray(data.x)
      ? data.x
      : [data.x];
  const yArr = data.y?.toArray
    ? data.y.toArray()
    : Array.isArray(data.y)
      ? data.y
      : [data.y];

  const len = Math.max(xArr.length, yArr.length);

  for (let i = 0; i < len; i++) {
    const x = xArr[i % xArr.length];
    const y = yArr[i % yArr.length];

    if (isNaN(x) || isNaN(y)) continue;

    const p = camera.mathToScreen(x, y, width, height);

    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    const s = style || "circle";
    const r = 6;

    if (s === "circle") {
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (s === "cross") {
      ctx.moveTo(p.x - r, p.y - r);
      ctx.lineTo(p.x + r, p.y + r);
      ctx.moveTo(p.x + r, p.y - r);
      ctx.lineTo(p.x - r, p.y + r);
      ctx.stroke();
    } else if (s === "diamond") {
      ctx.moveTo(p.x, p.y - r - 2);
      ctx.lineTo(p.x + r + 2, p.y);
      ctx.lineTo(p.x, p.y + r + 2);
      ctx.lineTo(p.x - r - 2, p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/**
 * @brief Renders a geometric line segment between two coordinates.
 */
export function plotSegment(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: { x1: number; y1: number; x2: number; y2: number },
  color: string,
  width: number,
  height: number,
  lw: number,
) {
  const p1 = camera.mathToScreen(data.x1, data.y1, width, height);
  const p2 = camera.mathToScreen(data.x2, data.y2, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p2.x, p2.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * @brief Renders a geometric line extending to infinity.
 */
export function plotLine(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: any,
  color: string,
  width: number,
  height: number,
  lineWidth: number,
) {
  if (!data) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const minMath = camera.screenToMath(0, height, width, height);
  const maxMath = camera.screenToMath(width, 0, width, height);

  let p1X = 0, p1Y = 0, p2X = 0, p2Y = 0;

  if (typeof data.px === "number" && typeof data.py === "number" && typeof data.dx === "number" && typeof data.dy === "number") {
    // Vector form
    const diag = Math.sqrt((maxMath.x - minMath.x) ** 2 + (maxMath.y - minMath.y) ** 2) * 2;
    const len = Math.sqrt(data.dx * data.dx + data.dy * data.dy);
    const ndx = len > 0 ? data.dx / len : 1;
    const ndy = len > 0 ? data.dy / len : 0;
    p1X = data.px - ndx * diag;
    p1Y = data.py - ndy * diag;
    p2X = data.px + ndx * diag;
    p2Y = data.py + ndy * diag;
  } else if (typeof data.a === "number" && typeof data.b === "number" && typeof data.c === "number") {
    // Implicit form a*x + b*y + c = 0
    const { a, b, c } = data;
    if (Math.abs(b) > 1e-6) {
      p1X = minMath.x - 10;
      p1Y = -(a * p1X + c) / b;
      p2X = maxMath.x + 10;
      p2Y = -(a * p2X + c) / b;
    } else if (Math.abs(a) > 1e-6) {
      p1X = -c / a;
      p1Y = minMath.y - 10;
      p2X = -c / a;
      p2Y = maxMath.y + 10;
    } else {
      return;
    }
  } else {
    return;
  }

  const sp1 = camera.mathToScreen(p1X, p1Y, width, height);
  const sp2 = camera.mathToScreen(p2X, p2Y, width, height);

  ctx.beginPath();
  ctx.moveTo(sp1.x, sp1.y);
  ctx.lineTo(sp2.x, sp2.y);
  ctx.stroke();
}

/**
 * @brief Renders an ellipse.
 */
export function plotEllipse(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: { cx: number; cy: number; rx: number; ry: number },
  color: string,
  width: number,
  height: number,
  lineWidth: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;

  const sc = camera.mathToScreen(data.cx, data.cy, width, height);
  const srx = data.rx * camera.state.zoom;
  const sry = data.ry * camera.state.zoom;

  ctx.beginPath();
  ctx.ellipse(sc.x, sc.y, srx, sry, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

/**
 * @brief Renders a closed geometric polygon defined by an array of vertices.
 */
export function plotPolygon(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  points: { x: number; y: number }[],
  color: string,
  width: number,
  height: number,
  pointStyle?: "circle" | "cross" | "diamond",
) {
  if (points.length < 2) return;

  ctx.fillStyle = color;
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const p = camera.mathToScreen(points[i].x, points[i].y, width, height);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.stroke();

  for (const pt of points) {
    plotPoint(ctx, camera, pt, color, width, height, pointStyle);
  }
}

/**
 * @brief Renders a circle from its center and radius.
 */
export function plotCircle(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: { cx: number; cy: number; r: number },
  color: string,
  width: number,
  height: number,
  lw: number,
) {
  if (isNaN(data.cx) || isNaN(data.cy) || isNaN(data.r) || data.r <= 0) return;

  const screenR = data.r * camera.state.zoom;
  const center = camera.mathToScreen(data.cx, data.cy, width, height);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;

  ctx.beginPath();
  ctx.arc(center.x, center.y, screenR, 0, Math.PI * 2);
  ctx.globalAlpha = 0.1;
  ctx.fill();
  ctx.globalAlpha = 1.0;
  ctx.stroke();
}

/**
 * @brief Renders a text label at the specified mathematical coordinates.
 */
export function plotLabel(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  data: { x: number; y: number; text: string },
  color: string,
  width: number,
  height: number,
  themeColors: { major: string; minor: string; text: string; bg: string },
) {
  if (isNaN(data.x) || isNaN(data.y) || !data.text) return;

  const p = camera.mathToScreen(data.x, data.y, width, height);

  ctx.font = "bold 16px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = themeColors.bg;
  ctx.lineWidth = 4;
  ctx.strokeText(data.text, p.x, p.y - 15);

  ctx.fillStyle = color;
  ctx.fillText(data.text, p.x, p.y - 15);
}
