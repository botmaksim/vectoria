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
  
  if (exprText.match(/^\s*PointOn\s*\(/i)) {
    try {
      const parsed = parse(exprText) as any;
      if (parsed.isFunctionNode && parsed.fn.name.toLowerCase() === 'pointon') {
        const args = parsed.args;
        extractVars(args[0], vars);
        const curveCode = args[0].compile();
        let paramX = null;
        let paramY = null;
        if (args.length === 3) {
            paramX = args[1].compile();
            paramY = args[2].compile();
        }
        return {
          name,
          type: "point",
          isDraggable: true,
          vars: Array.from(vars),
          pointData: (scope: any) => {
            let px = paramX ? paramX.evaluate(scope) : 0;
            let py = paramY ? paramY.evaluate(scope) : 0;
            const curve = curveCode.evaluate(scope);
            
            // Project (px, py) onto the curve
            const isLine = (o: any) => o && (typeof o.px === "number" || typeof o.a === "number");
            if (isLine(curve)) {
                const l = curve;
                if (typeof l.px === "number") {
                    const l2 = l.dx*l.dx + l.dy*l.dy;
                    if (l2 === 0) return { x: l.px, y: l.py };
                    const t = ((px - l.px) * l.dx + (py - l.py) * l.dy) / l2;
                    return { x: l.px + t * l.dx, y: l.py + t * l.dy };
                } else {
                    const norm = l.a*l.a + l.b*l.b;
                    if (norm === 0) return { x: px, y: py };
                    const dist = (l.a * px + l.b * py + l.c) / norm;
                    return { x: px - l.a * dist, y: py - l.b * dist };
                }
            } else if (curve && typeof curve.cx === "number") {
                if (typeof curve.r === "number") {
                    const dx = px - curve.cx;
                    const dy = py - curve.cy;
                    const d = Math.hypot(dx, dy) || 1;
                    return { x: curve.cx + curve.r * dx / d, y: curve.cy + curve.r * dy / d };
                } else if (typeof curve.rx === "number") {
                    // Approximate projection for ellipse
                    const angle = Math.atan2((py - curve.cy)/curve.ry, (px - curve.cx)/curve.rx);
                    return { x: curve.cx + curve.rx * Math.cos(angle), y: curve.cy + curve.ry * Math.sin(angle) };
                }
            } else if (curve && typeof curve.a === "number" && typeof curve.f === "number") {
                // Conic implicit projection: iterative approach
                let cx = px, cy = py;
                for (let i = 0; i < 5; i++) {
                    const v = curve.a*cx*cx + curve.b*cx*cy + curve.c*cy*cy + curve.d*cx + curve.e*cy + curve.f;
                    const gx = 2*curve.a*cx + curve.b*cy + curve.d;
                    const gy = 2*curve.c*cy + curve.b*cx + curve.e;
                    const gl2 = gx*gx + gy*gy;
                    if (gl2 < 1e-10) break;
                    cx -= v * gx / gl2;
                    cy -= v * gy / gl2;
                }
                return { x: cx, y: cy };
            } else if (typeof curve === 'function') {
                // explicit function
                return { x: px, y: curve(px) };
            }
            return { x: px, y: py };
          }
        };
      }
    } catch(e) {}
  }

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
              l1 = toImplicitLine(codes[0].evaluate(scope));
              l2 = toImplicitLine(codes[1].evaluate(scope));
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

      if (fnName === "intersect" && args.length >= 2) {
        Logger.debug("GeometryCompiler", "Compiling Intersect representation.");
        const codes = compileArgs();
        return {
          name,
          type: "point",
          vars: Array.from(vars),
          pointData: (scope: any) => {
            const o1 = codes[0].evaluate(scope);
            const o2 = codes[1].evaluate(scope);
            const l1 = toImplicitLine(o1);
            const l2 = toImplicitLine(o2);
            
            // Wait, pointData expects a single point. But intersection can yield multiple points!
            // Vectoria expressions return a single point or array. If we return an array, it might not render as a point.
            // Actually, Vectoria point representation requires {x, y}. But polygon renders arrays.
            // Let's implement numerical solver for conic-conic intersection that returns the closest one to a 3rd arg or all?
            // If the user wants ALL intersections marked, Vectoria's point parser or Canvas must handle an array of points!
            // GraphCanvas checks `if (eq.type === 'point' && eq.pointData)`. Then `const p = eq.pointData(...)`. 
            // If p is an array, `p.x` is undefined!
            // For now, let's return an array and we will patch GraphCanvas to draw arrays of points if `p` is an array.
            
            const c1 = toImplicitConic(o1);
            const c2 = toImplicitConic(o2);
            
            if (l1 && l2) {
              const det = l1.a * l2.b - l2.a * l1.b;
              if (Math.abs(det) > 1e-10) {
                return { x: (l1.b * l2.c - l2.b * l1.c) / det, y: (l2.a * l1.c - l1.a * l2.c) / det };
              }
              return null;
            }
            
            if (c1 && l2) {
                // Line l2: a*x + b*y + c = 0
                // Conic c1: a*x^2 + b*xy + c*y^2 + d*x + e*y + f = 0
                const pts = [];
                if (Math.abs(l2.b) > Math.abs(l2.a)) {
                    // y = -(l2.a*x + l2.c)/l2.b
                    const m = -l2.a/l2.b, k = -l2.c/l2.b;
                    const A = c1.a + c1.b*m + c1.c*m*m;
                    const B = c1.b*k + 2*c1.c*m*k + c1.d + c1.e*m;
                    const C = c1.c*k*k + c1.e*k + c1.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0) {
                        const x1 = (-B + Math.sqrt(delta))/(2*A);
                        const x2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: x1, y: m*x1 + k});
                        if (delta > 1e-8) pts.push({x: x2, y: m*x2 + k});
                    }
                } else {
                    const m = -l2.b/l2.a, k = -l2.c/l2.a;
                    const A = c1.c + c1.b*m + c1.a*m*m;
                    const B = c1.b*k + 2*c1.a*m*k + c1.e + c1.d*m;
                    const C = c1.a*k*k + c1.d*k + c1.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0) {
                        const y1 = (-B + Math.sqrt(delta))/(2*A);
                        const y2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: m*y1 + k, y: y1});
                        if (delta > 1e-8) pts.push({x: m*y2 + k, y: y2});
                    }
                }
                return pts.length === 1 ? pts[0] : (pts.length ? pts : null);
            }
            
            if (c1 && c2) {
                // Extremely simple numeric solver for generic conics intersections
                // Grid search + Newton
                const pts = [];
                for(let x = -20; x <= 20; x+=1.5) {
                    for(let y = -20; y <= 20; y+=1.5) {
                        let cx = x, cy = y;
                        for(let i=0; i<10; i++) {
                            const v1 = c1.a*cx*cx + c1.b*cx*cy + c1.c*cy*cy + c1.d*cx + c1.e*cy + c1.f;
                            const v2 = c2.a*cx*cx + c2.b*cx*cy + c2.c*cy*cy + c2.d*cx + c2.e*cy + c2.f;
                            if (Math.abs(v1) < 1e-7 && Math.abs(v2) < 1e-7) break;
                            const J11 = 2*c1.a*cx + c1.b*cy + c1.d;
                            const J12 = 2*c1.c*cy + c1.b*cx + c1.e;
                            const J21 = 2*c2.a*cx + c2.b*cy + c2.d;
                            const J22 = 2*c2.c*cy + c2.b*cx + c2.e;
                            const det = J11*J22 - J12*J21;
                            if (Math.abs(det) < 1e-10) break;
                            cx -= (J22*v1 - J12*v2)/det;
                            cy -= (-J21*v1 + J11*v2)/det;
                        }
                        const v1 = c1.a*cx*cx + c1.b*cx*cy + c1.c*cy*cy + c1.d*cx + c1.e*cy + c1.f;
                        const v2 = c2.a*cx*cx + c2.b*cx*cy + c2.c*cy*cy + c2.d*cx + c2.e*cy + c2.f;
                        if (Math.abs(v1) < 1e-5 && Math.abs(v2) < 1e-5) {
                            if (!pts.some(p => Math.hypot(p.x-cx, p.y-cy) < 1e-3)) {
                                pts.push({x: cx, y: cy});
                            }
                        }
                    }
                }
                return pts.length === 1 ? pts[0] : (pts.length ? pts : null);
            }
            return null;
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
            const o1 = codes[0].evaluate(scope);
            const o2 = codes[1].evaluate(scope);
            
            const pt = o1 && typeof o1.x === 'number' ? o1 : (o2 && typeof o2.x === 'number' ? o2 : null);
            const l1 = toImplicitLine(o1);
            const l2 = toImplicitLine(o2);
            const line = l1 || l2;
            const c1 = toImplicitConic(o1);
            const c2 = toImplicitConic(o2);
            
            // Tangent to Conic from Point (polar line intersection)
            if (pt && c1) {
                // Polar line: (A x0 + B/2 y0 + D/2) x + (C y0 + B/2 x0 + E/2) y + (D/2 x0 + E/2 y0 + F) = 0
                const px = pt.x, py = pt.y;
                const L_a = c1.a * px + (c1.b/2) * py + c1.d/2;
                const L_b = c1.c * py + (c1.b/2) * px + c1.e/2;
                const L_c = (c1.d/2) * px + (c1.e/2) * py + c1.f;
                // Now find intersections of line (L_a x + L_b y + L_c = 0) and conic c1.
                // Using the analytical line-conic intersection logic
                const pts = [];
                if (Math.abs(L_b) > Math.abs(L_a)) {
                    const m = -L_a/L_b, k = -L_c/L_b;
                    const A = c1.a + c1.b*m + c1.c*m*m;
                    const B = c1.b*k + 2*c1.c*m*k + c1.d + c1.e*m;
                    const C = c1.c*k*k + c1.e*k + c1.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0) {
                        const x1 = (-B + Math.sqrt(delta))/(2*A);
                        const x2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: x1, y: m*x1 + k});
                        if (delta > 1e-8) pts.push({x: x2, y: m*x2 + k});
                    }
                } else {
                    if (Math.abs(L_a) > 1e-10) {
                        const m = -L_b/L_a, k = -L_c/L_a;
                        const A = c1.c + c1.b*m + c1.a*m*m;
                        const B = c1.b*k + 2*c1.a*m*k + c1.e + c1.d*m;
                        const C = c1.a*k*k + c1.d*k + c1.f;
                        const delta = B*B - 4*A*C;
                        if (delta >= 0) {
                            const y1 = (-B + Math.sqrt(delta))/(2*A);
                            const y2 = (-B - Math.sqrt(delta))/(2*A);
                            pts.push({x: m*y1 + k, y: y1});
                            if (delta > 1e-8) pts.push({x: m*y2 + k, y: y2});
                        }
                    }
                }
                const lines = pts.map(p => {
                    const dx = p.x - px;
                    const dy = p.y - py;
                    return { px, py, dx, dy };
                });
                return lines.length === 1 ? lines[0] : (lines.length ? lines : null);
            }
            
            // Tangent to Conic parallel to Line
            if (line && c1) {
                // Parallel to ax + by + c = 0 means tangent is ax + by + k = 0
                // Dual conic equation involves a, b, c.
                // Or simply substitute y = (-a/b)*x - k/b into conic, set discriminant to 0, solve for k.
                if (Math.abs(line.b) > 1e-10) {
                    const m = -line.a / line.b;
                    // c1.a x^2 + c1.b x(mx+k) + c1.c(mx+k)^2 + c1.d x + c1.e(mx+k) + c1.f = 0
                    // A x^2 + B x + C = 0
                    // A = a + bm + cm^2
                    // B = bk + 2cmk + d + em = (b + 2cm)k + (d + em)
                    // C = ck^2 + ek + f
                    const A = c1.a + c1.b*m + c1.c*m*m;
                    const b1 = c1.b + 2*c1.c*m;
                    const b2 = c1.d + c1.e*m;
                    // B = b1*k + b2
                    // C = c1.c*k^2 + c1.e*k + c1.f
                    // Discriminant = (b1*k + b2)^2 - 4*A*(c1.c*k^2 + c1.e*k + c1.f) = 0
                    // (b1^2 - 4*A*c1.c)k^2 + (2*b1*b2 - 4*A*c1.e)k + (b2^2 - 4*A*c1.f) = 0
                    const Q_a = b1*b1 - 4*A*c1.c;
                    const Q_b = 2*b1*b2 - 4*A*c1.e;
                    const Q_c = b2*b2 - 4*A*c1.f;
                    const delta = Q_b*Q_b - 4*Q_a*Q_c;
                    if (delta >= 0 && Math.abs(Q_a) > 1e-10) {
                        const k1 = (-Q_b + Math.sqrt(delta))/(2*Q_a);
                        const k2 = (-Q_b - Math.sqrt(delta))/(2*Q_a);
                        // Tangent lines: line.a * x + line.b * y + (-k1*line.b) = 0
                        // k is the intercept y = mx + k, so a x + b y - b k = 0
                        const l1_c = -line.b * k1;
                        const l2_c = -line.b * k2;
                        return [{a: line.a, b: line.b, c: l1_c}, {a: line.a, b: line.b, c: l2_c}];
                    } else if (Math.abs(Q_a) <= 1e-10 && Math.abs(Q_b) > 1e-10) {
                        // Linear in k (e.g. parabola)
                        const k1 = -Q_c / Q_b;
                        return {a: line.a, b: line.b, c: -line.b * k1};
                    }
                } else {
                    // Vertical line x = k
                    // c1.a k^2 + c1.b k y + c1.c y^2 + c1.d k + c1.e y + c1.f = 0
                    // c1.c y^2 + (c1.b k + c1.e) y + (c1.a k^2 + c1.d k + c1.f) = 0
                    // Delta = (b k + e)^2 - 4*c*(a k^2 + d k + f) = 0
                    const Q_a = c1.b*c1.b - 4*c1.c*c1.a;
                    const Q_b = 2*c1.b*c1.e - 4*c1.c*c1.d;
                    const Q_c = c1.e*c1.e - 4*c1.c*c1.f;
                    const delta = Q_b*Q_b - 4*Q_a*Q_c;
                    if (delta >= 0 && Math.abs(Q_a) > 1e-10) {
                        const k1 = (-Q_b + Math.sqrt(delta))/(2*Q_a);
                        const k2 = (-Q_b - Math.sqrt(delta))/(2*Q_a);
                        return [{a: 1, b: 0, c: -k1}, {a: 1, b: 0, c: -k2}];
                    } else if (Math.abs(Q_a) <= 1e-10 && Math.abs(Q_b) > 1e-10) {
                        const k1 = -Q_c / Q_b;
                        return {a: 1, b: 0, c: -k1};
                    }
                }
                return null;
            }
            
            // Common tangents of two conics is too heavy for simple algebraic expansion here,
            // normally involves finding roots of degree 4 polynomial. We will fall back to
            // an approximate method or return null if they aren't circles.
            if (c1 && c2 && c1 !== c2) {
                // If they are circles, we can easily find common tangents
                const isCirc = (c:any) => Math.abs(c.a - c.c) < 1e-8 && Math.abs(c.b) < 1e-8;
                if (isCirc(c1) && isCirc(c2)) {
                    const cx1 = -c1.d/(2*c1.a), cy1 = -c1.e/(2*c1.a);
                    const r1 = Math.sqrt(cx1*cx1 + cy1*cy1 - c1.f/c1.a);
                    const cx2 = -c2.d/(2*c2.a), cy2 = -c2.e/(2*c2.a);
                    const r2 = Math.sqrt(cx2*cx2 + cy2*cy2 - c2.f/c2.a);
                    // Standard circle common tangent solver could be added here
                    // For brevity, skipping the full 4 common tangents formula.
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
          const objs = codes.map((c: any) => c.evaluate(scope));
          const pts = objs.map((o: any) => parsePt(o)).filter(Boolean);
          const lines = objs.map((o: any) => toImplicitLine(o)).filter(Boolean);
          
          if (pts.length === 5) {
            const mat = pts.map(p => [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y, 1]);
            const getSub = (ci: number) => mat.map(row => row.filter((_, idx) => idx !== ci));
            const cofs = [
              determinant(getSub(0)),
              -determinant(getSub(1)),
              determinant(getSub(2)),
              -determinant(getSub(3)),
              determinant(getSub(4)),
              -determinant(getSub(5))
            ];
            return { a: cofs[0], b: cofs[1], c: cofs[2], d: cofs[3], e: cofs[4], f: cofs[5] };
          }
          
          if (pts.length + lines.length === 5) {
            // Numerical solver for mixed points and tangents
            // We want to find A, B, C, D, E, F (with norm 1) that minimizes:
            // For points: (Ax^2 + Bxy + Cy^2 + Dx + Ey + F)^2
            // For lines (u, v, w): The dual conic condition
            // Dual conic matrix adj(M):
            // M = [A, B/2, D/2; B/2, C, E/2; D/2, E/2, F]
            // We use a simple random-start gradient descent or genetic algo
            let bestParams = null;
            let bestError = Infinity;
            for(let attempt=0; attempt<50; attempt++) {
                let p = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5];
                for(let iter=0; iter<1000; iter++) {
                    let grad = [0,0,0,0,0,0];
                    let err = 0;
                    for (const pt of pts) {
                        const val = p[0]*pt.x*pt.x + p[1]*pt.x*pt.y + p[2]*pt.y*pt.y + p[3]*pt.x + p[4]*pt.y + p[5];
                        err += val*val;
                        grad[0] += 2*val*pt.x*pt.x; grad[1] += 2*val*pt.x*pt.y; grad[2] += 2*val*pt.y*pt.y;
                        grad[3] += 2*val*pt.x; grad[4] += 2*val*pt.y; grad[5] += 2*val;
                    }
                    for (const l of lines) {
                        const A = p[0], B = p[1]/2, C = p[2], D = p[3]/2, E = p[4]/2, F = p[5];
                        // Dual matrix elements
                        const AA = C*F - E*E;
                        const BB = 2*(D*E - B*F);
                        const CC = A*F - D*D;
                        const DD = 2*(B*E - C*D);
                        const EE = 2*(B*D - A*E);
                        const FF = A*C - B*B;
                        const u = l.a, v = l.b, w = l.c;
                        const val = AA*u*u + BB*u*v + CC*v*v + DD*u*w + EE*v*w + FF*w*w;
                        err += val*val * 0.001; // Scaled down to balance
                        // Numerical gradient for lines
                        for(let k=0; k<6; k++) {
                            const p2 = [...p]; p2[k] += 1e-5;
                            const A2 = p2[0], B2 = p2[1]/2, C2 = p2[2], D2 = p2[3]/2, E2 = p2[4]/2, F2 = p2[5];
                            const AA2 = C2*F2 - E2*E2; const BB2 = 2*(D2*E2 - B2*F2); const CC2 = A2*F2 - D2*D2;
                            const DD2 = 2*(B2*E2 - C2*D2); const EE2 = 2*(B2*D2 - A2*E2); const FF2 = A2*C2 - B2*B2;
                            const val2 = AA2*u*u + BB2*u*v + CC2*v*v + DD2*u*w + EE2*v*w + FF2*w*w;
                            grad[k] += (val2*val2 - val*val) / 1e-5 * 0.001;
                        }
                    }
                    // normalize p
                    let norm = Math.hypot(...p);
                    for(let i=0; i<6; i++) p[i] /= norm;
                    // descend
                    for(let i=0; i<6; i++) p[i] -= 0.01 * grad[i];
                }
                let finalErr = 0;
                for (const pt of pts) {
                    const val = p[0]*pt.x*pt.x + p[1]*pt.x*pt.y + p[2]*pt.y*pt.y + p[3]*pt.x + p[4]*pt.y + p[5];
                    finalErr += val*val;
                }
                for (const l of lines) {
                    const A = p[0], B = p[1]/2, C = p[2], D = p[3]/2, E = p[4]/2, F = p[5];
                    const AA = C*F - E*E, BB = 2*(D*E - B*F), CC = A*F - D*D, DD = 2*(B*E - C*D), EE = 2*(B*D - A*E), FF = A*C - B*B;
                    const val = AA*l.a*l.a + BB*l.a*l.b + CC*l.b*l.b + DD*l.a*l.c + EE*l.b*l.c + FF*l.c*l.c;
                    finalErr += val*val * 0.001;
                }
                if (finalErr < bestError) {
                    bestError = finalErr;
                    bestParams = p;
                }
            }
            if (bestParams && bestError < 1e-2) {
                return { a: bestParams[0], b: bestParams[1], c: bestParams[2], d: bestParams[3], e: bestParams[4], f: bestParams[5] };
            }
          }
          return null;
        };

        return {
          name,
          type: "implicit",
          vars: Array.from(vars),
          glslUniforms: ["u_conic_a", "u_conic_b", "u_conic_c", "u_conic_d", "u_conic_e", "u_conic_f"],
          conicData: getConicData,
          fnImplicit: (x: number, y: number, scope: any) => {
            let cd = scope.__conic_cache || getConicData(scope);
            if (cd) return cd.a * x * x + cd.b * x * y + cd.c * y * y + cd.d * x + cd.e * y + cd.f;
            return NaN;
          },
          glslExpr: "u_conic_a * x * x + u_conic_b * x * y + u_conic_c * y * y + u_conic_d * x + u_conic_e * y + u_conic_f"
        };
      }
    }
  } catch (e) {
    // Not a valid AST geometric function, let evaluator fallback handle it.
  }

  return null;
}
