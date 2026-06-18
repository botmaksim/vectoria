import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../../src/core/math/evaluator';

describe('Calculus & Regression Compiler', () => {
    describe('Integrals', () => {
        it('should compile definite integrals using the int() notation', () => {
            const compiled = compileExpression('int(x^2, 0, 3)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('integral');
            
            // Integral of x^2 is represented dynamically. Evaluator creates a fnExplicit for plotting.
            expect(compiled!.fnExplicit).toBeDefined();
            expect(compiled!.boundsFn).toBeDefined();

            const scope = {};
            // The bounds are statically 0 and 3
            expect(compiled!.boundsFn!(scope)).toEqual([0, 3]);

            // And the function inside is x^2
            expect(compiled!.fnExplicit!(2, scope)).toBe(4);
        });

        it('should compile function integrals using int()', () => {
            const compiled = compileExpression('int(sin(x), 0, pi)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('integral');
            
            // Function value at x = pi/2 is sin(pi/2) = 1
            expect(compiled!.fnExplicit!(Math.PI / 2, {})).toBeCloseTo(1);
        });
    });

    describe('Regression Solver', () => {
        it('should compile regression syntax and solve for simple linear data', () => {
            const compiled = compileExpression('y1 ~ m * x1 + c');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('regression');
            expect(compiled!.regressionSolve).toBeDefined();
            expect(compiled!.fnExplicit).toBeDefined();

            const scope = {
                x1: [1, 2, 3, 4],
                y1: [2, 4, 6, 8]
            };
            
            // Should solve dynamically and return params
            const results = compiled!.regressionSolve!(scope);
            expect(results).not.toBeNull();
            expect(results.params).toHaveProperty('m');
            expect(results.params).toHaveProperty('c');
            expect(results.params.m).toBeCloseTo(2, 0); // Linear fit yields slope ~ 2
            expect(results.params.c).toBeCloseTo(0, 0); // intercept ~ 0
        });

        it('should treat missing regression variables as unknown parameters and solve', () => {
            const compiled = compileExpression('y1 ~ m * x1 + c');
            const scope = { x1: [1, 2, 3] }; // Missing y1
            // The compiler initializes missing variables as parameters with value 1.0 and attempts to solve
            const results = compiled!.regressionSolve!(scope);
            expect(results).not.toBeNull();
            expect(results!.params).toBeDefined();
        });
    });
});
