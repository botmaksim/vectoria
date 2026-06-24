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
 * @param exprTextRaw Mathematical expression string to interrogate.
 * @param name Optional declared name of the mapping (e.g. `f(x)`).
 * @param vars Mutable set grouping parsed independent arguments.
 * @return Compiled equation evaluating logic structures numerically, or null if unmatched.
 */
export function compileCalculusAndRegression(
  exprTextRaw: string,
  name: string | undefined,
  vars: Set<string>,
  customFunctions?: Record<string, { param: string; body: string }>,
  customNames?: Set<string>,
): CompiledEquationData | null {
  const exprText = exprTextRaw.replace(/\\cdot/g, '*').replace(/\\times/g, '*');
  const intMatch = exprText.match(
    /^\s*int\s*\(\s*(.+?)\s*,\s*(.+?)\s*,\s*(.+?)\s*\)\s*$/,
  );
  if (intMatch) {
    Logger.debug("CalculusCompiler", "Compiling integral representation.");
    let fNode = transformDerivatives(parse(intMatch[1]), customFunctions);
    if (customFunctions) {
      fNode = substituteCustomFunctions(fNode, customFunctions);
    }
    let aNode = transformDerivatives(parse(intMatch[2]), customFunctions);
    let bNode = transformDerivatives(parse(intMatch[3]), customFunctions);
    if (customFunctions) {
      aNode = substituteCustomFunctions(aNode, customFunctions);
      bNode = substituteCustomFunctions(bNode, customFunctions);
    }
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
      
      let rightText = right;
      const polyMatch = rightText.match(/^\s*polynom\s*\(\s*(\d+)\s*\)\s*$/i);
      if (polyMatch) {
        const degree = parseInt(polyMatch[1], 10);
        let indepVar = "x";
        const leftMatch = left.match(/^([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (leftMatch) {
           const lName = leftMatch[1];
           if (lName.startsWith("y")) {
               indepVar = lName.replace("y", "x");
           }
        }
        const polyTerms = [];
        for (let i = 0; i <= degree; i++) {
           if (i === 0) polyTerms.push(`c_${i}`);
           else if (i === 1) polyTerms.push(`c_${i} * ${indepVar}`);
           else polyTerms.push(`c_${i} * ${indepVar}^${i}`);
        }
        rightText = polyTerms.join(" + ");
      }

      let lNode = transformDerivatives(parse(left), customFunctions);
      let rNode = transformDerivatives(parse(rightText), customFunctions);
      if (customFunctions) {
        lNode = substituteCustomFunctions(lNode, customFunctions);
        rNode = substituteCustomFunctions(rNode, customFunctions);
      }
      
      const tempVars = new Set<string>();
      extractVars(lNode, tempVars);
      extractVars(rNode, tempVars);
      
      const allVars = Array.from(tempVars);
      const lCode = lNode.compile();
      const rCode = rNode.compile();
      
      const exportedVars: string[] = [];
      const fittedParams: string[] = [];
      for (const v of allVars) {
         if (customNames && customNames.has(v)) {
             exportedVars.push(v);
             vars.add(v);
         } else if (v.startsWith("x_") || v.startsWith("y_") || v === "x" || v === "y" || v === "t") {
             exportedVars.push(v);
             vars.add(v);
         } else {
             fittedParams.push(v);
         }
      }

      return {
        name,
        type: "regression",
        vars: exportedVars,
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
        regressionSolve: (scope: any, prevParams?: Record<string, number>) => {
          let N = 0;
          for (const v of allVars) {
            if (scope[v] && (Array.isArray(scope[v]) || scope[v].toArray)) {
              N = scope[v].length || scope[v].toArray().length;
              break;
            }
          }
          if (N === 0) return null;

          const params: Record<string, number> = {};
          const unknownKeys: string[] = [];
          for (const v of allVars) {
            if (v === 't') continue;
            const val = scope[v];
            
            if (fittedParams.includes(v)) {
               params[v] = (prevParams && prevParams[v] !== undefined) ? prevParams[v] : (val !== undefined ? val : 1.0);
               unknownKeys.push(v);
            }
          }

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

          const lr = 0.2;
          const beta1 = 0.9;
          const beta2 = 0.999;
          const epsilon = 1e-8;
          let m: Record<string, number> = {};
          let v_: Record<string, number> = {};
          for (const k of unknownKeys) {
             m[k] = 0;
             v_[k] = 0;
          }
          
          let bestLoss = Infinity;
          for (let step = 1; step <= 250; step++) {
            const currentLoss = calcLoss(params);
            bestLoss = currentLoss;
            const grads: Record<string, number> = {};
            const h = 1e-5;
            for (const k of unknownKeys) {
              const pPlus = { ...params };
              pPlus[k] += h;
              grads[k] = (calcLoss(pPlus) - currentLoss) / h;
            }
            for (const k of unknownKeys) {
              m[k] = beta1 * m[k] + (1 - beta1) * grads[k];
              v_[k] = beta2 * v_[k] + (1 - beta2) * (grads[k] * grads[k]);
              const mHat = m[k] / (1 - Math.pow(beta1, step));
              const vHat = v_[k] / (1 - Math.pow(beta2, step));
              params[k] -= lr * mHat / (Math.sqrt(vHat) + epsilon);
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
