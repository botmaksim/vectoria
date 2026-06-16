import type { Camera } from "./camera";
import type { CompiledEquation } from "./plotter";

/**
 * @brief Default marching squares resolution.
 * @details Pixels per cell. Lower values produce higher quality but are computationally much slower.
 */
const MS_RES = 4;

function checkOperator(v: number, operator?: string): boolean {
  if (isNaN(v)) return false;
  if (operator === ">") return v > 0;
  if (operator === "<") return v < 0;
  if (operator === ">=") return v >= 0;
  if (operator === "<=") return v <= 0;
  return false;
}

/**
 * @brief Renders implicit equations and inequalities using the Marching Squares algorithm on the CPU.
 */
export function plotMarchingSquares(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  fnImplicit: (x: number, y: number, scope: any) => number,
  color: string,
  width: number,
  height: number,
  scope: any,
  isInequality: boolean,
  operator?: string,
) {
  const res = MS_RES;
  const cols = Math.ceil(width / res) + 1;
  const rows = Math.ceil(height / res) + 1;

  const grid = new Float32Array(cols * rows);
  const localScope = Object.create(scope);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const screenX = c * res;
      const screenY = r * res;
      const p = camera.screenToMath(screenX, screenY, width, height);
      grid[r * cols + c] = fnImplicit(p.x, p.y, localScope);
    }
  }

  if (isInequality) {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const v0 = grid[r * cols + c];
        if (checkOperator(v0, operator)) {
          ctx.rect(c * res, r * res, res, res);
        }
      }
    }
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const v0 = grid[r * cols + c];
      const v1 = grid[r * cols + c + 1];
      const v2 = grid[(r + 1) * cols + c + 1];
      const v3 = grid[(r + 1) * cols + c];

      if (isNaN(v0) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;

      let state = 0;
      if (v0 > 0) state |= 1;
      if (v1 > 0) state |= 2;
      if (v2 > 0) state |= 4;
      if (v3 > 0) state |= 8;

      if (state > 0 && state < 15) {
        const x0 = c * res;
        const y0 = r * res;
        const pts: { x: number; y: number }[] = [];

        if ((state & 1) !== (state & 2) >> 1) {
          const t = v0 / (v0 - v1);
          pts.push({ x: x0 + t * res, y: y0 });
        }
        if ((state & 2) >> 1 !== (state & 4) >> 2) {
          const t = v1 / (v1 - v2);
          pts.push({ x: x0 + res, y: y0 + t * res });
        }
        if ((state & 4) >> 2 !== (state & 8) >> 3) {
          const t = v3 / (v3 - v2);
          pts.push({ x: x0 + (1 - t) * res, y: y0 + res });
        }
        if ((state & 8) >> 3 !== (state & 1)) {
          const t = v0 / (v0 - v3);
          pts.push({ x: x0, y: y0 + t * res });
        }

        if (pts.length === 2) {
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
        } else if (pts.length === 4) {
          ctx.moveTo(pts[0].x, pts[0].y);
          ctx.lineTo(pts[1].x, pts[1].y);
          ctx.moveTo(pts[2].x, pts[2].y);
          ctx.lineTo(pts[3].x, pts[3].y);
        }
      }
    }
  }
  ctx.stroke();
}

/**
 * @brief Computes and renders intersection points between explicit functions and the X-axis.
 */
export function findIntersections(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  eqs: CompiledEquation[],
  width: number,
  height: number,
  scope: any,
): { x: number; y: number; type: string }[] {
  const minMath = camera.screenToMath(0, height, width, height);
  const maxMath = camera.screenToMath(width, 0, width, height);

  const explicitFuncs = eqs
    .filter((e) => e.type === "explicit" && e.fnExplicit)
    .map((e) => e.fnExplicit!);

  const pois: { x: number; y: number; type: string }[] = [];
  if (explicitFuncs.length === 0) return pois;

  const allFuncs = [...explicitFuncs, (x: number) => 0];

  ctx.fillStyle = "#888";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;

  const segments = 100;
  const dx = (maxMath.x - minMath.x) / segments;

  for (let i = 0; i < allFuncs.length; i++) {
    for (let j = i + 1; j < allFuncs.length; j++) {
      const f1 = allFuncs[i];
      const f2 = allFuncs[j];

      for (let s = 0; s < segments; s++) {
        const x1 = minMath.x + s * dx;
        const x2 = minMath.x + (s + 1) * dx;

        let y1_1: any = f1(x1, scope);
        if (Array.isArray(y1_1) || y1_1?.toArray)
          y1_1 = Array.isArray(y1_1) ? y1_1[0] : y1_1.toArray()[0];
        let y2_1: any = f1(x2, scope);
        if (Array.isArray(y2_1) || y2_1?.toArray)
          y2_1 = Array.isArray(y2_1) ? y2_1[0] : y2_1.toArray()[0];
        let y1_2: any = f2(x1, scope);
        if (Array.isArray(y1_2) || y1_2?.toArray)
          y1_2 = Array.isArray(y1_2) ? y1_2[0] : y1_2.toArray()[0];
        let y2_2: any = f2(x2, scope);
        if (Array.isArray(y2_2) || y2_2?.toArray)
          y2_2 = Array.isArray(y2_2) ? y2_2[0] : y2_2.toArray()[0];

        if (isNaN(y1_1) || isNaN(y2_1) || isNaN(y1_2) || isNaN(y2_2)) continue;

        const diff1 = y1_1 - y1_2;
        const diff2 = y2_1 - y2_2;

        if (
          diff1 * diff2 <= 0 &&
          Math.abs(diff1 - diff2) < maxMath.y - minMath.y
        ) {
          const t = diff1 / (diff1 - diff2);
          const xRoot = x1 + t * dx;
          const yRoot: any =
            f1 === allFuncs[allFuncs.length - 1] ? 0 : f1(xRoot, scope);

          if (!isNaN(yRoot)) {
            const val =
              Array.isArray(yRoot) || yRoot?.toArray
                ? Array.isArray(yRoot)
                  ? yRoot[0]
                  : yRoot.toArray()[0]
                : yRoot;

            pois.push({
              x: xRoot,
              y: val,
              type:
                f1 === allFuncs[allFuncs.length - 1] ? "root" : "intersection",
            });

            const p = camera.mathToScreen(xRoot, val, width, height);
            if (p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height) {
              ctx.beginPath();
              ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
          }
        }
      }
    }
  }

  /**
   * @brief Identify and plot Y-intercepts.
   */
  for (const f of explicitFuncs) {
    const yInt: any = f(0, scope);
    if (yInt !== undefined && !isNaN(yInt)) {
      const val =
        Array.isArray(yInt) || yInt?.toArray
          ? Array.isArray(yInt)
            ? yInt[0]
            : yInt.toArray()[0]
          : yInt;
      pois.push({ x: 0, y: val, type: "y-intercept" });
      const p = camera.mathToScreen(0, val, width, height);
      if (p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  return pois;
}
