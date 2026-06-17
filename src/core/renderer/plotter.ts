/**
 * @file plotter.ts
 * @brief Main Canvas 2D rendering orchestration logic.
 * @details Delegates to plotterGrid, plotterImplicit, plotterFunctions, and plotterPrimitives.
 */
import type { Camera } from "./camera";
import type { EquationType } from "../math/evaluator";

import { drawGrid } from "./plotterGrid";
import {
  plotPoint,
  plotSegment,
  plotLine,
  plotPolygon,
  plotCircle,
  plotEllipse,
  plotLabel,
} from "./plotterPrimitives";
import { plotAdaptive, plotParametric, plotIntegral } from "./plotterFunctions";
import { plotMarchingSquares, findIntersections } from "./plotterImplicit";
import { plotVectorField } from "./plotterVectorField";
import { physicsEngine } from "../math/physicsEngine";
import { plotFourier, plotVoronoi, plotDelaunay } from "./plotterData";

export interface CompiledEquation {
  id: string;
  name?: string;
  color: string;
  type: EquationType;
  operator?: string;
  isDraggable?: boolean;
  fnExplicit?: (x: number, scope: any) => any;
  fnImplicit?: (x: number, y: number, scope: any) => number;
  pointData?: (scope: any) => { x: any; y: any };
  fnParametric?: (t: number, scope: any) => { x: number; y: number };
  paramBounds?: [number, number];
  boundsFn?: (scope: any) => [number, number];
  segmentData?: (
    scope: any,
  ) => { x1: number; y1: number; x2: number; y2: number } | null;
  lineData?: (
    scope: any,
  ) => any;
  ellipseData?: (
    scope: any,
  ) => { cx: number; cy: number; rx: number; ry: number } | null;
  polygonData?: (scope: any) => { x: number; y: number }[] | null;
  circleData?: (scope: any) => { cx: number; cy: number; r: number } | null;
  constantValue?: (scope: any) => any;
  regressionSolve?: (
    scope: any,
  ) => { params: Record<string, number>; rSquared: number } | null;
  actionExecute?: (scope: any) => { target: string; value: any } | null;
  glslExpr?: string;
  glslUniforms?: string[];
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  pointStyle?: "circle" | "cross" | "diamond";
  labelData?: (scope: any) => { x: number; y: number; text: string } | null;
  vectorData?: (
    x: number,
    y: number,
    scope: any,
  ) => { dx: number; dy: number } | null;
  physicsData?: (
    scope: any,
  ) => {
    id?: string;
    x?: number;
    y?: number;
    pinned?: boolean;
    nodeA?: string;
    nodeB?: string;
    length?: number;
  } | null;
  glslUniformsScope?: any;
  dataFn?: (scope: any) => any[] | null;
  isTraced?: boolean;
}

export interface ThemeColors {
  major: string;
  minor: string;
  text: string;
  bg: string;
}

const traceHistory = new Map<
  string,
  { x: number; y: number; alpha: number }[]
>();

