import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../src/core/math/evaluator';

describe('Calculus & Regression Compiler', () => {
    describe('Definite Integrals', () => {
        it('should compile an integral and return bounds and evaluation logic', () => {
            // int(x^2 + c, a_val, b_val)
            const compiled = compileExpression('int(x^2 + c, 1, 5)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('integral');
            expect(compiled!.vars).toContain('c');
            expect(compiled!.fnExplicit).toBeDefined();
            expect(compiled!.boundsFn).toBeDefined();

            // Evaluate integrand at x = 3 with c = 10 -> 3^2 + 10 = 19
            expect(compiled!.fnExplicit!(3, { c: 10 })).toBe(19);

            // Verify bounds function returns [1, 5]
            expect(compiled!.boundsFn!({})).toEqual([1, 5]);
        });

        it('should support dynamic variables in bounds', () => {
            const compiled = compileExpression('int(sin(x), limit1, limit2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('integral');
            expect(compiled!.vars).toContain('limit1');
            expect(compiled!.vars).toContain('limit2');

            const bounds = compiled!.boundsFn!({ limit1: -Math.PI, limit2: Math.PI });
            expect(bounds[0]).toBeCloseTo(-Math.PI);
            expect(bounds[1]).toBeCloseTo(Math.PI);
        });
    });

    describe('Regression Solver', () => {
        it('should compile regression syntax and solve for simple linear data', () => {
            // y1 ~ m * x1 + c
            const compiled = compileExpression('y1 ~ m * x1 + c');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('regression');
            expect(compiled!.vars).toContain('x1');
            expect(compiled!.vars).toContain('y1');
            expect(compiled!.vars).toContain('m');
            expect(compiled!.vars).toContain('c');
            expect(compiled!.regressionSolve).toBeDefined();

            // Scope containing mock data
            // y = 2 * x + 1
            const scope = {
                x1: [1, 2, 3, 4, 5],
                y1: [3, 5, 7, 9, 11]
            };

            const solution = compiled!.regressionSolve!(scope);
            expect(solution).not.toBeNull();
            
            const { params, rSquared } = solution!;
            expect(params.m).toBeCloseTo(2, 1);
            expect(params.c).toBeCloseTo(1, 1);
            expect(rSquared).toBeGreaterThan(0.99);

            // Test continuous evaluation function fnExplicit with solved parameters in scope
            const evalScope = { ...scope, ...params };
            // fnExplicit should replace array-based independent variables (like x1) with x for continuous plotting
            const yAt2_5 = compiled!.fnExplicit!(2.5, evalScope);
            expect(yAt2_5).toBeCloseTo(2 * 2.5 + 1, 1);
        });

        it('should solve quadratic regression fitting', () => {
            // y1 ~ a * x1^2 + b * x1 + c
            const compiled = compileExpression('y1 ~ a * x1^2 + b * x1 + c');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('regression');

            // y = 3 * x^2 - 2 * x + 5
            const scope = {
                x1: [-2, -1, 0, 1, 2],
                y1: [21, 10, 5, 6, 13]
            };

            const solution = compiled!.regressionSolve!(scope);
            expect(solution).not.toBeNull();

            const { params, rSquared } = solution!;
            expect(params.a).toBeCloseTo(3, 1);
            expect(params.b).toBeCloseTo(-2, 1);
            expect(params.c).toBeCloseTo(5, 1);
            expect(rSquared).toBeGreaterThan(0.99);
        });

        it('should return null when scope is missing regression variables data', () => {
            const compiled = compileExpression('y1 ~ m * x1 + c');
            expect(compiled).not.toBeNull();
            
            // Missing x1 and y1 arrays
            const solution = compiled!.regressionSolve!({});
            expect(solution).toBeNull();
        });
    });
});
