import { describe, it, expect } from 'vitest';
import { parse } from 'mathjs';
import {
    preprocessMathLive,
    transformImplicitMultiplication,
    substituteCustomFunctions,
    transformDerivatives
} from '../../../src/core/math/transformers';

describe('Math Preprocessor & Transformers', () => {
    describe('preprocessMathLive', () => {
        it('should strip braces from LaTeX-style subscripts', () => {
            expect(preprocessMathLive('c_{1} = Circle(A, B)')).toBe('c_1 = Circle(A, B)');
            expect(preprocessMathLive('s_{ab} = Segment(A, B)')).toBe('s_ab = Segment(A, B)');
            expect(preprocessMathLive('O = Intersect(pb_{ab}, pb_{bc})')).toBe('O = Intersect(pb_ab, pb_bc)');
        });

        it('should translate piecewise conditional braces into ternary operators', () => {
            expect(preprocessMathLive('{x > 0 : 5, -5}')).toBe('((x > 0) ? (5) : (-5))');
        });

        it('should translate chained piecewise conditional expressions', () => {
            const input = '{x > 0 and y > 0 : 5, x > 0 : 2, -5}';
            const expected = '((x > 0 and y > 0) ? (5) : ((x > 0) ? (2) : (-5)))';
            expect(preprocessMathLive(input)).toBe(expected);
        });

        it('should translate complex subscripts with letters and numbers', () => {
            expect(preprocessMathLive('p_{12}')).toBe('p_12');
            expect(preprocessMathLive('val_{max}')).toBe('val_max');
        });

        it('should translate dynamic derivatives', () => {
            expect(preprocessMathLive('d/dx(x^2)')).toBe('derivative((x^2), x)');
            expect(preprocessMathLive('d/dt(sin(t))')).toBe('derivative((sin(t)), t)');
        });

        it('should translate derivative shorthand f\'(x)', () => {
            expect(preprocessMathLive("f'(x)")).toBe('derivative(f(x), x)');
            expect(preprocessMathLive("f^'(x)")).toBe('derivative(f(x), x)');
            expect(preprocessMathLive("g'(t)")).toBe('derivative(g(t), t)');
        });

        it('should translate definite integrals', () => {
            expect(preprocessMathLive('int_(0)^(5) x^2 dx')).toBe('int(x^2, 0, 5)');
            expect(preprocessMathLive('int_0^5 x^2 dx')).toBe('int(x^2, 0, 5)');
        });
        
        it('should handle nested functions inside integrals and derivatives safely', () => {
            expect(preprocessMathLive('d/dx(sin(cos(x)))')).toBe('derivative((sin(cos(x))), x)');
            expect(preprocessMathLive('int_0^pi sin(x) dx')).toBe('int(sin(x), 0, pi)');
        });
    });

    describe('transformImplicitMultiplication', () => {
        it('should split simple implicit multiplication', () => {
            const node = parse('xy');
            const transformed = transformImplicitMultiplication(node);
            expect(transformed.toString()).toBe('x * y');
        });

        it('should split three letters', () => {
            const node = parse('abc');
            const transformed = transformImplicitMultiplication(node);
            expect(transformed.toString()).toBe('a * b * c');
        });

        it('should preserve known variables and keywords', () => {
            const customNames = new Set(['x1', 'y1']);
            const node = parse('theta * pi * sin(x1)');
            const transformed = transformImplicitMultiplication(node, customNames);
            expect(transformed.toString()).toBe('theta * pi * sin(x1)');
        });

        it('should split variables alongside known variables', () => {
            const node = parse('xsin(x)');
            const transformed = transformImplicitMultiplication(node);
            expect(transformed.toString()).toBe('x * sin(x)');
        });

        it('should ignore pure function names', () => {
            const node = parse('cos(x)');
            const transformed = transformImplicitMultiplication(node);
            expect(transformed.toString()).toBe('cos(x)');
        });
    });

    describe('substituteCustomFunctions', () => {
        it('should substitute parameter in custom functions', () => {
            const customFunctions = {
                f: { param: 'x', body: 'x^2 - 4' }
            };
            const node = parse('f(t)');
            const substituted = substituteCustomFunctions(node, customFunctions);
            expect(substituted.toString()).toBe('t ^ 2 - 4');
        });

        it('should support nested custom functions and complex arguments', () => {
            const customFunctions = {
                f: { param: 'x', body: 'x^2' }
            };
            const node = parse('f(u + 2)');
            const substituted = substituteCustomFunctions(node, customFunctions);
            expect(substituted.toString()).toBe('(u + 2) ^ 2');
        });

        it('should not mutate functions that are not defined in customFunctions', () => {
            const customFunctions = {
                f: { param: 'x', body: 'x^2' }
            };
            const node = parse('sin(t)');
            const substituted = substituteCustomFunctions(node, customFunctions);
            expect(substituted.toString()).toBe('sin(t)');
        });
    });

    describe('transformDerivatives', () => {
        it('should solve symbolic derivatives analytically via Nerdamer', () => {
            const node = parse('derivative(x^2, x)');
            const resolved = transformDerivatives(node);
            expect(resolved.toString().replace(/\s/g, '')).toBe('2*x');
        });

        it('should resolve derivatives of trigonometric functions', () => {
            const node = parse('derivative(sin(x), x)');
            const resolved = transformDerivatives(node);
            expect(resolved.toString().replace(/\s/g, '')).toBe('cos(x)');
        });

        it('should resolve chained derivatives (e.g. exponential composition)', () => {
            const node = parse('derivative(exp(x^2), x)');
            const resolved = transformDerivatives(node);
            // Nerdamer outputs e^(x^2)*2*x or similar depending on simplifications
            expect(resolved.toString().replace(/\s/g, '')).toContain('2*x');
        });

        it('should ignore non-derivative nodes', () => {
            const node = parse('x^2');
            const resolved = transformDerivatives(node);
            expect(resolved.toString()).toBe('x ^ 2');
        });
    });
});
