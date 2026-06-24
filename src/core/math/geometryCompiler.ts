/**
 * @file geometryCompiler.ts
 * @brief Parses and compiles geometric and physics configurations into evaluatable runtime objects.
 * @details This module supports point generation, complex parametric objects, and physics node extraction (including cloths).
 */
import { parse } from "mathjs";
import { Logger } from "../../utils/logger";
import { extractVars } from "./transformers";
import type { CompiledEquationData } from "./evaluator";

/**
 * @brief Computes the determinant of a square matrix.
 */
function determinant(m: number[][]): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let d = 0;
  for (let j = 0; j < n; j++) {
    const sub = [];
    for (let i = 1; i < n; i++) {
      const row = [];
      for (let k = 0; k < n; k++) {
        if (k !== j) row.push(m[i][k]);
      }
      sub.push(row);
    }
    d += (j % 2 === 0 ? 1 : -1) * m[0][j] * determinant(sub);
  }
  return d;
}

/**
 * @brief Converts a line or segment structure into implicit coefficients ax + by + c = 0.
 */
function toImplicit(l: any) {
  if (!l) return null;
  if (
    typeof l.a === "number" &&
    typeof l.b === "number" &&
    typeof l.c === "number"
  ) {
    return l;
  }
  if (
    typeof l.px === "number" &&
    typeof l.py === "number" &&
    typeof l.dx === "number" &&
    typeof l.dy === "number"
  ) {
    return {
      a: -l.dy,
      b: l.dx,
      c: l.dy * l.px - l.dx * l.py,
    };
  }
  if (
    typeof l.x1 === "number" &&
    typeof l.y1 === "number" &&
    typeof l.x2 === "number" &&
    typeof l.y2 === "number"
  ) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    return {
      a: -dy,
      b: dx,
      c: dy * l.x1 - dx * l.y1,
    };
  }
  return null;
}

/**
 * @brief Helper to resolve geometric objects (circle, ellipse, point) from evaluated scopes.
 */
function resolveGeom(val: any, exprText: string, scope: any) {
  if (!val) return null;
  if (
    typeof val.cx === "number" &&
    typeof val.cy === "number" &&
    typeof val.r === "number"
  ) {
    return { type: "circle", cx: val.cx, cy: val.cy, r: val.r };
  }
  if (
    typeof val.cx === "number" &&
    typeof val.cy === "number" &&
    typeof val.rx === "number" &&
    typeof val.ry === "number"
  ) {
    return { type: "ellipse", cx: val.cx, cy: val.cy, rx: val.rx, ry: val.ry };
  }
  if (Array.isArray(val) && val.length === 2) {
    return { type: "point", x: val[0], y: val[1] };
  }
  if (typeof val.x === "number" && typeof val.y === "number") {
    return { type: "point", x: val.x, y: val.y };
  }
  return null;
}

/**
 * @brief Compiles a geometric expression string into a structured CompiledEquationData object.
 * @param exprText The raw equation input string (e.g., 'Point(2,3)', 'Mandelbrot()').
 * @param name The equation label, if assigning to a variable.
 * @param vars A set of variables discovered during initial parse, updated by this function.
 * @return CompiledEquationData if recognized, otherwise null.
 */

import { substituteMacros } from "./transformers";


