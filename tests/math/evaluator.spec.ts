import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../src/core/math/evaluator';

describe('Evaluator Core', () => {
    describe('compileExpression', () => {
        it('should compile explicit equations and evaluate them', () => {
            const compiled = compileExpression('y = x^2 + a', undefined, false);
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.vars).toContain('a');
            expect(compiled!.fnExplicit).toBeDefined();

            const scope = { a: 5 };
            expect(compiled!.fnExplicit!(3, scope)).toBe(14); // 3^2 + 5 = 14
        });

        it('should compile explicit functions using f(x) shorthand', () => {
            const compiled = compileExpression('f(x) = sin(x)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.fnExplicit).toBeDefined();
            expect(compiled!.fnExplicit!(0, {})).toBeCloseTo(0);
        });

        it('should compile inequalities and evaluate them implicitly', () => {
            const compiled = compileExpression('y < x^2', undefined, false);
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('inequality');
            expect(compiled!.operator).toBe('<');
            expect(compiled!.fnImplicit).toBeDefined();

            // fnImplicit should evaluate y - x^2. For y=3, x=2, y-x^2 = 3-4 = -1
            expect(compiled!.fnImplicit!(2, 3, {})).toBe(-1);
        });

        it('should compile implicit equations', () => {
            const compiled = compileExpression('x^2 + y^2 = 25');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('implicit');
            expect(compiled!.fnImplicit).toBeDefined();

            // x^2 + y^2 - 25. For x=3, y=4, 9 + 16 - 25 = 0
            expect(compiled!.fnImplicit!(3, 4, {})).toBe(0);
        });

        it('should compile polar equations to parametric form', () => {
            const compiled = compileExpression('r = 4 * cos(theta)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('parametric');
            expect(compiled!.fnParametric).toBeDefined();
            expect(compiled!.paramBounds).toEqual([0, 12 * Math.PI]);

            // r = 4 * cos(0) = 4. x = r * cos(0) = 4, y = r * sin(0) = 0
            const result1 = compiled!.fnParametric!(0, {});
            expect(result1.x).toBeCloseTo(4);
            expect(result1.y).toBeCloseTo(0);

            // r = 4 * cos(pi/2) = 0. x = 0, y = 0
            const result2 = compiled!.fnParametric!(Math.PI / 2, {});
            expect(result2.x).toBeCloseTo(0);
            expect(result2.y).toBeCloseTo(0);
        });

        it('should compile actions', () => {
            const compiled = compileExpression('a -> a + 2');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('action');
            expect(compiled!.actionExecute).toBeDefined();

            const scope = { a: 10 };
            const actionResult = compiled!.actionExecute!(scope);
            expect(actionResult).toEqual({ target: 'a', value: 12 });
        });

        it('should compile constant standalone values', () => {
            const compiled = compileExpression('15 + 2 * a');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.constantValue).toBeDefined();
            expect(compiled!.constantValue!({ a: 3 })).toBe(21);
        });

        it('should support custom functions during compilation', () => {
            const customFunctions = {
                f: { param: 'x', body: 'x^2' }
            };
            const compiled = compileExpression('y = f(x) + f(2)', customFunctions);
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.fnExplicit!(3, {})).toBe(13); // 3^2 + 2^2 = 9 + 4 = 13
        });

        it('should support custom names that should not be split', () => {
            const customNames = new Set(['mvar']);
            const compiled = compileExpression('y = mvar * x', undefined, false, customNames);
            expect(compiled).not.toBeNull();
            expect(compiled!.vars).toContain('mvar');
            expect(compiled!.fnExplicit!(2, { mvar: 10 })).toBe(20);
        });

        it('should handle invalid equations gracefully', () => {
            const compiled = compileExpression('y = + * 5');
            expect(compiled).toBeNull();
        });

        it('should flag equations as traced if wrapped in Trace()', () => {
            const compiled = compileExpression('Trace(y = x)');
            expect(compiled).not.toBeNull();
            expect(compiled!.isTraced).toBe(true);
            expect(compiled!.type).toBe('explicit');
        });
    });
});
