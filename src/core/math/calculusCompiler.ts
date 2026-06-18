/**
 * @file calculusCompiler.ts
 * @brief Calculus and Regression operations compiler.
 * @details Evaluates numerical integration and resolves dataset mapping algorithms dynamically into regression curves.
 */
import { parse } from "mathjs";
import { Logger } from "../../utils/logger";
import { extractVars, transformDerivatives, substituteCustomFunctions } from "./transformers";
import type { CompiledEquationData } from "./evaluator";

/**
 * @brief Attempts to compile expressions matching explicit Calculus instructions or statistical Regression functions.
 * @param exprText Mathematical expression string to interrogate.
 * @param name Optional declared name of the mapping (e.g. `f(x)`).
 * @param vars Mutable set grouping parsed independent arguments.
 * @return Compiled equation evaluating logic structures numerically, or null if unmatched.
 */
export function compileCalculusAndRegression(
  exprText: string,
  name: string | undefined,
  vars: Set<string>,
  customFunctions?: Record<string, { param: string; body: string }>,
): CompiledEquationData | null {
  const intMatch = exprText.match(
    /^\s*int\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/,
  );
  if (intMatch) {
    Logger.debug("CalculusCompiler", "Compiling integral representation.");
    let fNode = transformDerivatives(parse(intMatch[1]));
    // Inline user-defined functions (e.g. h(x) = f(g(x))) before compiling.
    if (customFunctions) {
      fNode = substituteCustomFunctions(fNode, customFunctions);
    }
    const aNode = transformDerivatives(parse(intMatch[2]));
    const bNode = transformDerivatives(parse(intMatch[3]));
    extractVars(fNode, vars);
    extractVars(aNode, vars);
    extractVars(bNode, vars);
    const fCode = fNode.compile();
    const aCode = aNode.compile();
    const bCode = bNode.compile();

    return {
      name,
      type: "integral",
      vars: Array.from(vars),
      fnExplicit: (x: number, scope: any) => fCode.evaluate({ ...scope, x }),
      boundsFn: (scope: any) => [aCode.evaluate(scope), bCode.evaluate(scope)],
    };
  }

  const eqMatch = exprText.match(/^(.*?)(<=|>=|<|>|=|~|->)(.*)$/);
  if (eqMatch) {
    let left = eqMatch[1].trim();
    const op = eqMatch[2];
    let right = eqMatch[3].trim();

    if (left === "f(x)" && op === "=") left = "y";

    if (op === "~") {
      Logger.debug("CalculusCompiler", "Compiling regression representation.");
      const lNode = transformDerivatives(parse(left));
      const rNode = transformDerivatives(parse(right));
      extractVars(lNode, vars);
      extractVars(rNode, vars);
      const lCode = lNode.compile();
      const rCode = rNode.compile();
      const allVars = Array.from(vars);

      return {
        name,
        type: "regression",
        vars: allVars,
        fnExplicit: (x: number, scope: any) => {
          const localScope = { ...scope };
          // Find the array-based independent variable and replace it with scalar x for continuous plotting
          for (const v of allVars) {
            if (scope[v] && (Array.isArray(scope[v]) || scope[v].toArray)) {
              localScope[v] = x;
            }
          }
          return rCode.evaluate(localScope);
        },
        regressionSolve: (scope: any) => {
          let N = 0;
          for (const v of allVars) {
            if (scope[v] && (Array.isArray(scope[v]) || scope[v].toArray)) {
              N = scope[v].length || scope[v].toArray().length;
              break;
            }
          }
          if (N === 0) return null;

          const params: Record<string, number> = {};
          for (const v of allVars) {
            if (v === 't') continue;
            const val = scope[v];
            if (val === undefined || (!Array.isArray(val) && !val?.toArray)) {
              params[v] = val !== undefined ? val : 1.0;
            }
          }

          const unknownKeys = Object.keys(params);
          if (unknownKeys.length === 0) return null;

          const calcLoss = (p: Record<string, number>) => {
            let loss = 0;
            const evalScope = { ...scope, ...p };
            for (let i = 0; i < N; i++) {
              const localScope = { ...evalScope };
              for (const v of allVars) {
                if (Array.isArray(scope[v])) localScope[v] = scope[v][i];
                else if (scope[v]?.toArray)
                  localScope[v] = scope[v].toArray()[i];
              }
              const lVal = lCode.evaluate(localScope);
              const rVal = rCode.evaluate(localScope);
              loss += (lVal - rVal) ** 2;
            }
            return loss;
          };

          const lr = 0.01;
          let bestLoss = Infinity;
          for (let step = 0; step < 500; step++) {
            const currentLoss = calcLoss(params);
            bestLoss = currentLoss;
            const grads: Record<string, number> = {};
            const h = 1e-5;
            for (const k of unknownKeys) {
              const pPlus = { ...params };
              pPlus[k] += h;
              const pMinus = { ...params };
              pMinus[k] -= h;
              grads[k] = (calcLoss(pPlus) - calcLoss(pMinus)) / (2 * h);
            }
            for (const k of unknownKeys) {
              params[k] -= lr * grads[k];
            }
          }

          let meanL = 0;
          for (let i = 0; i < N; i++) {
            const localScope = { ...scope, ...params };
            for (const v of allVars) {
              if (Array.isArray(scope[v])) localScope[v] = scope[v][i];
              else if (scope[v]?.toArray) localScope[v] = scope[v].toArray()[i];
            }
            meanL += lCode.evaluate(localScope);
          }
          meanL /= N;

          let ssTot = 0;
          for (let i = 0; i < N; i++) {
            const localScope = { ...scope, ...params };
            for (const v of allVars) {
              if (Array.isArray(scope[v])) localScope[v] = scope[v][i];
              else if (scope[v]?.toArray) localScope[v] = scope[v].toArray()[i];
            }
            ssTot += (lCode.evaluate(localScope) - meanL) ** 2;
          }

          const rSquared = 1 - bestLoss / (ssTot + 1e-10);
          return { params, rSquared };
        },
      };
    }
  }
  return null;
}
