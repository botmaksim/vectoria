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
  substituteMacros,
} from "./transformers";
import { compileGeometry } from "./geometryCompiler";
import { compileCalculusAndRegression } from "./calculusCompiler";

const AST_LRU_CACHE = new Map<string, any>();
const MAX_CACHE_SIZE = 500;

function memoizedParse(expr: string) {
    if (AST_LRU_CACHE.has(expr)) {
        const node = AST_LRU_CACHE.get(expr);
        AST_LRU_CACHE.delete(expr);
        AST_LRU_CACHE.set(expr, node);
        return node.clone();
    }
    const node = parse(expr);
    if (AST_LRU_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = AST_LRU_CACHE.keys().next().value;
        if (firstKey !== undefined) {
            AST_LRU_CACHE.delete(firstKey);
        }
    }
    AST_LRU_CACHE.set(expr, node.clone());
    return node;
}

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
  | "conic"
  | "regression"
  | "action"
  | "transform"
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
  conicData?: (
    scope: any,
  ) => { a: number; b: number; c: number; d: number; e: number; f: number } | null;
  polygonData?: (scope: any) => { x: number; y: number }[] | null;
  circleData?: (scope: any) => { cx: number; cy: number; r: number } | null;
  constantValue?: (scope: any) => any;
  regressionSolve?: (
    scope: any,
  ) => { params: Record<string, number>; rSquared: number } | null;
  actionExecute?: (scope: any) => { target: string; value: any } | null;
  evaluatedExpression?: string;
  transformExecute?: (scope: any) => any;
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
export function compileExpression(text: string, customFunctions?: Record<string, { param: string; body: string }>, customNames?: Set<string>, macros?: Record<string, string>): CompiledEquationData | null {
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

    const originalText = text;
    text = preprocessMathLive(text);
    console.group(`[Evaluator] compileExpression`);
    console.log('  Input:', originalText);
    console.log('  After preprocessMathLive:', text);
    console.log('  Macros passed in:', JSON.stringify(macros || {}));
    console.log('  CustomNames passed in:', customNames ? [...customNames] : []);
    const vars = new Set<string>();

    let name: string | undefined;
    const assignMatch = text.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=(.*)$/);
    let exprText = text;

    if (assignMatch && !["y", "x", "r", "f(x)"].includes(assignMatch[1].trim())) {
      name = assignMatch[1].trim();
      exprText = assignMatch[2].trim();
      console.log(`  Extracted name="${name}", exprText="${exprText}"`);
    } else {
      console.log(`  No assignment found, exprText="${exprText}"`);
    }

    let parseTarget = exprText;
    if (exprText.includes('=')) {
      const parts = exprText.split('=');
      parseTarget = parts[parts.length - 1].trim();
    }

    try {
      let node = parse(parseTarget);
      if (customFunctions) node = substituteCustomFunctions(node, customFunctions);
      if (macros) node = substituteMacros(node, macros, customFunctions);
      extractVars(node, vars);
    } catch (e) {}

    if (customNames) {
      for (const cn of customNames) vars.delete(cn);
    }
    
    if (name && typeof name === "string") {
      vars.delete(name);
    }

    // Preprocess custom functions and implicit multiplication via AST on LHS / RHS
    const eqMatchPre = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
    if (eqMatchPre) {
      let left = eqMatchPre[1].trim();
      const op = eqMatchPre[2];
      let right = eqMatchPre[3].trim();
      
      let isFuncDecl = false;
      if (op === "=" && left.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_])\s*\)\s*$/)) {
        isFuncDecl = true;
      }

      try {
        if (!isFuncDecl) {
          let leftNode = parse(left);
          leftNode = substituteCustomFunctions(leftNode, customFunctions || {});
          if (macros && macros[left.trim()]) {
              left = "0";
          } else {
              if (macros) leftNode = substituteMacros(leftNode, macros, customFunctions);
              leftNode = transformImplicitMultiplication(leftNode, customNames || new Set());
              left = leftNode.toString();
          }
        }
      } catch (e) {
        console.error("Error substituting left:", e);
      }

      try {
        let rightNode = parse(right);
        rightNode = substituteCustomFunctions(rightNode, customFunctions || {});
        if (macros) rightNode = substituteMacros(rightNode, macros, customFunctions);
        rightNode = transformImplicitMultiplication(rightNode, customNames || new Set());
        right = rightNode.toString();
      } catch (e) {
        console.error("Error substituting right:", e);
      }
      
      exprText = `${left} ${op} ${right}`;
    } else {
      try {
        let node = parse(exprText);
        node = substituteCustomFunctions(node, customFunctions || {});
        if (macros) node = substituteMacros(node, macros, customFunctions);
        node = transformImplicitMultiplication(node, customNames || new Set());
        exprText = node.toString();
      } catch {}
    }

    let result: CompiledEquationData | null = null;

    const eqMatchGeo = exprText.match(/^(.*?)(=)(.*)$/);
    let geoTarget = exprText;
    let geoName = name;
    if (eqMatchGeo) {
        geoName = eqMatchGeo[1].trim();
        geoTarget = eqMatchGeo[3].trim();
    }
    const geo = compileGeometry(geoTarget, geoName, vars, macros, customFunctions);
    if (geo) { console.log('  => geometry', geo.type); result = geo; }

    if (!result) {
      const calc = compileCalculusAndRegression(exprText, name, vars, customFunctions);
      if (calc) { console.log('  => calculus/regression', calc.type); result = calc; }
    }

    if (!result) {
      const eqMatch = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
      if (eqMatch) {
        let left = eqMatch[1].trim();
        const op = eqMatch[2];
        let right = eqMatch[3].trim();

        const leftMatch1D = left.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(\s*([a-zA-Z_])\s*\)$/);
        let fnParam = "x";
        if (leftMatch1D && op === "=") {
          const funcName = leftMatch1D[1];
          const paramName = leftMatch1D[2];
          if (paramName === "y") {
            left = "x";
          } else {
            left = "y";
          }
          fnParam = paramName;
          if (!name) name = funcName;
        }

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
          vars.delete(fnParam);

          if (op === "=") {
            result = {
            evaluatedExpression: "= " + node.toString(),
            name,
            type: "explicit",
              vars: Array.from(vars),
              fnExplicit: (x: number, scope: any) => {
                try {
                  return code.evaluate({ ...scope, [fnParam]: x });
                } catch (e) {
                  return NaN;
                }
              },
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
              glslData = compileGLSL(impNode);
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
          let node = transformDerivatives(parse(implicitStr), customFunctions);
          
          let hasPolar = false;
          node.traverse((n: any) => {
              if (n.isSymbolNode && (n.name === 'r' || n.name === 'theta')) hasPolar = true;
          });
          
          if (hasPolar) {
              node = node.transform((n: any) => {
                  if (n.isSymbolNode) {
                      if (n.name === 'r') return parse('sqrt(x^2 + y^2)');
                      if (n.name === 'theta') return parse('atan2(y, x)');
                  }
                  return n;
              });
          }
          
          extractVars(node, vars);
          vars.delete("r");
          vars.delete("theta");
          const code = node.compile();

          let glslData = null;
          try {
            glslData = compileGLSL(node);
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
      const paraMatch = exprText.match(/^\s*\((.+?)\s*,\s*(.+?)\)\s*$/);
      if (paraMatch) {
        Logger.debug("Evaluator", "Compiling parametric curve representation.");
        try {
            const xNode = transformDerivatives(parse(paraMatch[1]), customFunctions);
            const yNode = transformDerivatives(parse(paraMatch[2]), customFunctions);
            extractVars(xNode, vars);
            extractVars(yNode, vars);
            const xCode = xNode.compile();
            const yCode = yNode.compile();
            vars.delete("t");
            result = {
                name,
                type: "parametric",
                vars: Array.from(vars),
                fnParametric: (val: number, scope: any) => {
                    return { x: xCode.evaluate({ ...scope, t: val }), y: yCode.evaluate({ ...scope, t: val }) };
                },
                paramBounds: [0, 12 * Math.PI]
            };
        } catch (e) {
            Logger.debug("Evaluator", "Failed to compile parametric tuple");
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
            evaluatedExpression: "= " + exprText,
            name,
            type: "explicit",
          vars: Array.from(vars),
          constantValue: (scope: any) => codeStandalone.evaluate(scope),
        };
      } else {
        if (name && (name.includes('_dt') || name.includes('_d'))) {
          vars.add("x");
          vars.add("y");
          
          let glslData = null;
          try {
            glslData = compileGLSL(nodeStandalone);
          } catch (e: any) {}

          result = {
              evaluatedExpression: "= " + exprText + " = 0 (Nullcline)",
              name,
              type: "implicit",
              operator: "=",
              vars: Array.from(vars),
              fnImplicit: (x: number, y: number, scope: any) =>
                codeStandalone.evaluate({ ...scope, x, y }),
              glslExpr: glslData?.glsl,
              glslUniforms: glslData?.uniforms,
          };
        } else {
          vars.delete("x");
          result = {
              evaluatedExpression: "= " + exprText,
              name,
              type: "explicit",
            vars: Array.from(vars),
            fnExplicit: (x: number, scope: any) => {
              try {
                return codeStandalone.evaluate({ ...scope, x });
              } catch (e) {
                return NaN;
              }
            },
          };
        }
      }
    }

    if (result && isTraced) result.isTraced = true;
    console.log(`  => FINAL type=${result?.type} name=${result?.name} vars=[${result?.vars}]`);
    console.groupEnd();
    return result;
  } catch (e: any) {
    Logger.error(
      "Evaluator",
      `Compilation failure during parse stage: ${e.message}`,
    );
    console.error('[Evaluator] compileExpression THREW for "' + text + '":', e);
    console.groupEnd();
    return null;
  }
}