export function compileGeometry(
  exprText: string,
  name: string | undefined,
  vars: Set<string>,
  macros?: Record<string, string>,
  customFunctions?: Record<string, any>
): CompiledEquationData | null {
  // Fast-path regex for ODE and VectorField (bypasses full AST which might fail on tuples)
  const vectorFieldMatch = exprText.match(/(?:VectorField|ODE|O\s*D\s*E).*?(?:\(\s*)?(.+?)\s*,\s*(.+?)(?:\s*\))?\s*$/i);
  if (vectorFieldMatch) {
    try {
      let dxNode = parse(vectorFieldMatch[1]);
      let dyNode = parse(vectorFieldMatch[2]);
      if (macros) {
          dxNode = substituteMacros(dxNode, macros, customFunctions);
          dyNode = substituteMacros(dyNode, macros, customFunctions);
      }
      extractVars(dxNode, vars);
      extractVars(dyNode, vars);
      vars.delete("x");
      vars.delete("y");
      const dxCode = dxNode.compile();
      const dyCode = dyNode.compile();
      return {
        name,
        type: "vectorField",
        vars: Array.from(vars),
        vectorData: (x: number, y: number, scope: any) => ({
          dx: dxCode.evaluate({ ...scope, x, y }),
          dy: dyCode.evaluate({ ...scope, x, y }),
        }),
      };
    } catch (e) {
      console.error("GeometryCompiler: Error in VectorField regex parse", e);
    }
  }

  // 1. Point / Parametric fallback (keeps original pointMatch logic)
  const pointMatch = exprText.match(
    /^\s*[([\[]([^()[\]]+),([^()[\]]+)[)\]]\s*$/,
  );
  if (pointMatch) {
    Logger.debug("GeometryCompiler", "Compiling point representation.");
    try {
      const xNode = parse(pointMatch[1]);
      const yNode = parse(pointMatch[2]);
      extractVars(xNode, vars);
      extractVars(yNode, vars);
      const xCode = xNode.compile();
      const yCode = yNode.compile();

      const hasSymbol = (node: any, symbol: string) => {
        let found = false;
        node.traverse((n: any) => {
          if (n.isSymbolNode && n.name === symbol) found = true;
        });
        return found;
      };
      const hasU = hasSymbol(xNode, "u") || hasSymbol(yNode, "u");
      const hasTheta = hasSymbol(xNode, "theta") || hasSymbol(yNode, "theta");
      const hasT = hasSymbol(xNode, "t") || hasSymbol(yNode, "t");
      const isParametric = hasU || hasTheta || hasT;
      const paramName = hasU ? "u" : hasTheta ? "theta" : hasT ? "t" : null;

      if (isParametric && paramName) {
        vars.delete(paramName);
        return {
          name,
          type: "parametric",
          vars: Array.from(vars),
          fnParametric: (val: number, scope: any) => ({
            x: xCode.evaluate({ ...scope, [paramName]: val }),
            y: yCode.evaluate({ ...scope, [paramName]: val }),
          }),
          paramBounds: [0, 2 * Math.PI],
        };
      }

      return {
        name,
        type: "point",
        isDraggable: vars.size === 0,
        vars: Array.from(vars),
        pointData: (scope: any) => ({
          x: xCode.evaluate(scope),
          y: yCode.evaluate(scope),
        }),
      };
    } catch (e) {
      // Ignored, fallback to AST parsing
    }
  }

  // 2. AST parsing for function calls
  try {
    const parsed = parse(exprText) as any;
    if (parsed.isFunctionNode) {
      const fnName = parsed.fn.name.toLowerCase();
      const args = parsed.args;

      const compileArgs = () =>
        args.map((a: any) => {
          extractVars(a, vars);
          return a.compile();
        });

      const parsePt = (val: any) => {
        if (val && typeof val.toArray === "function") val = val.toArray();
        if (Array.isArray(val)) return { x: val[0], y: val[1] };
        if (val && typeof val.x === "number") return { x: val.x, y: val.y };
        return null;
      };

      if (
        fnName === "fourier" ||
        fnName === "voronoi" ||
        fnName === "delaunay"
      ) {
        Logger.debug("GeometryCompiler", `Compiling ${fnName} representation.`);
        if (args.length >= 1) {
          const codes = compileArgs();
          return {
            name,
            type: fnName,
            vars: Array.from(vars),
            isTraced: fnName === "fourier",
            dataFn: (scope: any) => {
              try {
                let resX = codes[0].evaluate(scope);
                resX = resX?.toArray ? resX.toArray() : resX;
                if (codes[1]) {
                  let resY = codes[1].evaluate(scope);
                  resY = resY?.toArray ? resY.toArray() : resY;
                  const pts = [];
                  for (let i = 0; i < Math.min(resX.length, resY.length); i++) {
                    pts.push({ x: resX[i], y: resY[i] });
                  }
                  return pts;
                }
                return Array.isArray(resX) ? resX : [resX];
              } catch {
                return [];
              }
            },
          };
        }
      }

      if (fnName === "transform" && args.length === 1) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling global Transform representation.",
        );
        const codes = compileArgs();
        return {
          name,
          type: "transform",
          vars: Array.from(vars),
          transformExecute: (scope: any) => {
            const m = codes[0].evaluate(scope);
            return m?.toArray ? m.toArray() : m;
          },
        };
      }

      if (fnName === "segment" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling segment representation.");
        const codes = compileArgs();
        return {
          name,
          type: "segment",
          vars: Array.from(vars),
          segmentData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            const B = codes[1].evaluate(scope);
            const p1 = parsePt(A);
            const p2 = parsePt(B);
            if (p1 && p2) return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
            return null;
          },
        };
      }

      if (fnName === "circle") {
        Logger.debug("GeometryCompiler", "Compiling circle representation.");
        const codes = compileArgs();
        return {
          name,
          type: "circle",
          vars: Array.from(vars),
          circleData: (scope: any) => {
            const p1 = parsePt(codes[0].evaluate(scope));
            const B = codes[1].evaluate(scope);

            if (codes.length === 3) {
              const p2 = parsePt(B);
              const p3 = parsePt(codes[2].evaluate(scope));
              if (p1 && p2 && p3) {
                const temp = p2.x * p2.x + p2.y * p2.y;
                const bc = (p1.x * p1.x + p1.y * p1.y - temp) / 2;
                const cd = (temp - p3.x * p3.x - p3.y * p3.y) / 2;
                const det =
                  (p1.x - p2.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p2.y);
                if (Math.abs(det) < 1e-6) return null; // Collinear
                const cx = (bc * (p2.y - p3.y) - cd * (p1.y - p2.y)) / det;
                const cy = ((p1.x - p2.x) * cd - (p2.x - p3.x) * bc) / det;
                const r = Math.sqrt((cx - p1.x) ** 2 + (cy - p1.y) ** 2);
                return { cx, cy, r };
              }
            } else if (codes.length === 2) {
              if (p1) {
                if (typeof B === "number") return { cx: p1.x, cy: p1.y, r: B };
                const p2 = parsePt(B);
                if (p2) {
                  const r = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
                  return { cx: p1.x, cy: p1.y, r };
                }
              }
            }
            return null;
          },
        };
      }

      if (fnName === "midpoint" && args.length >= 1) {
        Logger.debug("GeometryCompiler", "Compiling Midpoint representation.");
        const codes = compileArgs();
        return {
          name,
          type: "point",
          vars: Array.from(vars),
          pointData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            if (codes.length === 1) {
              if (
                A &&
                typeof A.x1 === "number" &&
                typeof A.y1 === "number" &&
                typeof A.x2 === "number" &&
                typeof A.y2 === "number"
              ) {
                return { x: (A.x1 + A.x2) / 2, y: (A.y1 + A.y2) / 2 };
              }
              return { x: NaN, y: NaN };
            }
            const p1 = parsePt(A);
            const p2 = parsePt(codes[1].evaluate(scope));
            if (p1 && p2) return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            return { x: NaN, y: NaN };
          },
        };
      }

      if (fnName === "line" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling Line representation.");
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const p1 = parsePt(codes[0].evaluate(scope));
            const p2 = parsePt(codes[1].evaluate(scope));
            if (p1 && p2)
              return { px: p1.x, py: p1.y, dx: p2.x - p1.x, dy: p2.y - p1.y };
            return null;
          },
        };
      }

      const getLineData = (o: any) => {
        if (!o) return null;
        if (
          typeof o.px === "number" &&
          typeof o.py === "number" &&
          typeof o.dx === "number" &&
          typeof o.dy === "number"
        )
          return o;
        if (
          typeof o.x1 === "number" &&
          typeof o.y1 === "number" &&
          typeof o.x2 === "number" &&
          typeof o.y2 === "number"
        ) {
          return { px: o.x1, py: o.y1, dx: o.x2 - o.x1, dy: o.y2 - o.y1 };
        }
        if (
          typeof o.a === "number" &&
          typeof o.b === "number" &&
          typeof o.c === "number"
        )
          return o;
        return null;
      };

      if (fnName === "parallel" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling Parallel representation.");
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            const B = codes[1].evaluate(scope);
            let pt, line;
            const isLine = (o: any) =>
              o && (typeof o.px === "number" || typeof o.a === "number");
            if (isLine(A)) {
              line = A;
              pt = parsePt(B);
            } else if (isLine(B)) {
              line = B;
              pt = parsePt(A);
            }
            if (pt && line) {
              const l = getLineData(line);
              if (l) {
                if (typeof l.px === "number")
                  return { px: pt.x, py: pt.y, dx: l.dx, dy: l.dy };
                else return { a: l.a, b: l.b, c: -(l.a * pt.x + l.b * pt.y) };
              }
            }
            return null;
          },
        };
      }

      if (fnName === "perpendicular" && args.length === 2) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling Perpendicular representation.",
        );
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            const B = codes[1].evaluate(scope);
            let pt, rawLine;
            const isLineOrSegment = (o: any) =>
              o &&
              (typeof o.px === "number" ||
                typeof o.a === "number" ||
                typeof o.x1 === "number");
            if (isLineOrSegment(A)) {
              rawLine = A;
              pt = parsePt(B);
            } else if (isLineOrSegment(B)) {
              rawLine = B;
              pt = parsePt(A);
            }
            const line = getLineData(rawLine);
            if (pt && line) {
              if (typeof line.px === "number")
                return { px: pt.x, py: pt.y, dx: -line.dy, dy: line.dx };
              else
                return {
                  a: line.b,
                  b: -line.a,
                  c: line.a * pt.y - line.b * pt.x,
                };
            }
            return null;
          },
        };
      }

      if (fnName === "perpendicularbisector" && args.length >= 1) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling PerpendicularBisector representation.",
        );
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            let p1, p2;
            if (codes.length === 1) {
              if (
                A &&
                typeof A.x1 === "number" &&
                typeof A.y1 === "number" &&
                typeof A.x2 === "number" &&
                typeof A.y2 === "number"
              ) {
                p1 = { x: A.x1, y: A.y1 };
                p2 = { x: A.x2, y: A.y2 };
              }
            } else {
              p1 = parsePt(A);
              p2 = parsePt(codes[1].evaluate(scope));
            }
            if (p1 && p2) {
              const mx = (p1.x + p2.x) / 2;
              const my = (p1.y + p2.y) / 2;
              const dx = p2.x - p1.x;
              const dy = p2.y - p1.y;
              return { px: mx, py: my, dx: -dy, dy: dx };
            }
            return null;
          },
        };
      }

      if (fnName === "anglebisector" && args.length >= 2) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling AngleBisector representation.",
        );
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            let l1 = null,
              l2 = null;
            if (codes.length === 2) {
              l1 = toImplicit(codes[0].evaluate(scope));
              l2 = toImplicit(codes[1].evaluate(scope));
            } else {
              const pt1 = parsePt(codes[0].evaluate(scope));
              const pt2 = parsePt(codes[1].evaluate(scope));
              const pt3 = parsePt(codes[2].evaluate(scope));
              if (pt1 && pt2 && pt3) {
                l1 = toImplicit({ x1: pt2.x, y1: pt2.y, x2: pt1.x, y2: pt1.y });
                l2 = toImplicit({ x1: pt2.x, y1: pt2.y, x2: pt3.x, y2: pt3.y });
              }
            }
            if (l1 && l2) {
              const len1 = Math.sqrt(l1.a * l1.a + l1.b * l1.b);
              const len2 = Math.sqrt(l2.a * l2.a + l2.b * l2.b);
              if (len1 > 0 && len2 > 0) {
                const a1 = l1.a / len1,
                  b1 = l1.b / len1,
                  c1 = l1.c / len1;
                const a2 = l2.a / len2,
                  b2 = l2.b / len2,
                  c2 = l2.c / len2;
                return [
                  { a: a1 - a2, b: b1 - b2, c: c1 - c2 },
                  { a: a1 + a2, b: b1 + b2, c: c1 + c2 },
                ];
              }
            }
            return null;
          },
        };
      }

      if (fnName === "intersect" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling Intersect representation.");
        const codes = compileArgs();
        return {
          name,
          type: "point",
          isDraggable: false,
          vars: Array.from(vars),
          pointData: (scope: any) => {
            const l1 = toImplicit(codes[0].evaluate(scope));
            const l2 = toImplicit(codes[1].evaluate(scope));
            if (l1 && l2) {
              const det = l1.a * l2.b - l1.b * l2.a;
              if (Math.abs(det) > 1e-10) {
                const x = (l1.b * l2.c - l2.b * l1.c) / det;
                const y = (l2.a * l1.c - l1.a * l2.c) / det;
                return { x, y };
              }
            }
            return { x: NaN, y: NaN };
          },
        };
      }

      if (fnName === "tangent" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling Tangent representation.");
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const A = codes[0].evaluate(scope);
            const B = codes[1].evaluate(scope);

            let pt, curve;
            const isPoint = (o: any) =>
              Array.isArray(o) || (o && typeof o.x === "number");
            const isCircleOrEllipse = (o: any) => o && typeof o.cx === "number";
            const isFunction = (o: any) => typeof o === "function";

            if (isPoint(A)) {
              pt = parsePt(A);
              curve = B;
            } else if (isPoint(B)) {
              pt = parsePt(B);
              curve = A;
            }

            if (pt) {
              if (isCircleOrEllipse(curve)) {
                if (typeof curve.r === "number") {
                  const vX = curve.cx - pt.x;
                  const vY = curve.cy - pt.y;
                  const dist = Math.sqrt(vX * vX + vY * vY);
                  if (dist < curve.r - 1e-4) return [];
                  if (Math.abs(dist - curve.r) < 1e-4) {
                    return [{ px: pt.x, py: pt.y, dx: -vY, dy: vX }];
                  }
                  const theta = Math.atan2(vY, vX);
                  const alpha = Math.asin(curve.r / dist);
                  return [
                    {
                      px: pt.x,
                      py: pt.y,
                      dx: Math.cos(theta + alpha),
                      dy: Math.sin(theta + alpha),
                    },
                    {
                      px: pt.x,
                      py: pt.y,
                      dx: Math.cos(theta - alpha),
                      dy: Math.sin(theta - alpha),
                    },
                  ];
                } else if (
                  typeof curve.rx === "number" &&
                  typeof curve.ry === "number"
                ) {
                  const { cx, cy, rx, ry } = curve;
                  const scaleFactor = rx / ry;
                  const sPt = { x: pt.x, y: pt.y * scaleFactor };
                  const sCenter = { x: cx, y: cy * scaleFactor };
                  const vX = sCenter.x - sPt.x;
                  const vY = sCenter.y - sPt.y;
                  const dist = Math.sqrt(vX * vX + vY * vY);
                  if (dist < rx - 1e-4) return [];
                  const theta = Math.atan2(vY, vX);
                  const alpha = Math.asin(rx / dist);
                  return [theta + alpha, theta - alpha].map((ang) => {
                    return {
                      px: pt.x,
                      py: pt.y,
                      dx: Math.cos(ang),
                      dy: Math.sin(ang) / scaleFactor,
                    };
                  });
                }
              } else {
                const f = isFunction(curve)
                  ? curve
                  : (xVal: number) => {
                      const code = isPoint(A) ? codes[1] : codes[0];
                      return code.evaluate({ ...scope, x: xVal });
                    };
                const evalF = (x: number) => {
                  try {
                    return f(x);
                  } catch {
                    return NaN;
                  }
                };
                const evalDF = (x: number) => {
                  const h = 1e-4;
                  return (evalF(x + h) - evalF(x - h)) / (2 * h);
                };
                const evalG = (x: number) =>
                  evalF(x) - evalDF(x) * (x - pt.x) - pt.y;

                const roots = new Set<number>();
                for (const sT of [pt.x, pt.x - 2, pt.x + 2]) {
                  let t = sT;
                  let success = false;
                  for (let iter = 0; iter < 50; iter++) {
                    const gval = evalG(t);
                    if (Math.abs(gval) < 1e-7) {
                      success = true;
                      break;
                    }
                    const h = 1e-4;
                    const dg = (evalG(t + h) - evalG(t - h)) / (2 * h);
                    if (Math.abs(dg) < 1e-12) break;
                    const nextT = t - gval / dg;
                    if (isNaN(nextT) || Math.abs(nextT - t) > 100) break;
                    t = nextT;
                  }
                  if (success && !isNaN(t))
                    roots.add(Math.round(t * 1e5) / 1e5);
                }
                return Array.from(roots).map((t) => ({
                  px: t,
                  py: evalF(t),
                  dx: 1,
                  dy: evalDF(t),
                }));
              }
            } else if (isCircleOrEllipse(A) && isCircleOrEllipse(B)) {
              if (typeof A.r === "number" && typeof B.r === "number") {
                const r1 = A.r,
                  r2 = B.r;
                const dx = B.cx - A.cx,
                  dy = B.cy - A.cy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 1e-6) return [];
                const lines: any[] = [];
                const pointCircleTangents = (
                  p: { x: number; y: number },
                  center: { x: number; y: number },
                  R: number,
                ) => {
                  const vX = center.x - p.x;
                  const vY = center.y - p.y;
                  const dist = Math.sqrt(vX * vX + vY * vY);
                  if (dist < R - 1e-4) return [];
                  if (Math.abs(dist - R) < 1e-4)
                    return [{ px: p.x, py: p.y, dx: -vY, dy: vX }];
                  const theta = Math.atan2(vY, vX);
                  const alpha = Math.asin(R / dist);
                  return [
                    {
                      px: p.x,
                      py: p.y,
                      dx: Math.cos(theta + alpha),
                      dy: Math.sin(theta + alpha),
                    },
                    {
                      px: p.x,
                      py: p.y,
                      dx: Math.cos(theta - alpha),
                      dy: Math.sin(theta - alpha),
                    },
                  ];
                };
                if (Math.abs(r1 - r2) < 1e-4) {
                  const nx = -dy / d,
                    ny = dx / d;
                  lines.push({
                    px: A.cx + nx * r1,
                    py: A.cy + ny * r1,
                    dx,
                    dy,
                  });
                  lines.push({
                    px: A.cx - nx * r1,
                    py: A.cy - ny * r1,
                    dx,
                    dy,
                  });
                } else {
                  const ex = (r1 * B.cx - r2 * A.cx) / (r1 - r2);
                  const ey = (r1 * B.cy - r2 * A.cy) / (r1 - r2);
                  lines.push(
                    ...pointCircleTangents(
                      { x: ex, y: ey },
                      { x: A.cx, y: A.cy },
                      r1,
                    ),
                  );
                }
                const ix = (r1 * B.cx + r2 * A.cx) / (r1 + r2);
                const iy = (r1 * B.cy + r2 * A.cy) / (r1 + r2);
                lines.push(
                  ...pointCircleTangents(
                    { x: ix, y: iy },
                    { x: A.cx, y: A.cy },
                    r1,
                  ),
                );
                return lines;
              }
            }
            return null;
          },
        };
      }

      if (fnName === "ellipse" && args.length === 3) {
        Logger.debug("GeometryCompiler", "Compiling Ellipse representation.");
        const codes = compileArgs();
        return {
          name,
          type: "ellipse",
          vars: Array.from(vars),
          ellipseData: (scope: any) => {
            const p1 = parsePt(codes[0].evaluate(scope));
            const p2 = parsePt(codes[1].evaluate(scope));
            const semiMajor = codes[2].evaluate(scope);
            if (p1 && p2 && typeof semiMajor === "number") {
              const cx = (p1.x + p2.x) / 2;
              const cy = (p1.y + p2.y) / 2;
              const fDist =
                Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2) / 2;
              const ry = Math.sqrt(
                Math.max(0, semiMajor * semiMajor - fDist * fDist),
              );
              return { cx, cy, rx: semiMajor, ry };
            }
            return null;
          },
        };
      }

      if (fnName === "polygon") {
        Logger.debug("GeometryCompiler", "Compiling polygon representation.");
        const codes = compileArgs();
        return {
          name,
          type: "polygon",
          vars: Array.from(vars),
          polygonData: (scope: any) => {
            return codes
              .map((c: any) => parsePt(c.evaluate(scope)))
              .filter(Boolean) as { x: number; y: number }[];
          },
        };
      }

      if (fnName === "label" && args.length === 3) {
        Logger.debug("GeometryCompiler", "Compiling label representation.");
        const codes = compileArgs();
        const textArg = args[2];
        const labelText =
          textArg.isStringNode || textArg.isConstantNode
            ? textArg.value
            : textArg.isSymbolNode
              ? textArg.name
              : "";
        return {
          name,
          type: "label",
          vars: Array.from(vars),
          labelData: (scope: any) => {
            const x = codes[0].evaluate(scope);
            const y = codes[1].evaluate(scope);
            if (typeof x === "number" && typeof y === "number") {
              return { x, y, text: labelText };
            }
            return null;
          },
        };
      }

      if (
        fnName === "physicsnode" &&
        (args.length === 3 || args.length === 4)
      ) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling PhysicsNode representation.",
        );
        const idArg = args[0];
        const id =
          idArg.isStringNode || idArg.isConstantNode
            ? idArg.value
            : idArg.isSymbolNode
              ? idArg.name
              : "";
        const pinnedArg = args[3];
        let pinned = false;
        if (pinnedArg) {
          pinned =
            (pinnedArg.isConstantNode && pinnedArg.value === true) ||
            (pinnedArg.isSymbolNode && pinnedArg.name === "true");
        }
        extractVars(args[1], vars);
        extractVars(args[2], vars);
        const xCode = args[1].compile();
        const yCode = args[2].compile();
        return {
          name,
          type: "physicsNode",
          vars: Array.from(vars),
          physicsData: (scope: any) => ({
            id,
            x: xCode.evaluate(scope),
            y: yCode.evaluate(scope),
            pinned,
          }),
        };
      }

      if (fnName === "physicslink" && args.length === 3) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling PhysicsLink representation.",
        );
        const getStr = (a: any) =>
          a.isStringNode || a.isConstantNode
            ? a.value
            : a.isSymbolNode
              ? a.name
              : "";
        const nodeA = getStr(args[0]);
        const nodeB = getStr(args[1]);
        extractVars(args[2], vars);
        const lenCode = args[2].compile();
        return {
          name,
          type: "physicsLink",
          vars: Array.from(vars),
          physicsData: (scope: any) => ({
            nodeA,
            nodeB,
            length: lenCode.evaluate(scope),
          }),
        };
      }

      if (fnName === "physicscloth" && args.length >= 5) {
        Logger.debug(
          "GeometryCompiler",
          "Compiling PhysicsCloth representation.",
        );
        try {
          const codes = args.map((a: any) => a.compile());
          const pinnedNodesArgs = codes.slice(5);

          return {
            name,
            type: "physicsNode",
            vars: [],
            physicsData: (scope: any) => {
              const sx = codes[0].evaluate(scope);
              const sy = codes[1].evaluate(scope);
              const r = codes[2].evaluate(scope);
              const c = codes[3].evaluate(scope);
              const sp = codes[4].evaluate(scope);

              const pinnedPairs: { pi: number; pj: number }[] = [];
              for (let i = 0; i < pinnedNodesArgs.length; i += 2) {
                if (i + 1 < pinnedNodesArgs.length) {
                  pinnedPairs.push({
                    pi: pinnedNodesArgs[i].evaluate(scope),
                    pj: pinnedNodesArgs[i + 1].evaluate(scope),
                  });
                }
              }

              const items: any[] = [];
              for (let i = 0; i < r; i++) {
                for (let j = 0; j < c; j++) {
                  const isPinned = pinnedPairs.some(
                    (p) => p.pi === i && p.pj === j,
                  );
                  items.push({
                    id: `cloth_${i}_${j}`,
                    x: sx + j * sp,
                    y: sy - i * sp,
                    pinned: isPinned,
                  });
                  if (i > 0)
                    items.push({
                      nodeA: `cloth_${i}_${j}`,
                      nodeB: `cloth_${i - 1}_${j}`,
                      length: sp,
                    });
                  if (j > 0)
                    items.push({
                      nodeA: `cloth_${i}_${j}`,
                      nodeB: `cloth_${i}_${j - 1}`,
                      length: sp,
                    });
                }
              }
              return items;
            },
          };
        } catch (e) {
          console.error("Error compiling PhysicsCloth:", e);
        }
      }

      if (fnName === "conic" && args.length === 5) {
        Logger.debug("GeometryCompiler", "Compiling Conic representation.");
        const codes = compileArgs();
        const getConicData = (scope: any) => {
          const pt1 = parsePt(codes[0].evaluate(scope));
          const pt2 = parsePt(codes[1].evaluate(scope));
          const pt3 = parsePt(codes[2].evaluate(scope));
          const pt4 = parsePt(codes[3].evaluate(scope));
          const pt5 = parsePt(codes[4].evaluate(scope));
          if (pt1 && pt2 && pt3 && pt4 && pt5) {
            const mat = [pt1, pt2, pt3, pt4, pt5].map((p) => [
              p.x * p.x,
              p.x * p.y,
              p.y * p.y,
              p.x,
              p.y,
              1,
            ]);
            const getSub = (ci: number) =>
              mat.map((row) => row.filter((_, idx) => idx !== ci));
            const cofs = [
              determinant(getSub(0)),
              -determinant(getSub(1)),
              determinant(getSub(2)),
              -determinant(getSub(3)),
              determinant(getSub(4)),
              -determinant(getSub(5)),
            ];
            return {
              a: cofs[0],
              b: cofs[1],
              c: cofs[2],
              d: cofs[3],
              e: cofs[4],
              f: cofs[5],
            };
          }
          return null;
        };

        return {
          name,
          type: "implicit",
          vars: Array.from(vars),
          glslUniforms: [
            "u_conic_a",
            "u_conic_b",
            "u_conic_c",
            "u_conic_d",
            "u_conic_e",
            "u_conic_f",
          ],
          conicData: getConicData,
          fnImplicit: (x: number, y: number, scope: any) => {
            let cd = scope.__conic_cache || getConicData(scope);
            if (cd)
              return (
                cd.a * x * x +
                cd.b * x * y +
                cd.c * y * y +
                cd.d * x +
                cd.e * y +
                cd.f
              );
            return NaN;
          },
          glslExpr:
            "u_conic_a * x * x + u_conic_b * x * y + u_conic_c * y * y + u_conic_d * x + u_conic_e * y + u_conic_f",
        };
      }
    }
  } catch (e) {
    // Not a valid AST geometric function, let evaluator fallback handle it.
  }

  return null;
}
