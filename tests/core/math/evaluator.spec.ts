import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../../src/core/math/evaluator';

describe('Evaluator Core', () => {
    describe('compileExpression', () => {
        it('should return explicit function data for standard equations', () => {
            const compiled = compileExpression('y = 2 * x + 1');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.fnExplicit).toBeDefined();

            const val = compiled!.fnExplicit!(5, {});
            expect(val).toBe(11);
        });

        it('should correctly evaluate standard f(x) definitions', () => {
            const compiled = compileExpression('f(x) = x^2');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            
            const val = compiled!.fnExplicit!(3, {});
            expect(val).toBe(9);
        });

        it('should compile standalone equations (assumes y=) without fnExplicit', () => {
            const compiled = compileExpression('sin(x)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.fnExplicit).toBeUndefined(); // Uses GLSL renderer
        });

        it('should compile implicit equations and fallback to glsl rendering', () => {
            const compiled = compileExpression('x^2 + y^2 = 1');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('implicit');
            expect(compiled!.fnImplicit).toBeDefined();

            const scope = {};
            const valInside = compiled!.fnImplicit!(0, 0, scope);
            // Implicit format is LHS - RHS, so (0^2 + 0^2) - 1 = -1
            expect(valInside).toBe(-1);

            const valOnCircle = compiled!.fnImplicit!(1, 0, scope);
            expect(valOnCircle).toBe(0);
        });

        it('should compile inequalities as inequality type', () => {
            const compiled = compileExpression('y > x');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('inequality');
            expect(compiled?.glslExpr).toBeDefined();
        });

        it('should compile constant standalone values', () => {
            const compiled = compileExpression('15 + 2 * a');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            
            // Since there's no x dependency, it compiles as a constant explicit term
            expect(compiled!.constantValue).toBeDefined(); // Getter that evaluates the term
        });

        it('should fallback to standalone compilation when applicable for derivatives', () => {
            const compiled = compileExpression('Derivative(x^2, x)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            expect(compiled!.fnExplicit).toBeUndefined(); // GLSL mode
        });

        it('should fallback to geometry compilation when applicable', () => {
            const compiled = compileExpression('Circle(A_1, 5)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('circle');
        });

        it('should support custom functions during compilation', () => {
            const compiled = compileExpression('y = f(x) + f(2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
            
            const scope = { f: (x: number) => x * 10 };
            const val = compiled!.fnExplicit!(3, scope); // f(3) + f(2) = 30 + 20 = 50
            expect(val).toBe(50);
        });

        it('should support custom names that should not be split', () => {
            // Note: evaluator uses `compileExplicit` for variable assignments, and it sets customNames
            const compiled = compileExpression('y = mvar * x');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('explicit');
        });

        it('should flag equations as traced if wrapped in Trace()', () => {
            const compiled = compileExpression('Trace(x^2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.isTraced).toBe(true);
            
            // Evaluator unwraps Trace(x^2) into x^2 which is compiled to explicit
            expect(compiled!.type).toBe('explicit'); 
        });

        it('should handle invalid equations gracefully', () => {
            const compiled = compileExpression('y = + * 5');
            expect(compiled).toBeNull();
        });

        it('should preprocess MathLive integrals and derivatives', () => {
            // Evaluator's preprocessMathLive is internal but we can test it indirectly via its compilation result
            // e.g. int_0^5 x^2 dx becomes int(x^2, 0, 5) which is evaluated by nerdamer into an explicit function or constant
            const compiled = compileExpression('int_0^5 x^2 dx');
            expect(compiled).not.toBeNull();
            
            // Should compile as an integral
            expect(compiled!.type).toBe('integral');
            expect(compiled!.fnExplicit).toBeDefined();

            // e.g. d/dx(x^2) becomes derivative(x^2, x) => 2*x
            const deriv = compileExpression('d/dx(x^2)');
            expect(deriv).not.toBeNull();
        });

        it('should compile action mapping correctly', () => {
            const compiled = compileExpression('a -> a + 1');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('action');
            expect(compiled!.actionExecute).toBeDefined();
            
            const scope = { a: 5 };
            const result = compiled!.actionExecute!(scope);
            expect(result).toEqual({ target: 'a', value: 6 });
        });

        it('should fallback to parametric when defining r = ... (polar coordinates)', () => {
            const compiled = compileExpression('r = sin(theta)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('parametric');
            expect(compiled!.fnParametric).toBeDefined();

            // Polar parametric: x = r * cos(theta), y = r * sin(theta)
            // r = sin(pi/2) = 1. x = 1 * cos(pi/2) = 0, y = 1 * sin(pi/2) = 1
            const pt = compiled!.fnParametric!(Math.PI / 2, {});
            expect(pt.x).toBeCloseTo(0);
            expect(pt.y).toBeCloseTo(1);
        });
    });
});
