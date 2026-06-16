/**
 * @file geometryCompiler.ts
 * @brief Parses and compiles geometric and physics configurations into evaluatable runtime objects.
 * @details This module supports point generation, complex parametric objects, physics node extraction (including cloths), and fractals mapping straight to GLSL shaders (Mandelbrot, Julia).
 */
import { parse } from "mathjs";
import { Logger } from "../../utils/logger";
import { extractVars } from "./transformers";
import type { CompiledEquationData } from "./evaluator";

/**
 * @brief Compiles a geometric expression string into a structured CompiledEquationData object.
 * @param exprText The raw equation input string (e.g., 'Point(2,3)', 'Mandelbrot()').
 * @param name The equation label, if assigning to a variable.
 * @param vars A set of variables discovered during initial parse, updated by this function.
 * @return CompiledEquationData if recognized, otherwise null.
 */
export function compileGeometry(
  exprText: string,
  name: string | undefined,
  vars: Set<string>,
): CompiledEquationData | null {
  const fourierMatch = exprText.match(
    /^\s*Fourier\s*\(\s*([^,]+)(?:,\s*([^)]+))?\s*\)\s*$/i,
  );
  if (fourierMatch) {
    Logger.debug("GeometryCompiler", "Compiling Fourier representation.");
    const nodeX = parse(fourierMatch[1]);
    const nodeY = fourierMatch[2] ? parse(fourierMatch[2]) : null;
    extractVars(nodeX, vars);
    if (nodeY) extractVars(nodeY, vars);
    const codeX = nodeX.compile();
    const codeY = nodeY ? nodeY.compile() : null;
    return {
      name,
      type: "fourier",
      vars: Array.from(vars),
      dataFn: (scope: any) => {
        try {
          let resX = codeX.evaluate(scope);
          resX = resX?.toArray ? resX.toArray() : resX;
          if (codeY) {
            let resY = codeY.evaluate(scope);
            resY = resY?.toArray ? resY.toArray() : resY;
            const pts = [];
            for (let i = 0; i < Math.min(resX.length, resY.length); i++) {
              pts.push({ x: resX[i], y: resY[i] });
            }
            return pts;
          }
          return Array.isArray(resX) ? resX : [resX];
        } catch { return []; }
      },
    };
  }

  const voronoiMatch = exprText.match(
    /^\s*Voronoi\s*\(\s*([^,]+)(?:,\s*([^)]+))?\s*\)\s*$/i,
  );
  if (voronoiMatch) {
    Logger.debug("GeometryCompiler", "Compiling Voronoi representation.");
    const nodeX = parse(voronoiMatch[1]);
    const nodeY = voronoiMatch[2] ? parse(voronoiMatch[2]) : null;
    extractVars(nodeX, vars);
    if (nodeY) extractVars(nodeY, vars);
    const codeX = nodeX.compile();
    const codeY = nodeY ? nodeY.compile() : null;
    return {
      name,
      type: "voronoi",
      vars: Array.from(vars),
      dataFn: (scope: any) => {
        try {
          let resX = codeX.evaluate(scope);
          resX = resX?.toArray ? resX.toArray() : resX;
          if (codeY) {
            let resY = codeY.evaluate(scope);
            resY = resY?.toArray ? resY.toArray() : resY;
            const pts = [];
            for (let i = 0; i < Math.min(resX.length, resY.length); i++) {
              pts.push({ x: resX[i], y: resY[i] });
            }
            return pts;
          }
          return Array.isArray(resX) ? resX : [resX];
        } catch { return []; }
      },
    };
  }

  const delaunayMatch = exprText.match(
    /^\s*Delaunay\s*\(\s*([^,]+)(?:,\s*([^)]+))?\s*\)\s*$/i,
  );
  if (delaunayMatch) {
    Logger.debug("GeometryCompiler", "Compiling Delaunay representation.");
    const nodeX = parse(delaunayMatch[1]);
    const nodeY = delaunayMatch[2] ? parse(delaunayMatch[2]) : null;
    extractVars(nodeX, vars);
    if (nodeY) extractVars(nodeY, vars);
    const codeX = nodeX.compile();
    const codeY = nodeY ? nodeY.compile() : null;
    return {
      name,
      type: "delaunay",
      vars: Array.from(vars),
      dataFn: (scope: any) => {
        try {
          let resX = codeX.evaluate(scope);
          resX = resX?.toArray ? resX.toArray() : resX;
          if (codeY) {
            let resY = codeY.evaluate(scope);
            resY = resY?.toArray ? resY.toArray() : resY;
            const pts = [];
            for (let i = 0; i < Math.min(resX.length, resY.length); i++) {
              pts.push({ x: resX[i], y: resY[i] });
            }
            return pts;
          }
          return Array.isArray(resX) ? resX : [resX];
        } catch { return []; }
      },
    };
  }

  const transformMatch = exprText.match(/^\s*Transform\s*\(\s*(.+?)\s*\)\s*$/i);
  if (transformMatch) {
    Logger.debug(
      "GeometryCompiler",
      "Compiling global Transform representation.",
    );
    const matNode = parse(transformMatch[1]);
    extractVars(matNode, vars);
    const matCode = matNode.compile();
    return {
      name,
      type: "action",
      vars: Array.from(vars),
      actionExecute: (scope: any) => {
        const m = matCode.evaluate(scope);
        return {
          target: "__globalTransform",
          value: m?.toArray ? m.toArray() : m,
        };
      },
    };
  }

  const pointMatch = exprText.match(/^\s*\((.+?),(.+?)\)\s*$/);
  if (pointMatch) {
    Logger.debug("GeometryCompiler", "Compiling point representation.");
    const xNode = parse(pointMatch[1]);
    const yNode = parse(pointMatch[2]);
    extractVars(xNode, vars);
    extractVars(yNode, vars);
    const xCode = xNode.compile();
    const yCode = yNode.compile();

    const isParametric = vars.has("u") || vars.has("theta") || vars.has("t");
    const paramName = vars.has("u") ? "u" : vars.has("theta") ? "theta" : vars.has("t") ? "t" : null;

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
  }

  const segmentMatch = exprText.match(
    /^\s*Segment\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (segmentMatch) {
    Logger.debug("GeometryCompiler", "Compiling segment representation.");
    const aNode = parse(segmentMatch[1]);
    const bNode = parse(segmentMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "segment",
      vars: Array.from(vars),
      segmentData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        if (Array.isArray(A) && Array.isArray(B))
          return { x1: A[0], y1: A[1], x2: B[0], y2: B[1] };
        if (A && B && typeof A.x === "number" && typeof B.x === "number")
          return { x1: A.x, y1: A.y, x2: B.x, y2: B.y };
        return null;
      },
    };
  }

  const circle3Match = exprText.match(
    /^\s*Circle\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (circle3Match) {
    Logger.debug("GeometryCompiler", "Compiling 3-point circle representation.");
    const aNode = parse(circle3Match[1]);
    const bNode = parse(circle3Match[2]);
    const cNode = parse(circle3Match[3]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    extractVars(cNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    const cCode = cNode.compile();
    return {
      name,
      type: "circle",
      vars: Array.from(vars),
      circleData: (scope: any) => {
        const parsePt = (val: any) => {
          if (Array.isArray(val)) return { x: val[0], y: val[1] };
          if (val && typeof val.x === "number") return { x: val.x, y: val.y };
          return null;
        };
        const p1 = parsePt(aCode.evaluate(scope));
        const p2 = parsePt(bCode.evaluate(scope));
        const p3 = parsePt(cCode.evaluate(scope));
        
        if (p1 && p2 && p3) {
          const temp = p2.x * p2.x + p2.y * p2.y;
          const bc = (p1.x * p1.x + p1.y * p1.y - temp) / 2;
          const cd = (temp - p3.x * p3.x - p3.y * p3.y) / 2;
          const det = (p1.x - p2.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p2.y);
          if (Math.abs(det) < 1e-6) return null; // Collinear
          const cx = (bc * (p2.y - p3.y) - cd * (p1.y - p2.y)) / det;
          const cy = ((p1.x - p2.x) * cd - (p2.x - p3.x) * bc) / det;
          const r = Math.sqrt((cx - p1.x) ** 2 + (cy - p1.y) ** 2);
          return { cx, cy, r };
        }
        return null;
      },
    };
  }

  const midpointMatch = exprText.match(
    /^\s*Midpoint\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (midpointMatch) {
    Logger.debug("GeometryCompiler", "Compiling Midpoint representation.");
    const aNode = parse(midpointMatch[1]);
    const bNode = parse(midpointMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "point",
      vars: Array.from(vars),
      pointData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
        
        if (p1 && p2) {
          return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        }
        return { x: NaN, y: NaN };
      },
    };
  }

  const circleMatch = exprText.match(
    /^\s*Circle\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (circleMatch) {
    Logger.debug("GeometryCompiler", "Compiling circle representation.");
    const aNode = parse(circleMatch[1]);
    const bNode = parse(circleMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "circle",
      vars: Array.from(vars),
      circleData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };

        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };

        if (p1 && p2) {
          const r = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
          return { cx: p1.x, cy: p1.y, r };
        }
        return null;
      },
    };
  }

  const lineMatch = exprText.match(
    /^\s*Line\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (lineMatch) {
    Logger.debug("GeometryCompiler", "Compiling Line representation.");
    const aNode = parse(lineMatch[1]);
    const bNode = parse(lineMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
        if (p1 && p2)
          return { px: p1.x, py: p1.y, dx: p2.x - p1.x, dy: p2.y - p1.y };
        return null;
      },
    };
  }

  const perpMatch = exprText.match(
    /^\s*Perpendicular\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (perpMatch) {
    Logger.debug("GeometryCompiler", "Compiling Perpendicular representation.");
    const aNode = parse(perpMatch[1]);
    const bNode = parse(perpMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const p1 = aCode.evaluate(scope);
        const p2 = bCode.evaluate(scope);
        let pt, line;
        
        // Find which argument is the point and which is the line
        if (p1 && typeof p1.a === "number") { line = p1; pt = p2; }
        else if (p2 && typeof p2.a === "number") { line = p2; pt = p1; }
        
        if (Array.isArray(pt)) pt = { x: pt[0], y: pt[1] };
        else if (pt && typeof pt.x === "number") pt = { x: pt.x, y: pt.y };

        if (pt && line) {
          return { a: line.b, b: -line.a, c: line.a * pt.y - line.b * pt.x };
        }
        return { a: NaN, b: NaN, c: NaN };
      },
    };
  }

  const perpBisectorMatch = exprText.match(
    /^\s*PerpendicularBisector\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (perpBisectorMatch) {
    Logger.debug(
      "GeometryCompiler",
      "Compiling PerpendicularBisector representation.",
    );
    const aNode = parse(perpBisectorMatch[1]);
    const bNode = parse(perpBisectorMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
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

  const angleBisectorMatch = exprText.match(
    /^\s*AngleBisector\s*\(\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*(.+?)\s*)?\)\s*$/i,
  );
  if (angleBisectorMatch) {
    Logger.debug("GeometryCompiler", "Compiling AngleBisector representation.");
    const aNode = parse(angleBisectorMatch[1]);
    const bNode = parse(angleBisectorMatch[2]);
    const cNode = angleBisectorMatch[3] ? parse(angleBisectorMatch[3]) : null;
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    if (cNode) extractVars(cNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    const cCode = cNode ? cNode.compile() : null;
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        
        // 2 lines case
        if (!cCode) {
            if (A && B && typeof A.px === "number" && typeof B.px === "number") {
                const det = A.dx * B.dy - A.dy * B.dx;
                if (Math.abs(det) > 1e-10) {
                    const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / det;
                    const interX = A.px + t * A.dx;
                    const interY = A.py + t * A.dy;
                    
                    const lA = Math.sqrt(A.dx * A.dx + A.dy * A.dy);
                    const lB = Math.sqrt(B.dx * B.dx + B.dy * B.dy);
                    if (lA > 0 && lB > 0) {
                        // Direction vectors
                        const dxA = A.dx / lA;
                        const dyA = A.dy / lA;
                        const dxB = B.dx / lB;
                        const dyB = B.dy / lB;
                        // Sum gives bisector direction
                        const bx = dxA + dxB;
                        const by = dyA + dyB;
                        if (Math.abs(bx) < 1e-10 && Math.abs(by) < 1e-10) {
                            return { px: interX, py: interY, dx: -dyA, dy: dxA };
                        }
                        return { px: interX, py: interY, dx: bx, dy: by };
                    }
                }
            }
            return null;
        }

        const C = cCode.evaluate(scope);
        let p1, p2, p3;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
        if (Array.isArray(C)) p3 = { x: C[0], y: C[1] };
        else if (C && typeof C.x === "number") p3 = { x: C.x, y: C.y };
        if (p1 && p2 && p3) {
          const baX = p1.x - p2.x;
          const baY = p1.y - p2.y;
          const lba = Math.sqrt(baX * baX + baY * baY);
          const bcX = p3.x - p2.x;
          const bcY = p3.y - p2.y;
          const lbc = Math.sqrt(bcX * bcX + bcY * bcY);
          if (lba > 0 && lbc > 0) {
            const dx = baX / lba + bcX / lbc;
            const dy = baY / lba + bcY / lbc;
            if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
              return { px: p2.x, py: p2.y, dx: -baY, dy: baX }; // 180 degrees
            }
            return { px: p2.x, py: p2.y, dx, dy };
          }
        }
        return null;
      },
    };
  }

  const intersectMatch = exprText.match(
    /^\s*Intersect\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (intersectMatch) {
    Logger.debug("GeometryCompiler", "Compiling Intersect representation.");
    const aNode = parse(intersectMatch[1]);
    const bNode = parse(intersectMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "point",
      isDraggable: false,
      vars: Array.from(vars),
      pointData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        // Line intersection: A is {px,py,dx,dy}, B is {px,py,dx,dy}
        if (A && B && typeof A.px === "number" && typeof B.px === "number") {
          const det = A.dx * B.dy - A.dy * B.dx;
          if (Math.abs(det) > 1e-10) {
            const t = ((B.px - A.px) * B.dy - (B.py - A.py) * B.dx) / det;
            return { x: A.px + t * A.dx, y: A.py + t * A.dy };
          }
        }
        return { x: NaN, y: NaN };
      },
    };
  }

  const tangentMatch = exprText.match(
    /^\s*Tangent\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (tangentMatch) {
    Logger.debug("GeometryCompiler", "Compiling Tangent representation.");
    const aNode = parse(tangentMatch[1]);
    const bNode = parse(tangentMatch[2]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
        if (p1 && p2)
          return { px: p1.x, py: p1.y, dx: p2.x - p1.x, dy: p2.y - p1.y };
        return null;
      },
    };
  }

  const ellipseMatch = exprText.match(
    /^\s*Ellipse\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (ellipseMatch) {
    Logger.debug("GeometryCompiler", "Compiling Ellipse representation.");
    const aNode = parse(ellipseMatch[1]);
    const bNode = parse(ellipseMatch[2]);
    const cNode = parse(ellipseMatch[3]);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    extractVars(cNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    const cCode = cNode.compile();
    return {
      name,
      type: "ellipse",
      vars: Array.from(vars),
      ellipseData: (scope: any) => {
        const A = aCode.evaluate(scope);
        const B = bCode.evaluate(scope);
        const semiMajor = cCode.evaluate(scope);
        let p1, p2;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
        if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
        else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
        if (p1 && p2 && typeof semiMajor === "number") {
          const cx = (p1.x + p2.x) / 2;
          const cy = (p1.y + p2.y) / 2;
          const fDist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2) / 2;
          const rx = semiMajor;
          const ry = Math.sqrt(Math.max(0, rx * rx - fDist * fDist));
          return { cx, cy, rx, ry };
        }
        return null;
      },
    };
  }

  const polyMatch = exprText.match(/^\s*Polygon\s*\((.+)\)\s*$/i);
  if (polyMatch) {
    Logger.debug("GeometryCompiler", "Compiling polygon representation.");
    const args = polyMatch[1].split(",").map((s) => s.trim());
    const nodes = args.map((arg) => parse(arg));
    nodes.forEach((n) => extractVars(n, vars));
    const codes = nodes.map((n) => n.compile());
    return {
      name,
      type: "polygon",
      vars: Array.from(vars),
      polygonData: (scope: any) => {
        return codes
          .map((c) => {
            const pt = c.evaluate(scope);
            if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
            if (pt && typeof pt.x === "number") return { x: pt.x, y: pt.y };
            return null;
          })
          .filter(Boolean) as { x: number; y: number }[];
      },
    };
  }

  const labelMatch = exprText.match(
    /^\s*Label\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*["'](.+?)["']\s*\)\s*$/i,
  );
  if (labelMatch) {
    Logger.debug("GeometryCompiler", "Compiling label representation.");
    const xNode = parse(labelMatch[1]);
    const yNode = parse(labelMatch[2]);
    const labelText = labelMatch[3];
    extractVars(xNode, vars);
    extractVars(yNode, vars);
    const xCode = xNode.compile();
    const yCode = yNode.compile();
    return {
      name,
      type: "label",
      vars: Array.from(vars),
      labelData: (scope: any) => {
        const x = xCode.evaluate(scope);
        const y = yCode.evaluate(scope);
        if (typeof x === "number" && typeof y === "number") {
          return { x, y, text: labelText };
        }
        return null;
      },
    };
  }

  const vectorFieldMatch = exprText.match(
    /^\s*VectorField\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (vectorFieldMatch) {
    Logger.debug("GeometryCompiler", "Compiling VectorField representation.");
    const uNode = parse(vectorFieldMatch[1]);
    const vNode = parse(vectorFieldMatch[2]);
    extractVars(uNode, vars);
    extractVars(vNode, vars);
    const uCode = uNode.compile();
    const vCode = vNode.compile();
    return {
      name,
      type: "vectorField",
      vars: Array.from(vars),
      vectorData: (x: number, y: number, scope: any) => ({
        dx: uCode.evaluate({ ...scope, x, y }),
        dy: vCode.evaluate({ ...scope, x, y }),
      }),
    };
  }

  const physNodeMatch = exprText.match(
    /^\s*PhysicsNode\s*\(\s*["'](.+?)["']\s*,\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*(true|false)\s*)?\)\s*$/i,
  );
  if (physNodeMatch) {
    Logger.debug("GeometryCompiler", "Compiling PhysicsNode representation.");
    const id = physNodeMatch[1];
    const xNode = parse(physNodeMatch[2]);
    const yNode = parse(physNodeMatch[3]);
    const pinned = physNodeMatch[4] === "true";
    extractVars(xNode, vars);
    extractVars(yNode, vars);
    const xCode = xNode.compile();
    const yCode = yNode.compile();
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

  const physLinkMatch = exprText.match(
    /^\s*PhysicsLink\s*\(\s*["'](.+?)["']\s*,\s*["'](.+?)["']\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (physLinkMatch) {
    Logger.debug("GeometryCompiler", "Compiling PhysicsLink representation.");
    const nodeA = physLinkMatch[1];
    const nodeB = physLinkMatch[2];
    const lenNode = parse(physLinkMatch[3]);
    extractVars(lenNode, vars);
    const lenCode = lenNode.compile();
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

  const clothMatch = exprText.match(
    /^\s*PhysicsCloth\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (clothMatch) {
    Logger.debug("GeometryCompiler", "Compiling PhysicsCloth representation.");
    const startX = parse(clothMatch[1]).compile();
    const startY = parse(clothMatch[2]).compile();
    const rows = parse(clothMatch[3]).compile();
    const cols = parse(clothMatch[4]).compile();
    const spacing = parse(clothMatch[5]).compile();

    return {
      name,
      type: "physicsNode",
      vars: [],
      physicsData: (scope: any) => {
        const sx = startX.evaluate(scope);
        const sy = startY.evaluate(scope);
        const r = rows.evaluate(scope);
        const c = cols.evaluate(scope);
        const sp = spacing.evaluate(scope);
        const items: any[] = [];
        for (let i = 0; i < r; i++) {
          for (let j = 0; j < c; j++) {
            items.push({
              id: `cloth_${i}_${j}`,
              x: sx + j * sp,
              y: sy - i * sp,
              pinned: i === 0,
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
  }

  const mandelbrotMatch = exprText.match(
    /^\s*Mandelbrot\s*\(\s*(.*)\s*\)\s*$/i,
  );
  if (mandelbrotMatch) {
    Logger.debug("GeometryCompiler", "Compiling Mandelbrot set.");
    let iters = mandelbrotMatch[1].trim();
    if (!iters) iters = "100";
    return {
      name,
      type: "inequality",
      operator: "<",
      vars: [],
      glslExpr: `
                vec2 z = vec2(0.0);
                vec2 c = vec2(x, y);
                float inside = -1.0;
                for(int i = 0; i < ${parseInt(iters, 10)}; i++) {
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
                    if(dot(z, z) > 4.0) {
                        inside = 1.0;
                        break;
                    }
                }
                return inside;
            `,
    };
  }

  const juliaMatch = exprText.match(
    /^\s*Julia\s*\(\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*(.+?))?\s*\)\s*$/i,
  );
  if (juliaMatch) {
    Logger.debug("GeometryCompiler", "Compiling Julia set.");
    const cxNode = parse(juliaMatch[1]);
    const cyNode = parse(juliaMatch[2]);
    const iters = juliaMatch[3] ? juliaMatch[3].trim() : "100";

    extractVars(cxNode, vars);
    extractVars(cyNode, vars);

    const cxCode = cxNode.compile();
    const cyCode = cyNode.compile();

    return {
      name,
      type: "inequality",
      operator: "<",
      vars: Array.from(vars),
      glslUniforms: ["u_julia_cx", "u_julia_cy"],
      fnImplicit: (x: number, y: number, scope: any) => {
        scope.u_julia_cx = cxCode.evaluate(scope);
        scope.u_julia_cy = cyCode.evaluate(scope);
        return -1;
      },
      glslExpr: `
                vec2 z = vec2(x, y);
                vec2 c = vec2(u_julia_cx, u_julia_cy);
                float inside = -1.0;
                for(int i = 0; i < ${parseInt(iters, 10)}; i++) {
                    z = vec2(z.x*z.x - z.y*z.y, 2.0*z.x*z.y) + c;
                    if(dot(z, z) > 4.0) {
                        inside = 1.0;
                        break;
                    }
                }
                return inside;
            `,
    };
  }

  return null;
}
