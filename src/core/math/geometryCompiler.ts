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
  if (Array.isArray(l) && l.length > 0) l = l[0];
  if (
    typeof l.a === "number" &&
    typeof l.b === "number" &&
    typeof l.c === "number" &&
    typeof l.d !== "number" // ensure it's not a conic
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

function toImplicitLine(l: any) {
  return toImplicit(l);
}

function toImplicitConic(c: any) {
  if (!c) return null;
  if (typeof c.a === 'number' && typeof c.b === 'number' && typeof c.c === 'number' && typeof c.d === 'number' && typeof c.e === 'number' && typeof c.f === 'number') {
    return c;
  }
  if (typeof c.cx === 'number' && typeof c.cy === 'number') {
    if (typeof c.r === 'number') {
      return {
        a: 1,
        b: 0,
        c: 1,
        d: -2 * c.cx,
        e: -2 * c.cy,
        f: c.cx * c.cx + c.cy * c.cy - c.r * c.r
      };
    }
    if (typeof c.rx === 'number' && typeof c.ry === 'number') {
      const rx2 = c.rx * c.rx;
      const ry2 = c.ry * c.ry;
      return {
        a: ry2,
        b: 0,
        c: rx2,
        d: -2 * c.cx * ry2,
        e: -2 * c.cy * rx2,
        f: c.cx * c.cx * ry2 + c.cy * c.cy * rx2 - rx2 * ry2
      };
    }
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
            const isLine = (o: any) => {
                if (Array.isArray(o) && o.length > 0) o = o[0];
                return o && (typeof o.px === "number" || (typeof o.a === "number" && typeof o.f !== "number"));
            };
            if (isLine(curve)) {
                let l = Array.isArray(curve) && curve.length > 0 ? curve[0] : curve;
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
            } else if (curve && typeof curve.x1 === "number" && typeof curve.x2 === "number") {
                const l2 = (curve.x1 - curve.x2)**2 + (curve.y1 - curve.y2)**2;
                if (l2 === 0) return { x: curve.x1, y: curve.y1 };
                let t = ((px - curve.x1) * (curve.x2 - curve.x1) + (py - curve.y1) * (curve.y2 - curve.y1)) / l2;
                t = Math.max(0, Math.min(1, t));
                return { x: curve.x1 + t * (curve.x2 - curve.x1), y: curve.y1 + t * (curve.y2 - curve.y1) };
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
        if (Array.isArray(val)) {
          // Array of {x,y} objects (e.g. multiple intersection points) — take first
          if (val.length > 0 && val[0] !== null && typeof val[0] === 'object' && typeof val[0].x === 'number') {
            return { x: val[0].x, y: val[0].y };
          }
          // Numeric [x, y] array
          return { x: val[0], y: val[1] };
        }
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
          isDraggable: false,
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
        if (Array.isArray(o) && o.length > 0) o = o[0];
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
            const isLine = (o: any) => {
              if (Array.isArray(o) && o.length > 0) o = o[0];
              return o && (typeof o.px === "number" || typeof o.a === "number");
            };
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
            const isLineOrSegment = (o: any) => {
              if (Array.isArray(o) && o.length > 0) o = o[0];
              return o &&
              (typeof o.px === "number" ||
                typeof o.a === "number" ||
                typeof o.x1 === "number");
            };
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
            if (codes.length === 2) {
              const l1 = toImplicitLine(codes[0].evaluate(scope));
              const l2 = toImplicitLine(codes[1].evaluate(scope));
              if (l1 && l2) {
                const len1 = Math.sqrt(l1.a * l1.a + l1.b * l1.b);
                const len2 = Math.sqrt(l2.a * l2.a + l2.b * l2.b);
                if (len1 > 0 && len2 > 0) {
                  const a1 = l1.a / len1, b1 = l1.b / len1, c1 = l1.c / len1;
                  const a2 = l2.a / len2, b2 = l2.b / len2, c2 = l2.c / len2;
                  return [
                    { a: a1 - a2, b: b1 - b2, c: c1 - c2 },
                    { a: a1 + a2, b: b1 + b2, c: c1 + c2 },
                  ];
                }
              }
            } else {
              const pt1 = parsePt(codes[0].evaluate(scope));
              const pt2 = parsePt(codes[1].evaluate(scope));
              const pt3 = parsePt(codes[2].evaluate(scope));
              if (pt1 && pt2 && pt3) {
                 const dx1 = pt1.x - pt2.x;
                 const dy1 = pt1.y - pt2.y;
                 const len1 = Math.hypot(dx1, dy1);
                 
                 const dx2 = pt3.x - pt2.x;
                 const dy2 = pt3.y - pt2.y;
                 const len2 = Math.hypot(dx2, dy2);
                 
                 if (len1 > 0 && len2 > 0) {
                     const nx1 = dx1 / len1;
                     const ny1 = dy1 / len1;
                     const nx2 = dx2 / len2;
                     const ny2 = dy2 / len2;
                     
                     let bx = nx1 + nx2;
                     let by = ny1 + ny2;
                     
                     if (Math.hypot(bx, by) < 1e-8) {
                         bx = -ny1;
                         by = nx1;
                     }
                     return { px: pt2.x, py: pt2.y, dx: bx, dy: by };
                 }
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
          isDraggable: false,
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
            
            const filterPts = (pts: {x:number, y:number}[]) => {
                if (!pts || pts.length === 0) return null;
                const uniquePts = [];
                for (const p of pts) {
                    if (!uniquePts.some(up => Math.hypot(up.x - p.x, up.y - p.y) < 1e-4)) {
                        uniquePts.push(p);
                    }
                }
                if (codes.length >= 3) {
                    const ref = codes[2].evaluate(scope);
                    const refPt = parsePt(ref);
                    if (refPt && uniquePts.length > 0) {
                        uniquePts.sort((a, b) => Math.hypot(a.x - refPt.x, a.y - refPt.y) - Math.hypot(b.x - refPt.x, b.y - refPt.y));
                        return uniquePts[0];
                    }
                }
                return uniquePts.length === 1 ? uniquePts[0] : uniquePts;
            };

            
            if (l1 && l2) {
              const det = l1.a * l2.b - l2.a * l1.b;
              if (Math.abs(det) > 1e-10) {
                return { x: (l1.b * l2.c - l2.b * l1.c) / det, y: (l2.a * l1.c - l1.a * l2.c) / det };
              }
              return null;
            }
            
            const conicArg = c1 && !l1 ? c1 : (c2 && !l2 ? c2 : null);
            const lineArg = l1 && !c1 ? l1 : (l2 && !c2 ? l2 : null);

            // In some cases, toImplicitConic also handles circles which might be parsed as lines if they are degenerate, 
            // but let's just properly check if we have one line and one conic.
            if ((c1 && l2 && !l1) || (c2 && l1 && !c1)) {
                const theConic = (c1 && l2 && !l1) ? c1 : c2;
                const theLine = (c1 && l2 && !l1) ? l2 : l1;
                
                // Line: a*x + b*y + c = 0
                // Conic: a*x^2 + b*xy + c*y^2 + d*x + e*y + f = 0
                const pts = [];
                if (Math.abs(theLine.b) > Math.abs(theLine.a)) {
                    // y = -(theLine.a*x + theLine.c)/theLine.b
                    const m = -theLine.a/theLine.b, k = -theLine.c/theLine.b;
                    const A = theConic.a + theConic.b*m + theConic.c*m*m;
                    const B = theConic.b*k + 2*theConic.c*m*k + theConic.d + theConic.e*m;
                    const C = theConic.c*k*k + theConic.e*k + theConic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const x1 = (-B + Math.sqrt(delta))/(2*A);
                        const x2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: x1, y: m*x1 + k});
                        if (delta > 1e-8) pts.push({x: x2, y: m*x2 + k});
                    }
                } else if (Math.abs(theLine.a) > 1e-10) {
                    const m = -theLine.b/theLine.a, k = -theLine.c/theLine.a;
                    const A = theConic.c + theConic.b*m + theConic.a*m*m;
                    const B = theConic.b*k + 2*theConic.a*m*k + theConic.e + theConic.d*m;
                    const C = theConic.a*k*k + theConic.d*k + theConic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const y1 = (-B + Math.sqrt(delta))/(2*A);
                        const y2 = (-B - Math.sqrt(delta))/(2*A);
                        pts.push({x: m*y1 + k, y: y1});
                        if (delta > 1e-8) pts.push({x: m*y2 + k, y: y2});
                    }
                }
                return filterPts(pts);
            }
            
            if (c1 && c2 && !(c1 === c2)) {
                // If both are circles, we can solve analytically by intersecting the radical axis with one circle
                const isCirc = (c:any) => Math.abs(c.a - c.c) < 1e-8 && Math.abs(c.b) < 1e-8 && Math.abs(c.a) > 1e-10;
                if (isCirc(c1) && isCirc(c2)) {
                    // Normalize
                    const d1 = c1.d/c1.a, e1 = c1.e/c1.a, f1 = c1.f/c1.a;
                    const d2 = c2.d/c2.a, e2 = c2.e/c2.a, f2 = c2.f/c2.a;
                    
                    // Radical axis: (d1-d2)x + (e1-e2)y + (f1-f2) = 0
                    const L_a = d1 - d2;
                    const L_b = e1 - e2;
                    const L_c = f1 - f2;
                    
                    if (Math.hypot(L_a, L_b) > 1e-10) {
                        // Intersect line L with circle c1
                        const pts = [];
                        if (Math.abs(L_b) > Math.abs(L_a)) {
                            const m = -L_a/L_b, k = -L_c/L_b;
                            const A = 1 + m*m;
                            const B = 2*m*k + d1 + e1*m;
                            const C = k*k + e1*k + f1;
                            const delta = B*B - 4*A*C;
                            if (delta >= 0 && Math.abs(A) > 1e-10) {
                                const x1 = (-B + Math.sqrt(delta))/(2*A);
                                const x2 = (-B - Math.sqrt(delta))/(2*A);
                                pts.push({x: x1, y: m*x1 + k});
                                if (delta > 1e-8) pts.push({x: x2, y: m*x2 + k});
                            }
                        } else {
                            const m = -L_b/L_a, k = -L_c/L_a;
                            const A = 1 + m*m;
                            const B = 2*m*k + e1 + d1*m;
                            const C = k*k + d1*k + f1;
                            const delta = B*B - 4*A*C;
                            if (delta >= 0 && Math.abs(A) > 1e-10) {
                                const y1 = (-B + Math.sqrt(delta))/(2*A);
                                const y2 = (-B - Math.sqrt(delta))/(2*A);
                                pts.push({x: m*y1 + k, y: y1});
                                if (delta > 1e-8) pts.push({x: m*y2 + k, y: y2});
                            }
                        }
                        return filterPts(pts);
                    } else {
                        // Concentric circles
                        return null;
                    }
                }

                // Try robust parametric intersection if at least one is bounded (circle or ellipse)
                const getParametric = (o: any) => {
                    if (o && typeof o.cx === 'number' && typeof o.cy === 'number') {
                        if (typeof o.r === 'number') return { cx: o.cx, cy: o.cy, rx: o.r, ry: o.r };
                        if (typeof o.rx === 'number' && typeof o.ry === 'number') return { cx: o.cx, cy: o.cy, rx: o.rx, ry: o.ry };
                    }
                    return null;
                };

                const p1 = getParametric(o1);
                const p2 = getParametric(o2);

                if (p1 || p2) {
                    const paramCurve = p1 || p2;
                    const implicitConic = p1 ? c2 : c1;

                    const pts = [];
                    const steps = 720; // 0.5 degree steps
                    for(let i=0; i<steps; i++) {
                        const t = i * 2 * Math.PI / steps;
                        const x = paramCurve.cx + paramCurve.rx * Math.cos(t);
                        const y = paramCurve.cy + paramCurve.ry * Math.sin(t);
                        const v = implicitConic.a*x*x + implicitConic.b*x*y + implicitConic.c*y*y + implicitConic.d*x + implicitConic.e*y + implicitConic.f;
                        
                        const t_next = (i+1) * 2 * Math.PI / steps;
                        const x_next = paramCurve.cx + paramCurve.rx * Math.cos(t_next);
                        const y_next = paramCurve.cy + paramCurve.ry * Math.sin(t_next);
                        const v_next = implicitConic.a*x_next*x_next + implicitConic.b*x_next*y_next + implicitConic.c*y_next*y_next + implicitConic.d*x_next + implicitConic.e*y_next + implicitConic.f;

                        if (v * v_next <= 0) {
                            // Sign change! A root exists between t and t_next
                            // Use binary search (bisection) to find the exact t
                            let t_a = t, t_b = t_next;
                            let v_a = v;
                            for(let j=0; j<25; j++) {
                                const t_mid = (t_a + t_b) / 2;
                                const x_mid = paramCurve.cx + paramCurve.rx * Math.cos(t_mid);
                                const y_mid = paramCurve.cy + paramCurve.ry * Math.sin(t_mid);
                                const v_mid = implicitConic.a*x_mid*x_mid + implicitConic.b*x_mid*y_mid + implicitConic.c*y_mid*y_mid + implicitConic.d*x_mid + implicitConic.e*y_mid + implicitConic.f;
                                if (v_a * v_mid <= 0) {
                                    t_b = t_mid;
                                } else {
                                    t_a = t_mid; 
                                    v_a = v_mid;
                                }
                            }
                            const t_root = (t_a + t_b) / 2;
                            const rx = paramCurve.cx + paramCurve.rx * Math.cos(t_root);
                            const ry = paramCurve.cy + paramCurve.ry * Math.sin(t_root);
                            if (!pts.some(pt => Math.hypot(pt.x-rx, pt.y-ry) < 1e-3)) {
                                pts.push({x: rx, y: ry});
                            }
                        }
                    }
                    return filterPts(pts);
                }

                // General numeric solver for generic conics intersections
                // Grid search + Newton
                
                // Normalize coefficients to prevent scaling issues with determinant-based conics
                const norm1 = Math.hypot(c1.a, c1.b, c1.c, c1.d, c1.e, c1.f);
                const norm2 = Math.hypot(c2.a, c2.b, c2.c, c2.d, c2.e, c2.f);
                const nc1 = { a: c1.a/norm1, b: c1.b/norm1, c: c1.c/norm1, d: c1.d/norm1, e: c1.e/norm1, f: c1.f/norm1 };
                const nc2 = { a: c2.a/norm2, b: c2.b/norm2, c: c2.c/norm2, d: c2.d/norm2, e: c2.e/norm2, f: c2.f/norm2 };

                const pts = [];
                for(let x = -2000; x <= 2000; x+=25.0) {
                    for(let y = -2000; y <= 2000; y+=25.0) {
                        let cx = x, cy = y;
                        for(let i=0; i<20; i++) {
                            const v1 = nc1.a*cx*cx + nc1.b*cx*cy + nc1.c*cy*cy + nc1.d*cx + nc1.e*cy + nc1.f;
                            const v2 = nc2.a*cx*cx + nc2.b*cx*cy + nc2.c*cy*cy + nc2.d*cx + nc2.e*cy + nc2.f;
                            if (Math.abs(v1) < 1e-7 && Math.abs(v2) < 1e-7) break;
                            const J11 = 2*nc1.a*cx + nc1.b*cy + nc1.d;
                            const J12 = 2*nc1.c*cy + nc1.b*cx + nc1.e;
                            const J21 = 2*nc2.a*cx + nc2.b*cy + nc2.d;
                            const J22 = 2*nc2.c*cy + nc2.b*cx + nc2.e;
                            const det = J11*J22 - J12*J21;
                            if (Math.abs(det) < 1e-12) break;
                            cx -= (J22*v1 - J12*v2)/det;
                            cy -= (-J21*v1 + J11*v2)/det;
                        }
                        const final_v1 = nc1.a*cx*cx + nc1.b*cx*cy + nc1.c*cy*cy + nc1.d*cx + nc1.e*cy + nc1.f;
                        const final_v2 = nc2.a*cx*cx + nc2.b*cx*cy + nc2.c*cy*cy + nc2.d*cx + nc2.e*cy + nc2.f;
                        if (Math.abs(final_v1) < 1e-6 && Math.abs(final_v2) < 1e-6) {
                            if (!pts.some(p => Math.hypot(p.x-cx, p.y-cy) < 1e-3)) {
                                pts.push({x: cx, y: cy});
                            }
                        }
                    }
                }
                return filterPts(pts);
            }
            return null;
          },
        };
      }

      /** @brief Helper: compute all tangent lines from a point to a conic, or from point on conic. */
      const computeTangentLines = (o1: any, o2: any): any | null => {
            const parsedPt1 = parsePt(o1);
            const parsedPt2 = parsePt(o2);
            const c1i = toImplicitConic(o1);
            const c2i = toImplicitConic(o2);
            const l1i = toImplicitLine(o1);
            const l2i = toImplicitLine(o2);
            const lineArg = l1i || l2i;

            let pt: {x:number, y:number} | null = null;
            let conic: any = null;
            if (parsedPt1 && c2i) { pt = parsedPt1; conic = c2i; }
            else if (parsedPt2 && c1i) { pt = parsedPt2; conic = c1i; }

            if (pt && conic) {
                const px = pt.x, py = pt.y;
                const L_a = conic.a * px + (conic.b/2) * py + conic.d/2;
                const L_b = conic.c * py + (conic.b/2) * px + conic.e/2;
                const L_c = (conic.d/2) * px + (conic.e/2) * py + conic.f;
                if (Math.hypot(L_a, L_b) < 1e-10) return null;

                // Check if point is ON conic
                const F_val = conic.a*px*px + conic.b*px*py + conic.c*py*py + conic.d*px + conic.e*py + conic.f;
                const Gx = 2*conic.a*px + conic.b*py + conic.d;
                const Gy = 2*conic.c*py + conic.b*px + conic.e;
                const gradMag = Math.hypot(Gx, Gy);
                const distToConic = gradMag > 1e-10 ? Math.abs(F_val) / gradMag : Math.abs(F_val);
                if (distToConic < 0.1) {
                    return { a: L_a, b: L_b, c: L_c }; // single tangent at point on conic
                }

                // External point: chord of contact intersections → two tangent lines
                const tangentPts: {x:number, y:number}[] = [];
                if (Math.abs(L_b) > Math.abs(L_a)) {
                    const m = -L_a/L_b, k = -L_c/L_b;
                    const A = conic.a + conic.b*m + conic.c*m*m;
                    const B = conic.b*k + 2*conic.c*m*k + conic.d + conic.e*m;
                    const C = conic.c*k*k + conic.e*k + conic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const x1 = (-B + Math.sqrt(delta))/(2*A);
                        const x2 = (-B - Math.sqrt(delta))/(2*A);
                        tangentPts.push({x: x1, y: m*x1 + k});
                        if (delta > 1e-8) tangentPts.push({x: x2, y: m*x2 + k});
                    }
                } else if (Math.abs(L_a) > 1e-10) {
                    const m = -L_b/L_a, k = -L_c/L_a;
                    const A = conic.c + conic.b*m + conic.a*m*m;
                    const B = conic.b*k + 2*conic.a*m*k + conic.e + conic.d*m;
                    const C = conic.a*k*k + conic.d*k + conic.f;
                    const delta = B*B - 4*A*C;
                    if (delta >= 0 && Math.abs(A) > 1e-10) {
                        const y1 = (-B + Math.sqrt(delta))/(2*A);
                        const y2 = (-B - Math.sqrt(delta))/(2*A);
                        tangentPts.push({x: m*y1 + k, y: y1});
                        if (delta > 1e-8) tangentPts.push({x: m*y2 + k, y: y2});
                    }
                }
                if (tangentPts.length === 0) return null;
                const tLines = tangentPts.map(p => ({ px, py, dx: p.x - px, dy: p.y - py }));
                return tLines.length === 1 ? tLines[0] : tLines;
            }

            // Tangent to Conic parallel to Line
            if (lineArg && (c1i || c2i)) {
                const co = c1i || c2i;
                if (Math.abs(lineArg.b) > 1e-10) {
                    const m = -lineArg.a / lineArg.b;
                    const A = co.a + co.b*m + co.c*m*m;
                    const b1 = co.b + 2*co.c*m;
                    const b2 = co.d + co.e*m;
                    const Q_a = b1*b1 - 4*A*co.c;
                    const Q_b = 2*b1*b2 - 4*A*co.e;
                    const Q_c = b2*b2 - 4*A*co.f;
                    const delta = Q_b*Q_b - 4*Q_a*Q_c;
                    if (delta >= 0 && Math.abs(Q_a) > 1e-10) {
                        const k1 = (-Q_b + Math.sqrt(delta))/(2*Q_a);
                        const k2 = (-Q_b - Math.sqrt(delta))/(2*Q_a);
                        return [{a: lineArg.a, b: lineArg.b, c: -lineArg.b * k1}, {a: lineArg.a, b: lineArg.b, c: -lineArg.b * k2}];
                    } else if (Math.abs(Q_a) <= 1e-10 && Math.abs(Q_b) > 1e-10) {
                        return {a: lineArg.a, b: lineArg.b, c: -lineArg.b * (-Q_c/Q_b)};
                    }
                } else {
                    const Q_a = co.b*co.b - 4*co.c*co.a;
                    const Q_b = 2*co.b*co.e - 4*co.c*co.d;
                    const Q_c = co.e*co.e - 4*co.c*co.f;
                    const delta = Q_b*Q_b - 4*Q_a*Q_c;
                    if (delta >= 0 && Math.abs(Q_a) > 1e-10) {
                        const k1 = (-Q_b + Math.sqrt(delta))/(2*Q_a);
                        const k2 = (-Q_b - Math.sqrt(delta))/(2*Q_a);
                        return [{a: 1, b: 0, c: -k1}, {a: 1, b: 0, c: -k2}];
                    } else if (Math.abs(Q_a) <= 1e-10 && Math.abs(Q_b) > 1e-10) {
                        return {a: 1, b: 0, c: -(-Q_c/Q_b)};
                    }
                }
            }

            // Circle-Circle common tangents
            if (o1 && o2 && typeof o1.cx === 'number' && typeof o1.cy === 'number' && typeof o1.r === 'number' &&
                typeof o2.cx === 'number' && typeof o2.cy === 'number' && typeof o2.r === 'number') {
                const cx1 = o1.cx, cy1 = o1.cy, r1 = o1.r;
                const cx2 = o2.cx, cy2 = o2.cy, r2 = o2.r;
                const dx = cx2 - cx1;
                const dy = cy2 - cy1;
                const d = Math.hypot(dx, dy);
                if (d > 1e-6) {
                    const theta = Math.atan2(dy, dx);
                    const tangents = [];

                    // External tangents (exist if d >= |r1 - r2|)
                    const R_ext = r2 - r1;
                    if (d >= Math.abs(R_ext)) {
                        const cosAlpha = R_ext / d;
                        const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
                        for (const sign of [-1, 1]) {
                            const a = cosAlpha * (dx/d) - sign * sinAlpha * (dy/d);
                            const b = cosAlpha * (dy/d) + sign * sinAlpha * (dx/d);
                            const c = r1 - (a * cx1 + b * cy1);
                            tangents.push({ a, b, c });
                        }
                    }

                    // Internal tangents (exist if d >= r1 + r2)
                    const R_int = r1 + r2;
                    if (d >= R_int) {
                        const cosAlpha = R_int / d;
                        const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
                        for (const sign of [-1, 1]) {
                            const a = cosAlpha * (dx/d) - sign * sinAlpha * (dy/d);
                            const b = cosAlpha * (dy/d) + sign * sinAlpha * (dx/d);
                            const c = -r1 - (a * cx1 + b * cy1);
                            tangents.push({ a, b, c });
                        }
                    }
                    if (tangents.length) return tangents;
                }
            }
            return null;
      };

      // Tangent(P, curve) — returns all tangent lines (may be array for external point)
      if (fnName === "tangent" && args.length === 2) {
        Logger.debug("GeometryCompiler", "Compiling Tangent (2-arg) representation.");
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            return computeTangentLines(codes[0].evaluate(scope), codes[1].evaluate(scope));
          },
        };
      }

      // Tangent(P, curve, n) — returns only the nth tangent line (1-indexed)
      // This allows each tangent to be its own independent line expression.
      if (fnName === "tangent" && args.length === 3) {
        Logger.debug("GeometryCompiler", "Compiling Tangent (3-arg indexed) representation.");
        const codes = compileArgs();
        return {
          name,
          type: "line",
          vars: Array.from(vars),
          lineData: (scope: any) => {
            const o1 = codes[0].evaluate(scope);
            const o2 = codes[1].evaluate(scope);
            const idx = Math.round(codes[2].evaluate(scope)) - 1;
            const all = computeTangentLines(o1, o2);
            if (all === null) return null;
            if (!Array.isArray(all)) {
                // single line (point on conic)
                return idx === 0 ? all : null;
            }
            return all[idx] ?? null;
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
            const norm = Math.hypot(...cofs) || 1;
            return { a: cofs[0]/norm, b: cofs[1]/norm, c: cofs[2]/norm, d: cofs[3]/norm, e: cofs[4]/norm, f: cofs[5]/norm };
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
