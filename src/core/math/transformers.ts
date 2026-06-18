/**
 * @file transformers.ts
 * @brief Parses algebraic syntax and custom mathematical operators.
 */
import { derivative, parse } from "mathjs";
// @ts-ignore
import nerdamer from "nerdamer/nerdamer.core.js";
// @ts-ignore
import "nerdamer/Algebra.js";
// @ts-ignore
import "nerdamer/Calculus.js";
import { Logger } from "../../utils/logger";

/**
 * @brief Preprocesses MathLive LaTeX-like inputs into MathJS compatible syntax.
 * @param text The raw input string.
 * @return Processed expression string.
 */
export function preprocessMathLive(text: string): string {
  Logger.debug("Evaluator", `Preprocessing MathLive input: ${text}`);

  // Support variable subscripts: e.g. s_{ab} -> s_ab, c_{1} -> c_1
  let processed = text.replace(/([a-zA-Z_][a-zA-Z0-9_]*)_\{([a-zA-Z0-9_]+)\}/g, '$1_$2');

  // Convert coordinate tuples like (1, 2) into arrays [1, 2] for MathJS.
  // We avoid replacing function calls like f(1, 2) by checking that the preceding char is not a letter/number/_
  let lastProcessed = "";
  while (processed !== lastProcessed) {
    lastProcessed = processed;
    processed = processed.replace(/(^|[^a-zA-Z0-9_])(\s*)\(([^()]+,[^()]+)\)/g, (match, p1, p2, p3) => {
      return `${p1}${p2}[${p3}]`;
    });
  }

  processed = processed.replace(
    /\[\s*([^\]\.]+)\s*\.\.\s*([^\]]+)\s*\]/g,
    "($1:$2)",
  );

  // Convert standard ascii-math integral formats:
  // e.g. int_(0)^(5) x^2 dx  => int(x^2, 0, 5)
  // e.g. int_0^5 x^2 dx      => int(x^2, 0, 5)
  processed = processed.replace(
    /int_(?:\((.*?)\)|([a-zA-Z0-9._]+))\^(?:\((.*?)\)|([a-zA-Z0-9._]+))\s*(.*?)\s*(?:d[x-z]|dt)?$/g,
    (match, a1, a2, b1, b2, expr) => {
      const a = a1 || a2;
      const b = b1 || b2;
      return `int(${expr.trim()}, ${a}, ${b})`;
    }
  );

  // Dynamic variable derivatives (e.g. d/dx(x^2), d/dt(t^2))
  processed = processed.replace(
    /\(?d\)?\/\(?d([a-zA-Z])\)?\s*(.+)/g,
    "derivative($2, $1)",
  );

  // Support derivative shorthand f'(x) or f^'(x)
  processed = processed.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)'\(([^)]+)\)/g,
    "derivative($1($2), $2)"
  );
  processed = processed.replace(
    /\b([a-zA-Z_][a-zA-Z0-9_]*)\^'\(([^)]+)\)/g,
    "derivative($1($2), $2)"
  );

  // Removed nerdamer defint processing.
  // Integral evaluation is handled dynamically by calculusCompiler.ts.

  processed = processed.replace(/\{([^}]+)\}/g, (match, contents) => {
    const parts = contents.split(",");
    let result = "NaN";
    let lastIndex = parts.length - 1;
    if (lastIndex >= 0 && parts[lastIndex].indexOf(":") === -1) {
      result = parts[lastIndex].trim();
      lastIndex--;
    }
    for (let i = lastIndex; i >= 0; i--) {
      const splitIndex = parts[i].indexOf(":");
      if (splitIndex !== -1) {
        const cond = parts[i].substring(0, splitIndex).trim();
        const expr = parts[i].substring(splitIndex + 1).trim();
        result = `(${cond}) ? (${expr}) : (${result})`;
      }
    }
    return result === "NaN" ? match : `(${result})`;
  });

  return processed;
}

/**
 * @brief Extracts variables from the AST and populates the given Set.
 */
