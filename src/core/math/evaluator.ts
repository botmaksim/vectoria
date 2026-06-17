/**
 * @file evaluator.ts
 * @brief Mathematical expression compilation and evaluation core.
 * @details Parses user input into Abstract Syntax Trees (ASTs), determines equation types, extracts variables, and compiles evaluation functions or GLSL shaders.
 */

import { parse, evaluate } from "mathjs";
import { compileGLSL } from "./glslCompiler";
import { Logger } from "../../utils/logger";
import {
  preprocessMathLive,
  extractVars,
  transformDerivatives,
  transformImplicitMultiplication,
  substituteCustomFunctions,
} from "./transformers";
import { compileGeometry } from "./geometryCompiler";
import { compileCalculusAndRegression } from "./calculusCompiler";

/**
 * @type EquationType
 * @brief Categorization of geometric and mathematical entities.
 */
export type EquationType =
  | "explicit"
  | "implicit"
  | "inequality"
  | "point"
  | "parametric"
  | "integral"
  | "segment"
  | "polygon"
  | "circle"
  | "line"
  | "ellipse"
  | "regression"
  | "action"
  | "label"
  | "vectorField"
  | "physicsNode"
  | "physicsLink"
  | "fourier"
  | "voronoi"
  | "delaunay";

/**
 * @interface CompiledEquationData
 * @brief Structure holding the compiled logic for rendering an equation.
 */
export interface CompiledEquationData {
  type: EquationType;
  operator?: string;
  vars: string[];
  name?: string;
  isTraced?: boolean;
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
  labelData?: (scope: any) => { x: number; y: number; text: string } | null;
  vectorData?: (
    x: number,
    y: number,
    scope: any,
  ) => { dx: number; dy: number } | null;
  physicsData?: (
    scope: any,
  ) =>
    | {
        id?: string;
        x?: number;
        y?: number;
        pinned?: boolean;
        nodeA?: string;
        nodeB?: string;
        length?: number;
      }
    | {
        id?: string;
        x?: number;
        y?: number;
        pinned?: boolean;
        nodeA?: string;
        nodeB?: string;
        length?: number;
      }[]
    | null;
  dataFn?: (scope: any) => any[] | null;
  glslExpr?: string;
  glslUniforms?: string[];
}

/**
 * @brief Parses and compiles a text expression into executable geometric constraints.
 * @param text The mathematical expression string.
 * @returns A CompiledEquationData object, or null if parsing fails.
 */
