/**
 * @file compiler.worker.ts
 * @brief WebWorker script for asynchronous AST parsing and GLSL shader compilation.
 * @details Offloads heavy MathJS expression compilation to prevent main thread blocking, ensuring high FPS for dense interfaces.
 */
import { parse } from "mathjs";
import { compileGLSL } from "../math/glslCompiler";
import { extractVars, transformDerivatives } from "../math/transformers";

self.onmessage = (e) => {
  const { id, exprText, isComplex } = e.data;
  try {
    const node = transformDerivatives(parse(exprText));
    const vars = new Set<string>();
    extractVars(node, vars);
    const glslData = compileGLSL(node, isComplex);
    self.postMessage({
      id,
      success: true,
      glsl: glslData.glsl,
      uniforms: glslData.uniforms,
      vars: Array.from(vars),
    });
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