export function extractVars(node: any, vars: Set<string>) {
  node.traverse((n: any, path: string, parent: any) => {
    if (n.isSymbolNode) {
      const name = n.name;
      const isFunction = parent && parent.isFunctionNode && parent.fn === n;
      const isConstant = ["x", "y", "e", "pi", "i", "phi", "t", "u", "dx", "dy", "dt", "dz", "d"].includes(name);

      if (!isFunction && !isConstant) {
        vars.add(name);
      }
    }
  });
}

/**
 * @brief Splits implicit multiplications of variable names (e.g. xy -> x * y) in AST.
 */
export function transformImplicitMultiplication(node: any, customNames: Set<string> = new Set()) {
  const known = new Set([
    "pi", "theta", "phi",
    "sin", "cos", "tan", "sec", "csc", "cot",
    "asin", "acos", "atan", "sinh", "cosh", "tanh",
    "log", "ln", "exp", "sqrt", "abs", "min", "max",
    "x", "y", "t", "e", "i", "z", "u",
    "circle", "segment", "line", "point", "midpoint", "intersect",
    "perpendicular", "parallel", "anglebisector", "perpendicularbisector",
    "tangent", "conic", "fourier", "voronoi", "delaunay", "transform",
    "int", "derivative", "defint", "diff", "trace",
    "polygon", "label", "physicsnode", "physicslink", "physicscloth", "vectorfield", "ode"
  ]);

  return node.transform(function (n: any) {
    if (n.isSymbolNode) {
      const name = n.name;
      const lowerName = name.toLowerCase();
      if (
        name.length > 1 &&
        !known.has(name) &&
        !known.has(lowerName) &&
        !customNames.has(name) &&
        !/\d/.test(name) &&
        !/_/.test(name)
      ) {
        const parts: string[] = [];
        let i = 0;
        let possible = true;
        while (i < name.length) {
          let matched = false;
          for (let len = name.length - i; len > 0; len--) {
            const sub = name.substring(i, i + len);
            const subLower = sub.toLowerCase();
            if (
              known.has(sub) ||
              known.has(subLower) ||
              customNames.has(sub) ||
              len === 1
            ) {
              parts.push(sub);
              i += len;
              matched = true;
              break;
            }
          }
          if (!matched) {
            possible = false;
            break;
          }
        }
        if (possible && parts.length > 1) {
          return parse(parts.join(" * "));
        }
      }
    }
    return n;
  });
}

/**
 * @brief Substitutes custom function calls (e.g. f(t)) with their defined bodies in AST.
 */
export function substituteCustomFunctions(
  node: any,
  customFunctions: Record<string, { param: string; body: string }>,
  depth: number = 0
) {
  if (depth > 20) throw new Error("Maximum function substitution depth exceeded. Infinite recursion?");
  return node.transform(function (n: any) {
    if (n.isFunctionNode) {
      const funcName = n.fn.name;
      if (customFunctions[funcName]) {
        const def = customFunctions[funcName];
        let argNode = n.args[0];
        if (!argNode) return n;
        
        argNode = substituteCustomFunctions(argNode, customFunctions, depth + 1);

        const bodyNode = parse(def.body);
        const substitutedBody = bodyNode.transform(function (bodyN: any) {
          if (bodyN.isSymbolNode && bodyN.name === def.param) {
            return argNode.clone();
          }
          return bodyN;
        });
        
        return substituteCustomFunctions(substitutedBody, customFunctions, depth + 1);
      }
    }
    return n;
  });
}

/**
 * @brief Resolves symbolic derivatives into their evaluated expression nodes.
 */
export function transformDerivatives(
  node: any,
  customFunctions?: Record<string, { param: string; body: string }>,
) {
  return node.transform(function (n: any) {
    if (n.isFunctionNode && n.fn.name === "derivative") {
      try {
        let argNode = n.args[0];
        if (customFunctions) {
          argNode = substituteCustomFunctions(argNode, customFunctions);
        }
        const exprStr = argNode.toString();
        const derived = nerdamer.diff(exprStr, n.args[1].toString()).toString();
        return parse(derived);
      } catch (e) {
        return derivative(n.args[0], n.args[1]);
      }
    }
    return n;
  });
}

