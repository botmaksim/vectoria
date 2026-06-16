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

  let processed = text.replace(
    /\[\s*([^\]\.]+)\s*\.\.\s*([^\]]+)\s*\]/g,
    "($1:$2)",
  );
  processed = processed.replace(
    /\(?d\)?\/\(?dx\)?\s*(.+)/g,
    "derivative($1, x)",
  );

  processed = processed.replace(
    /int\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)/g,
    (match, expr, variable, a, b) => {
      try {
        return `(${nerdamer(`defint(${expr}, ${a}, ${b}, ${variable})`).toString()})`;
      } catch (e) {
        return match;
      }
    },
  );

  processed = processed.replace(/\{([^}]+)\}/g, (match, contents) => {
    const parts = contents.split(",");
    let result = "NaN";
    for (let i = parts.length - 1; i >= 0; i--) {
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
      const isConstant = ["x", "y", "e", "pi", "i", "phi", "t"].includes(name);

      if (!isFunction && !isConstant) {
        vars.add(name);
      }
    }
  });
}

/**
 * @brief Resolves symbolic derivatives into their evaluated expression nodes.
 */
export function transformDerivatives(
  node: any,
  customFunctions?: Record<string, string>,
) {
  return node.transform(function (n: any) {
    if (n.isFunctionNode && n.fn.name === "derivative") {
      try {
        let exprStr = n.args[0].toString();

        if (customFunctions) {
          for (const [name, def] of Object.entries(customFunctions)) {
            const regex = new RegExp(`\\b${name}\\(([^)]+)\\)`, "g");
            exprStr = exprStr.replace(regex, `(${def})`);
          }
        }

        const derived = nerdamer.diff(exprStr, n.args[1].toString()).toString();
        return parse(derived);
      } catch (e) {
        return derivative(n.args[0], n.args[1]);
      }
    }
    return n;
  });
}
