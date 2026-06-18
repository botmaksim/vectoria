/**
 * @file glslCompiler.ts
 * @brief Converts MathJS AST nodes into WebGL Fragment Shader language (GLSL) code.
 * @details Traverses a mathematical abstract syntax tree and systematically translates its nodes (operators, functions, symbols) into their corresponding GLSL equivalents. Handles automatic extraction of uniform variables and float enforcement.
 */

import { Logger } from "../../utils/logger";

/**
 * @interface GLSLCompilationResult
 * @brief Result structure holding the compiled GLSL expression and associated uniform variables.
 */
export interface GLSLCompilationResult {
  /** @brief The compiled GLSL string representing the mathematical expression. */
  glsl: string;
  /** @brief An array of variable names that must be bound as WebGL uniforms. */
  uniforms: string[];
}

/**
 * @brief Compiles a given MathJS AST node into a GLSL string.
 * @param node The MathJS AST node to compile.
 * @returns A GLSLCompilationResult containing the raw GLSL code and required uniforms.
 * @throws Error if the AST contains unsupported operations or functions.
 */
export function compileGLSL(
  node: any,
): GLSLCompilationResult {
  Logger.debug("GLSLCompiler", "Initiating GLSL compilation for an AST node.");
  const uniforms = new Set<string>();

  /**
   * @brief Recursively traverses the AST and translates nodes to GLSL syntax.
   * @param n The current AST node.
   * @returns The GLSL representation of the node and its children.
   */
  function traverse(n: any): string {
    if (!n) return "";

    switch (n.type) {
      case "ConstantNode": {
        const val = n.value.toString();
        if (val === "NaN") {
            return `(0.0/0.0)`;
        }
        let fVal = val;
        if (!val.includes(".") && !val.includes("e")) fVal = val + ".0";
        return fVal;
      }
      case "SymbolNode": {
        const name = n.name;
        if (name === "x" || name === "y" || name === "z") {
          return name;
        }
        if (name === "i") {
          return name;
        }
        let cVal = name;
        if (name === "e") cVal = "2.718281828459045";
        else if (name === "pi" || name === "PI") cVal = "3.141592653589793";
        else uniforms.add(name);
        if (name === "NaN") {
          return `(0.0/0.0)`;
        }

        return cVal;
      }
      case "OperatorNode": {
        if (n.fn === "pow") {
          return `pow(${traverse(n.args[0])}, ${traverse(n.args[1])})`;
        }

        if (n.isUnary()) {
          return `${n.op}${traverse(n.args[0])}`;
        }

        const left = traverse(n.args[0]);
        const right = traverse(n.args[1]);

        if (n.op === "%") {
          return `mod(${left}, ${right})`;
        }

        if (n.op === "and") return `(${left} && ${right})`;
        if (n.op === "or") return `(${left} || ${right})`;

        if (n.op === "^") return `pow(${left}, ${right})`;
        return `(${left} ${n.op} ${right})`;
      }
      case "ConditionalNode": {
        const condition = traverse(n.condition);
        const trueExpr = traverse(n.trueExpr);
        const falseExpr = traverse(n.falseExpr);
        return `( (${condition}) ? (${trueExpr}) : (${falseExpr}) )`;
      }
      case "FunctionNode": {
        const fnName = n.fn.name;
        const args = n.args.map((a: any) => traverse(a)).join(", ");

        const mathToGlslMap: Record<string, string> = {
          sin: "sin",
          cos: "cos",
          tan: "tan",
          asin: "asin",
          acos: "acos",
          atan: "atan",
          atan2: "atan",
          sqrt: "sqrt",
          exp: "exp",
          log: "log",
          abs: "abs",
          ceil: "ceil",
          floor: "floor",
          round: "round",
          sign: "sign",
          max: "max",
          min: "min",
        };



        if (fnName === "log10") return `(log2(${args}) * 0.30102999566)`;
        if (fnName === "sinh") return `((exp(${args}) - exp(-(${args}))) * 0.5)`;
        if (fnName === "cosh") return `((exp(${args}) + exp(-(${args}))) * 0.5)`;
        if (fnName === "tanh") return `((exp(${args}) - exp(-(${args}))) / (exp(${args}) + exp(-(${args}))))`;

        if (mathToGlslMap[fnName]) {
          return `${mathToGlslMap[fnName]}(${args})`;
        }

        Logger.error(
          "GLSLCompiler",
          `Encountered unsupported function node: ${fnName}`,
        );
        throw new Error(`Function ${fnName} not supported in WebGL`);
      }
      case "ParenthesisNode": {
        return `(${traverse(n.content)})`;
      }
      case "AssignmentNode": {
        Logger.error(
          "GLSLCompiler",
          "Encountered assignment node inside GLSL expression.",
        );
        throw new Error("Assignments not supported in WebGL formula");
      }
      default:
        Logger.error(
          "GLSLCompiler",
          `Encountered unsupported AST node type: ${n.type}`,
        );
        throw new Error(`Unsupported math node: ${n.type}`);
    }
  }

  try {
    const glsl = traverse(node);
    const uniformArr = Array.from(uniforms);
    Logger.debug(
      "GLSLCompiler",
      `GLSL Compilation successful. Extracted ${uniformArr.length} uniforms.`,
    );
    return { glsl, uniforms: uniformArr };
  } catch (e: any) {
    Logger.error(
      "GLSLCompiler",
      `GLSL Compilation failed critically: ${e.message}`,
    );
    throw e;
  }
}