function drawTrace(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  id: string,
  x: number,
  y: number,
  color: string,
  width: number,
  height: number,
) {
  let history = traceHistory.get(id);
  if (!history) {
    history = [];
    traceHistory.set(id, history);
  }
  history.push({ x, y, alpha: 1.0 });

  for (let i = 1; i < history.length; i++) {
    const p1 = camera.mathToScreen(
      history[i - 1].x,
      history[i - 1].y,
      width,
      height,
    );
    const p2 = camera.mathToScreen(history[i].x, history[i].y, width, height);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = history[i].alpha;
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

/**
 * @brief Main rendering orchestration function.
 */
export function plotExpressions(
  ctx: CanvasRenderingContext2D,
  equations: CompiledEquation[],
  camera: Camera,
  width: number,
  height: number,
  scope: any,
  themeColors: ThemeColors,
  gridType: string = "cartesian",
  dt: number = 0.016,
  odeSpawners: { x: number; y: number }[] = [],
): { x: number; y: number; type: string }[] {
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, camera, width, height, themeColors, gridType);

  for (const [id, history] of traceHistory.entries()) {
    for (let i = history.length - 1; i >= 0; i--) {
      history[i].alpha -= dt * 0.5;
      if (history[i].alpha <= 0) history.splice(i, 1);
    }
  }

  physicsEngine.clearConstraints();

  for (const eq of equations) {
    try {
    const isSelected = (eq as any).selected;
    if (eq.lineStyle === "dashed") {
      ctx.setLineDash([10, 10]);
    } else if (eq.lineStyle === "dotted") {
      ctx.setLineDash([2, 6]);
    } else {
      ctx.setLineDash([]);
    }

    const lw = (eq.lineWidth || 2) + (isSelected ? 3 : 0);
    const eqScope = eq.glslUniformsScope || scope;

    if ((eq.type === "explicit" || eq.type === "regression") && eq.fnExplicit) {
      plotAdaptive(
        ctx,
        camera,
        eq.fnExplicit,
        eq.color,
        width,
        height,
        eqScope,
        lw,
      );
    } else if (eq.type === "implicit" && eq.fnImplicit) {
      plotMarchingSquares(
        ctx,
        camera,
        eq.fnImplicit,
        eq.color,
        width,
        height,
        eqScope,
        false,
      );
    } else if (eq.type === "inequality" && eq.fnImplicit && eq.operator) {
      plotMarchingSquares(
        ctx,
        camera,
        eq.fnImplicit,
        eq.color,
        width,
        height,
        eqScope,
        true,
        eq.operator,
      );
    } else if (eq.type === "point" && eq.pointData) {
      const data = eq.pointData(eqScope);
      if (data) {
        if (eq.isTraced)
          drawTrace(
            ctx,
            camera,
            eq.id,
            data.x,
            data.y,
            eq.color,
            width,
            height,
          );
        if (isSelected) {
          const ptsX = data.x?.toArray ? data.x.toArray() : Array.isArray(data.x) ? data.x : [data.x];
          const ptsY = data.y?.toArray ? data.y.toArray() : Array.isArray(data.y) ? data.y : [data.y];
          for (let i = 0; i < Math.max(ptsX.length, ptsY.length); i++) {
            const px = ptsX[i % ptsX.length];
            const py = ptsY[i % ptsY.length];
            const screenP = camera.mathToScreen(px, py, width, height);
            ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(screenP.x, screenP.y, 10, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        plotPoint(ctx, camera, data, eq.color, width, height, eq.pointStyle);
      }
    } else if (eq.type === "parametric" && eq.fnParametric) {
      plotParametric(
        ctx,
        camera,
        eq.fnParametric,
        eq.color,
        width,
        height,
        eqScope,
        eq.paramBounds,
        lw,
      );
    } else if (eq.type === "integral" && eq.fnExplicit && eq.boundsFn) {
      plotIntegral(
        ctx,
        camera,
        eq.fnExplicit,
        eq.boundsFn,
        eq.color,
        width,
        height,
        eqScope,
        themeColors,
      );
    } else if (eq.type === "segment" && eq.segmentData) {
      const data = eq.segmentData(eqScope);
      if (data) plotSegment(ctx, camera, data, eq.color, width, height, lw);
    } else if (eq.type === "line" && eq.lineData) {
      const data = eq.lineData(eqScope);
      if (data) {
        const lines = Array.isArray(data) ? data : [data];
        for (const l of lines) {
          plotLine(ctx, camera, l, eq.color, width, height, lw);
        }
      }
    } else if (eq.type === "ellipse" && eq.ellipseData) {
      const data = eq.ellipseData(eqScope);
      if (data) plotEllipse(ctx, camera, data, eq.color, width, height, lw);
    } else if (eq.type === "polygon" && eq.polygonData) {
      const data = eq.polygonData(eqScope);
      if (data)
        plotPolygon(ctx, camera, data, eq.color, width, height, eq.pointStyle);
    } else if (eq.type === "circle" && eq.circleData) {
      const data = eq.circleData(eqScope);
      if (data) plotCircle(ctx, camera, data, eq.color, width, height, lw);
    } else if (eq.type === "label" && eq.labelData) {
      const data = eq.labelData(eqScope);
      if (data)
        plotLabel(ctx, camera, data, eq.color, width, height, themeColors);
    } else if (eq.type === "vectorField" && eq.vectorData) {
      plotVectorField(
        ctx,
        camera,
        eq.vectorData,
        eq.color,
        width,
        height,
        eqScope,
        dt,
        odeSpawners,
      );
    } else if (eq.type === "fourier" && eq.dataFn) {
      const data = eq.dataFn(eqScope);
      if (data) {
        const head = plotFourier(
          ctx,
          camera,
          data,
          eq.color,
          width,
          height,
          scope.t || 0,
          eq.id,
        );
        if (head && eq.isTraced)
          drawTrace(
            ctx,
            camera,
            eq.id,
            head.x,
            head.y,
            eq.color,
            width,
            height,
          );
      }
    } else if (eq.type === "voronoi" && eq.dataFn) {
      const data = eq.dataFn(eqScope);
      if (data) plotVoronoi(ctx, camera, data, eq.color, width, height);
    } else if (eq.type === "delaunay" && eq.dataFn) {
      const data = eq.dataFn(eqScope);
      if (data) plotDelaunay(ctx, camera, data, eq.color, width, height);
    } else if (eq.type === "physicsNode" && eq.physicsData) {
      const result = eq.physicsData(eqScope);
      if (result) {
        const items = Array.isArray(result) ? result : [result];
        for (const item of items) {
          if (item.id && item.x !== undefined && item.y !== undefined) {
            physicsEngine.registerNode(item.id, item.x, item.y, item.pinned);
            if (eq.isTraced)
              drawTrace(
                ctx,
                camera,
                eq.id + "_" + item.id,
                item.x,
                item.y,
                eq.color,
                width,
                height,
              );
            plotPoint(
              ctx,
              camera,
              { x: item.x, y: item.y },
              eq.color,
              width,
              height,
              "circle",
            );
          } else if (item.nodeA && item.nodeB && item.length !== undefined) {
            physicsEngine.registerConstraint(
              item.nodeA,
              item.nodeB,
              item.length,
            );
          }
        }
      }
    } else if (eq.type === "physicsLink" && eq.physicsData) {
      const link = eq.physicsData(eqScope);
      if (link && link.nodeA && link.nodeB && link.length !== undefined) {
        physicsEngine.registerConstraint(link.nodeA, link.nodeB, link.length);
      }
    }
    } catch(err) {
      // Ignore evaluation errors
    }
  }

  /**
   * Draw current physics lines mapped from engine state
   */
  for (const constraint of physicsEngine.constraints) {
    const a = physicsEngine.nodes.get(constraint.nodeA);
    const b = physicsEngine.nodes.get(constraint.nodeB);
    if (a && b) {
      plotSegment(
        ctx,
        camera,
        { x1: a.x, y1: a.y, x2: b.x, y2: b.y },
        themeColors.text,
        width,
        height,
        2,
      );
    }
  }

  ctx.setLineDash([]);

  return findIntersections(ctx, camera, equations, width, height, scope) || [];
}