export function compileExpression(
  text: string,
  customFunctions?: Record<string, { param: string; body: string }>,
  isComplex: boolean = false,
  customNames?: Set<string>,
): CompiledEquationData | null {
  if (!text || text.trim() === "") {
    Logger.debug("Evaluator", "Empty text provided for compilation, aborting.");
    return null;
  }

  try {
    let isTraced = false;
    const traceMatch = text.match(/^\s*Trace\s*\(\s*(.+)\s*\)\s*$/i);
    if (traceMatch) {
      isTraced = true;
      text = traceMatch[1];
    }

    text = preprocessMathLive(text);
    const vars = new Set<string>();

    let name: string | undefined;
    const assignMatch = text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
    let exprText = text;

    if (assignMatch && !["y", "x", "r", "f(x)"].includes(assignMatch[1].trim())) {
      name = assignMatch[1].trim();
      exprText = assignMatch[2].trim();
      Logger.debug("Evaluator", `Extracted variable assignment: ${name}`);
    }

    // Preprocess custom functions and implicit multiplication via AST on LHS / RHS
    const eqMatchPre = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
    if (eqMatchPre) {
      let left = eqMatchPre[1].trim();
      const op = eqMatchPre[2];
      let right = eqMatchPre[3].trim();
      
      try {
        let leftNode = parse(left);
        leftNode = substituteCustomFunctions(leftNode, customFunctions || {});
        leftNode = transformImplicitMultiplication(leftNode, customNames || new Set());
        left = leftNode.toString();
      } catch {}

      try {
        let rightNode = parse(right);
        rightNode = substituteCustomFunctions(rightNode, customFunctions || {});
        rightNode = transformImplicitMultiplication(rightNode, customNames || new Set());
        right = rightNode.toString();
      } catch {}
      
      exprText = `${left} ${op} ${right}`;
    } else {
      try {
        let node = parse(exprText);
        node = substituteCustomFunctions(node, customFunctions || {});
        node = transformImplicitMultiplication(node, customNames || new Set());
        exprText = node.toString();
      } catch {}
    }

    let result: CompiledEquationData | null = null;

    const geo = compileGeometry(exprText, name, vars);
    if (geo) result = geo;

    if (!result) {
      const calc = compileCalculusAndRegression(exprText, name, vars);
      if (calc) result = calc;
    }

    if (!result) {
      const eqMatch = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
      if (eqMatch) {
        let left = eqMatch[1].trim();
        const op = eqMatch[2];
        let right = eqMatch[3].trim();

        if (left === "f(x)" && op === "=") left = "y";

        if (op === "->") {
          Logger.debug("Evaluator", "Compiling action representation.");
          const rNode = transformDerivatives(parse(right), customFunctions);
          extractVars(rNode, vars);
          const rCode = rNode.compile();
          const allVars = Array.from(vars);

          result = {
            name,
            type: "action",
            vars: allVars,
            actionExecute: (scope: any) => {
              try {
                const val = rCode.evaluate(scope);
                return { target: left, value: val };
              } catch (e) {
                return null;
              }
            },
          };
        }

        if (!result && left === "r" && op === "=") {
          Logger.debug("Evaluator", "Compiling polar representation.");
          const node = transformDerivatives(parse(right), customFunctions);
          extractVars(node, vars);
          const code = node.compile();
          vars.delete("theta");
          result = {
            name,
            type: "parametric",
            vars: Array.from(vars),
            fnParametric: (val: number, scope: any) => {
              const r = code.evaluate({ ...scope, theta: val });
              return { x: r * Math.cos(val), y: r * Math.sin(val) };
            },
            paramBounds: [0, 12 * Math.PI],
          };
        }

        if (!result && left === "y" && !right.includes("y")) {
          Logger.debug(
            "Evaluator",
            "Compiling explicit function representation.",
          );
          const node = transformDerivatives(parse(right), customFunctions);
          extractVars(node, vars);
          const code = node.compile();
          vars.delete("x");

          if (op === "=") {
            result = {
              name,
              type: "explicit",
              vars: Array.from(vars),
              fnExplicit: (x: number, scope: any) =>
                code.evaluate({ ...scope, x }),
            };
          } else {
            Logger.debug(
              "Evaluator",
              "Compiling explicit inequality representation.",
            );
            const implicitStr = `(y) - (${right})`;
            const impNode = transformDerivatives(
              parse(implicitStr),
              customFunctions,
            );
            extractVars(impNode, vars);
            const impCode = impNode.compile();

            let glslData = null;
            try {
              glslData = compileGLSL(impNode, isComplex);
            } catch (e: any) {
              Logger.warn(
                "Evaluator",
                `GLSL compilation failed for inequality: ${e.message}`,
              );
            }

            result = {
              name,
              type: "inequality",
              operator: op,
              vars: Array.from(vars),
              fnImplicit: (x: number, y: number, scope: any) =>
                impCode.evaluate({ ...scope, x, y }),
              glslExpr: glslData?.glsl,
              glslUniforms: glslData?.uniforms,
            };
          }
        }

        if (!result) {
          Logger.debug(
            "Evaluator",
            "Compiling implicit equation representation.",
          );
          const implicitStr = `(${left}) - (${right})`;
          const node = transformDerivatives(parse(implicitStr), customFunctions);
          extractVars(node, vars);
          const code = node.compile();

          let glslData = null;
          try {
            glslData = compileGLSL(node, isComplex);
          } catch (e: any) {
            Logger.warn(
              "Evaluator",
              `GLSL compilation failed for implicit equation: ${e.message}`,
            );
          }

          result = {
            name,
            type: op === "=" ? "implicit" : "inequality",
            operator: op,
            vars: Array.from(vars),
            fnImplicit: (x: number, y: number, scope: any) =>
              code.evaluate({ ...scope, x, y }),
            glslExpr: glslData?.glsl,
            glslUniforms: glslData?.uniforms,
          };
        }
      }
    }

    if (!result) {
      Logger.debug(
        "Evaluator",
        "Compiling standalone evaluation representation.",
      );
      const nodeStandalone = transformDerivatives(parse(exprText), customFunctions);
      extractVars(nodeStandalone, vars);
      const codeStandalone = nodeStandalone.compile();

      if (!vars.has("x") && !vars.has("y")) {
        result = {
          name,
          type: "explicit",
          vars: Array.from(vars),
          constantValue: (scope: any) => codeStandalone.evaluate(scope),
        };
      } else {
        vars.delete("x");
        result = {
          name,
          type: "explicit",
          vars: Array.from(vars),
          fnExplicit: (x: number, scope: any) =>
            codeStandalone.evaluate({ ...scope, x }),
        };
      }
    }

    if (result && isTraced) result.isTraced = true;
    return result;
  } catch (e: any) {
    Logger.error(
      "Evaluator",
      `Compilation failure during parse stage: ${e.message}`,
    );
    return null;
  }
}

