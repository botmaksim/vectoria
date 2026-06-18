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
  if (typeof l.a === "number" && typeof l.b === "number" && typeof l.c === "number") {
    return l;
  }
  if (typeof l.px === "number" && typeof l.py === "number" && typeof l.dx === "number" && typeof l.dy === "number") {
    return {
      a: -l.dy,
      b: l.dx,
      c: l.dy * l.px - l.dx * l.py
    };
  }
  if (typeof l.x1 === "number" && typeof l.y1 === "number" && typeof l.x2 === "number" && typeof l.y2 === "number") {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    return {
      a: -dy,
      b: dx,
      c: dy * l.x1 - dx * l.y1
    };
  }
  return null;
}

/**
 * @brief Helper to resolve geometric objects (circle, ellipse, point) from evaluated scopes.
 */
function resolveGeom(val: any, exprText: string, scope: any) {
  if (!val) return null;
  if (typeof val.cx === "number" && typeof val.cy === "number" && typeof val.r === "number") {
    return { type: "circle", cx: val.cx, cy: val.cy, r: val.r };
  }
  if (typeof val.cx === "number" && typeof val.cy === "number" && typeof val.rx === "number" && typeof val.ry === "number") {
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
export function compileGeometry(
  exprText: string,
  name: string | undefined,
  vars: Set<string>,
): CompiledEquationData | null {
  const fourierMatch = exprText.match(
    /^\s*Fourier\s*\(\s*(\[[^\]]+\]|[^,]+)(?:,\s*(.+))?\s*\)\s*$/i,
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
      isTraced: true,
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
    /^\s*Voronoi\s*\(\s*(\[[^\]]+\]|[^,]+)(?:,\s*(.+))?\s*\)\s*$/i,
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
    /^\s*Delaunay\s*\(\s*(\[[^\]]+\]|[^,]+)(?:,\s*(.+))?\s*\)\s*$/i,
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
      type: "transform",
      vars: Array.from(vars),
      transformExecute: (scope: any) => {
        const m = matCode.evaluate(scope);
        return m?.toArray ? m.toArray() : m;
      },
    };
  }

  // Match (x, y) or [x, y] point syntax — the inner parts must NOT contain
  // brackets of either type so that nested arrays like [[a,b],[c,d]] are excluded.
  const pointMatch = exprText.match(/^\s*[([]([^()[\]]+),([^()[\]]+)[)\]]\s*$/);
  if (pointMatch) {
    Logger.debug("GeometryCompiler", "Compiling point representation.");
    const xNode = parse(pointMatch[1]);
    const yNode = parse(pointMatch[2]);
    extractVars(xNode, vars);
    extractVars(yNode, vars);
    const xCode = xNode.compile();
    const yCode = yNode.compile();

    const hasSymbol = (node: any, symbol: string) => {
      let found = false;
      node.traverse((n: any) => {
        if (n.isSymbolNode && n.name === symbol) {
          found = true;
        }
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
    /^\s*Midpoint\s*\(\s*(.+?)\s*(?:,\s*(.+?)\s*)?\)\s*$/i,
  );
  if (midpointMatch) {
    Logger.debug("GeometryCompiler", "Compiling Midpoint representation.");
    const aNode = parse(midpointMatch[1]);
    const bNode = midpointMatch[2] ? parse(midpointMatch[2]) : null;
    extractVars(aNode, vars);
    if (bNode) extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode ? bNode.compile() : null;
    return {
      name,
      type: "point",
      vars: Array.from(vars),
      pointData: (scope: any) => {
        const A = aCode.evaluate(scope);
        if (!bCode) {
          if (A && typeof A.x1 === "number" && typeof A.y1 === "number" && typeof A.x2 === "number" && typeof A.y2 === "number") {
            return { x: (A.x1 + A.x2) / 2, y: (A.y1 + A.y2) / 2 };
          }
          return { x: NaN, y: NaN };
        }
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
        let p1;
        if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
        else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };

        if (p1) {
          if (typeof B === "number") {
            return { cx: p1.x, cy: p1.y, r: B };
          }
          let p2;
          if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
          else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
          if (p2) {
            const r = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
            return { cx: p1.x, cy: p1.y, r };
          }
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

  const parallelMatch = exprText.match(
    /^\s*Parallel\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i,
  );
  if (parallelMatch) {
    Logger.debug("GeometryCompiler", "Compiling Parallel representation.");
    const aNode = parse(parallelMatch[1]);
    const bNode = parse(parallelMatch[2]);
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
        let pt, line;
        
        const isLine = (o: any) => o && (typeof o.px === "number" || typeof o.a === "number");
        
        if (isLine(A)) { line = A; pt = B; }
        else if (isLine(B)) { line = B; pt = A; }
        
        if (Array.isArray(pt)) pt = { x: pt[0], y: pt[1] };
        else if (pt && typeof pt.x === "number") pt = { x: pt.x, y: pt.y };
        
        if (pt && line) {
          const l = getLineData(line);
          if (l) {
            if (typeof l.px === "number") {
              return { px: pt.x, py: pt.y, dx: l.dx, dy: l.dy };
            } else {
              return { a: l.a, b: l.b, c: -(l.a * pt.x + l.b * pt.y) };
            }
          }
        }
        return null;
      }
    };
  }

  // Helper for parallel and perpendicular lines
  function getLineData(o: any) {
    if (!o) return null;
    if (typeof o.px === "number" && typeof o.py === "number" && typeof o.dx === "number" && typeof o.dy === "number") {
      return o;
    }
    if (typeof o.x1 === "number" && typeof o.y1 === "number" && typeof o.x2 === "number" && typeof o.y2 === "number") {
      return { px: o.x1, py: o.y1, dx: o.x2 - o.x1, dy: o.y2 - o.y1 };
    }
    if (typeof o.a === "number" && typeof o.b === "number" && typeof o.c === "number") {
      return o;
    }
    return null;
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
        let pt, rawLine;
        
        const isLineOrSegment = (o: any) => o && (typeof o.px === "number" || typeof o.a === "number" || typeof o.x1 === "number");
        
        if (isLineOrSegment(p1)) { rawLine = p1; pt = p2; }
        else if (isLineOrSegment(p2)) { rawLine = p2; pt = p1; }
        
        if (Array.isArray(pt)) pt = { x: pt[0], y: pt[1] };
        else if (pt && typeof pt.x === "number") pt = { x: pt.x, y: pt.y };

        const line = getLineData(rawLine);
        if (pt && line) {
          if (typeof line.px === "number") {
            return { px: pt.x, py: pt.y, dx: -line.dy, dy: line.dx };
          } else {
            return { a: line.b, b: -line.a, c: line.a * pt.y - line.b * pt.x };
          }
        }
        return null;
      },
    };
  }

  const perpBisectorMatch = exprText.match(
    /^\s*PerpendicularBisector\s*\(\s*(.+?)\s*(?:,\s*(.+?)\s*)?\)\s*$/i,
  );
  if (perpBisectorMatch) {
    Logger.debug(
      "GeometryCompiler",
      "Compiling PerpendicularBisector representation.",
    );
    const aNode = parse(perpBisectorMatch[1]);
    const bNode = perpBisectorMatch[2] ? parse(perpBisectorMatch[2]) : null;
    extractVars(aNode, vars);
    if (bNode) extractVars(bNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode ? bNode.compile() : null;
    return {
      name,
      type: "line",
      vars: Array.from(vars),
      lineData: (scope: any) => {
        const A = aCode.evaluate(scope);
        let p1, p2;
        if (!bCode) {
          if (A && typeof A.x1 === "number" && typeof A.y1 === "number" && typeof A.x2 === "number" && typeof A.y2 === "number") {
            p1 = { x: A.x1, y: A.y1 };
            p2 = { x: A.x2, y: A.y2 };
          }
        } else {
          const B = bCode.evaluate(scope);
          if (Array.isArray(A)) p1 = { x: A[0], y: A[1] };
          else if (A && typeof A.x === "number") p1 = { x: A.x, y: A.y };
          if (Array.isArray(B)) p2 = { x: B[0], y: B[1] };
          else if (B && typeof B.x === "number") p2 = { x: B.x, y: B.y };
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
        
        let l1 = null, l2 = null;
        if (!cCode) {
          l1 = toImplicit(A);
          l2 = toImplicit(B);
        } else {
          const C = cCode.evaluate(scope);
          const parsePt = (p: any) => {
            if (Array.isArray(p)) return { x: p[0], y: p[1] };
            if (p && typeof p.x === "number") return { x: p.x, y: p.y };
            return null;
          };
          const pt1 = parsePt(A);
          const pt2 = parsePt(B);
          const pt3 = parsePt(C);
          if (pt1 && pt2 && pt3) {
            l1 = toImplicit({ x1: pt2.x, y1: pt2.y, x2: pt1.x, y2: pt1.y });
            l2 = toImplicit({ x1: pt2.x, y1: pt2.y, x2: pt3.x, y2: pt3.y });
          }
        }
        
        if (l1 && l2) {
          const len1 = Math.sqrt(l1.a * l1.a + l1.b * l1.b);
          const len2 = Math.sqrt(l2.a * l2.a + l2.b * l2.b);
          if (len1 > 0 && len2 > 0) {
            const a1 = l1.a / len1, b1 = l1.b / len1, c1 = l1.c / len1;
            const a2 = l2.a / len2, b2 = l2.b / len2, c2 = l2.c / len2;
            return [
              { a: a1 - a2, b: b1 - b2, c: c1 - c2 },
              { a: a1 + a2, b: b1 + b2, c: c1 + c2 }
            ];
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
        
        const l1 = toImplicit(A);
        const l2 = toImplicit(B);
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
        
        let pt, curve;
        const isPoint = (o: any) => Array.isArray(o) || (o && typeof o.x === "number");
        const isCircleOrEllipse = (o: any) => o && typeof o.cx === "number";
        const isFunction = (o: any) => typeof o === "function";

        if (isPoint(A)) { pt = A; curve = B; }
        else if (isPoint(B)) { pt = B; curve = A; }

        if (Array.isArray(pt)) pt = { x: pt[0], y: pt[1] };
        else if (pt && typeof pt.x === "number") pt = { x: pt.x, y: pt.y };

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
                { px: pt.x, py: pt.y, dx: Math.cos(theta + alpha), dy: Math.sin(theta + alpha) },
                { px: pt.x, py: pt.y, dx: Math.cos(theta - alpha), dy: Math.sin(theta - alpha) }
              ];
            } else if (typeof curve.rx === "number" && typeof curve.ry === "number") {
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
              const angles = [theta + alpha, theta - alpha];
              return angles.map(ang => {
                const dx = Math.cos(ang);
                const dy = Math.sin(ang) / scaleFactor;
                return { px: pt.x, py: pt.y, dx, dy };
              });
            }
          } else {
            // Function tangent
            const f = isFunction(curve) ? curve : (xVal: number) => {
              const code = isPoint(A) ? bCode : aCode;
              return code.evaluate({ ...scope, x: xVal });
            };
            const evalF = (x: number) => {
              try { return f(x); } catch { return NaN; }
            };
            const evalDF = (x: number) => {
              const h = 1e-4;
              return (evalF(x + h) - evalF(x - h)) / (2 * h);
            };
            const evalG = (x: number) => {
              const fx = evalF(x);
              const dfx = evalDF(x);
              return fx - dfx * (x - pt.x) - pt.y;
            };
            
            const roots = new Set<number>();
            const startT = [pt.x, pt.x - 2, pt.x + 2];
            for (const sT of startT) {
              let t = sT;
              let success = false;
              for (let iter = 0; iter < 50; iter++) {
                const gval = evalG(t);
                if (Math.abs(gval) < 1e-7) { success = true; break; }
                const h = 1e-4;
                const dg = (evalG(t + h) - evalG(t - h)) / (2 * h);
                if (Math.abs(dg) < 1e-12) break;
                const nextT = t - gval / dg;
                if (isNaN(nextT) || Math.abs(nextT - t) > 100) break;
                t = nextT;
              }
              if (success && !isNaN(t)) {
                roots.add(Math.round(t * 1e5) / 1e5);
              }
            }
            return Array.from(roots).map(t => {
              return { px: t, py: evalF(t), dx: 1, dy: evalDF(t) };
            });
          }
        } else if (isCircleOrEllipse(A) && isCircleOrEllipse(B)) {
          if (typeof A.r === "number" && typeof B.r === "number") {
            const o1 = { x: A.cx, y: A.cy };
            const o2 = { x: B.cx, y: B.cy };
            const r1 = A.r;
            const r2 = B.r;
            const dx = o2.x - o1.x;
            const dy = o2.y - o1.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 1e-6) return [];
            const lines: any[] = [];
            const pointCircleTangents = (p: {x: number, y: number}, center: {x: number, y: number}, R: number) => {
              const vX = center.x - p.x;
              const vY = center.y - p.y;
              const dist = Math.sqrt(vX * vX + vY * vY);
              if (dist < R - 1e-4) return [];
              if (Math.abs(dist - R) < 1e-4) {
                return [{ px: p.x, py: p.y, dx: -vY, dy: vX }];
              }
              const theta = Math.atan2(vY, vX);
              const alpha = Math.asin(R / dist);
              return [
                { px: p.x, py: p.y, dx: Math.cos(theta + alpha), dy: Math.sin(theta + alpha) },
                { px: p.x, py: p.y, dx: Math.cos(theta - alpha), dy: Math.sin(theta - alpha) }
              ];
            };
            if (Math.abs(r1 - r2) < 1e-4) {
              const nx = -dy / d;
              const ny = dx / d;
              lines.push({ px: o1.x + nx * r1, py: o1.y + ny * r1, dx, dy });
              lines.push({ px: o1.x - nx * r1, py: o1.y - ny * r1, dx, dy });
            } else {
              const ex = (r1 * o2.x - r2 * o1.x) / (r1 - r2);
              const ey = (r1 * o2.y - r2 * o1.y) / (r1 - r2);
              lines.push(...pointCircleTangents({ x: ex, y: ey }, o1, r1));
            }
            const ix = (r1 * o2.x + r2 * o1.x) / (r1 + r2);
            const iy = (r1 * o2.y + r2 * o1.y) / (r1 + r2);
            lines.push(...pointCircleTangents({ x: ix, y: iy }, o1, r1));
            return lines;
          }
        }
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

  if (/^\s*Polygon\s*\(/i.test(exprText)) {
    try {
      const parsed = parse(exprText);
      if (parsed.isFunctionNode && parsed.fn.name.toLowerCase() === "polygon") {
        Logger.debug("GeometryCompiler", "Compiling polygon representation.");
        const nodes = parsed.args;
        nodes.forEach((n: any) => extractVars(n, vars));
        const codes = nodes.map((n: any) => n.compile());
        return {
          name,
          type: "polygon",
          vars: Array.from(vars),
          polygonData: (scope: any) => {
            return codes
              .map((c: any) => {
                let pt = c.evaluate(scope);
                if (pt && typeof pt.toArray === 'function') pt = pt.toArray();
                if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
                if (pt && typeof pt.x === "number") return { x: pt.x, y: pt.y };
                return null;
              })
              .filter(Boolean) as { x: number; y: number }[];
          },
        };
      }
    } catch (e) {}
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

  const physNodeMatch = exprText.match(
    /^\s*PhysicsNode\s*\(\s*["']?([\w-]+)["']?\s*,\s*(.+?)\s*,\s*(.+?)\s*(?:,\s*(true|false)\s*)?\)\s*$/i,
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
    /^\s*PhysicsLink\s*\(\s*["']?([\w-]+)["']?\s*,\s*["']?([\w-]+)["']?\s*,\s*(.+?)\s*\)\s*$/i,
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

  if (/^\s*PhysicsCloth\s*\(/i.test(exprText)) {
    try {
      const parsed = parse(exprText);
      if (parsed.isFunctionNode && parsed.fn.name.toLowerCase() === "physicscloth") {
        Logger.debug("GeometryCompiler", "Compiling PhysicsCloth representation.");
        const args = parsed.args;
        if (args.length >= 5) {
          const startX = args[0].compile();
          const startY = args[1].compile();
          const rows = args[2].compile();
          const cols = args[3].compile();
          const spacing = args[4].compile();
          
          const pinnedNodesArgs = args.slice(5).map((a: any) => a.compile());

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
              
              const pinnedPairs: {pi: number, pj: number}[] = [];
              for (let i = 0; i < pinnedNodesArgs.length; i += 2) {
                if (i + 1 < pinnedNodesArgs.length) {
                  pinnedPairs.push({
                    pi: pinnedNodesArgs[i].evaluate(scope),
                    pj: pinnedNodesArgs[i + 1].evaluate(scope)
                  });
                }
              }

              const items: any[] = [];
              for (let i = 0; i < r; i++) {
                for (let j = 0; j < c; j++) {
                  const isPinned = pinnedPairs.some(p => p.pi === i && p.pj === j);
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
        }
      }
    } catch (e) {
      console.error("Error compiling PhysicsCloth:", e);
    }
  }

  const vectorFieldMatch = exprText.match(/^\s*(?:VectorField|ODE)\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/i);
  if (vectorFieldMatch) {
    Logger.debug("GeometryCompiler", "Compiling VectorField / ODE.");
    const dxNode = parse(vectorFieldMatch[1]);
    const dyNode = parse(vectorFieldMatch[2]);
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
        dy: dyCode.evaluate({ ...scope, x, y })
      })
    };
  }



  if (/^\s*Conic\s*\(/i.test(exprText)) {
    try {
      const parsed = parse(exprText);
      if (parsed.isFunctionNode && parsed.fn.name.toLowerCase() === "conic" && parsed.args.length === 5) {
        Logger.debug("GeometryCompiler", "Compiling Conic representation.");
        const [aNode, bNode, cNode, dNode, eNode] = parsed.args;
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    extractVars(cNode, vars);
    extractVars(dNode, vars);
    extractVars(eNode, vars);
    const aCode = aNode.compile();
    const bCode = bNode.compile();
    const cCode = cNode.compile();
    const dCode = dNode.compile();
    const eCode = eNode.compile();
    const getConicData = (scope: any) => {
      const p1 = aCode.evaluate(scope);
      const p2 = bCode.evaluate(scope);
      const p3 = cCode.evaluate(scope);
      const p4 = dCode.evaluate(scope);
      const p5 = eCode.evaluate(scope);
      const parsePt = (p: any) => {
        if (p && typeof p.toArray === 'function') p = p.toArray();
        if (Array.isArray(p)) return { x: p[0], y: p[1] };
        if (p && typeof p.x === "number") return { x: p.x, y: p.y };
        return null;
      };
      const pt1 = parsePt(p1), pt2 = parsePt(p2), pt3 = parsePt(p3), pt4 = parsePt(p4), pt5 = parsePt(p5);
      if (pt1 && pt2 && pt3 && pt4 && pt5) {
        const mat = [pt1, pt2, pt3, pt4, pt5].map(p => [p.x * p.x, p.x * p.y, p.y * p.y, p.x, p.y, 1]);
        const getSub = (ci: number) => mat.map(row => row.filter((_, idx) => idx !== ci));
        const cofs = [
          determinant(getSub(0)), -determinant(getSub(1)), determinant(getSub(2)),
          -determinant(getSub(3)), determinant(getSub(4)), -determinant(getSub(5))
        ];
        return { a: cofs[0], b: cofs[1], c: cofs[2], d: cofs[3], e: cofs[4], f: cofs[5] };
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
        if (cd) {
          return cd.a * x * x + cd.b * x * y + cd.c * y * y + cd.d * x + cd.e * y + cd.f;
        }
        return NaN;
      },
      glslExpr: "u_conic_a * x * x + u_conic_b * x * y + u_conic_c * y * y + u_conic_d * x + u_conic_e * y + u_conic_f",
    };
      }
    } catch (e) {}
  }

  return null;
}
