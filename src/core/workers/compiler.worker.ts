/**
 * @file compiler.worker.ts
 * @brief Web Worker for offline compilation of mathematical expressions to GLSL.
 * @details Offloads heavy mathjs parsing, custom function expansion, implicit multiplication splitting,
 *          and GLSL AST translation to a background thread to prevent UI thread blocking.
 */

import { parse } from "mathjs";
import { compileGLSL } from "../math/glslCompiler";
import {
  extractVars,
  transformDerivatives,
  transformImplicitMultiplication,
  substituteCustomFunctions,
} from "../math/transformers";

self.onmessage = (e: MessageEvent) => {
  const { id, exprText, isComplex, customFunctions, customNames } = e.data;
  try {
    const customNamesSet = new Set<string>(customNames || []);
    let finalExpr = exprText;

    // Split equation of form LHS = RHS into LHS - RHS
    const eqMatch = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
    if (eqMatch) {
      let left = eqMatch[1].trim();
      const op = eqMatch[2];
      let right = eqMatch[3].trim();
      if (left === "f(x)" && op === "=") {
        left = "y";
      }
      if (op === "->") {
        finalExpr = right;
      } else if (left === "r" && op === "=") {
        finalExpr = right;
      } else if (left === "y" && !right.includes("y") && op === "=") {
        finalExpr = right;
      } else {
        finalExpr = `(${left}) - (${right})`;
      }
    }

    let node = parse(finalExpr);
    node = substituteCustomFunctions(node, customFunctions || {});
    node = transformImplicitMultiplication(node, customNamesSet);
    node = transformDerivatives(node, customFunctions);

    const vars = new Set<string>();
    extractVars(node, vars);
    const glslData = compileGLSL(node);

    self.postMessage({
      id,
      success: true,
      glsl: glslData.glsl,
      uniforms: glslData.uniforms,
      vars: Array.from(vars),
    });
  } catch (err: any) {
    self.postMessage({
      id,
      success: false,
      error: err.message || String(err),
    });
  }
};
