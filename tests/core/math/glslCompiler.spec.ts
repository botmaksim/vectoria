import { describe, it, expect } from 'vitest';
import { parse } from 'mathjs';
import { compileGLSL } from '../../../src/core/math/glslCompiler';

describe('GLSL Fragment Shader Compiler', () => {
    describe('Real math mode - Constants & Symbols', () => {
        it('should compile integer constants and append float decimals (.0)', () => {
            expect(compileGLSL(parse('5')).glsl).toBe('5.0');
            expect(compileGLSL(parse('0')).glsl).toBe('0.0');
            expect(compileGLSL(parse('-42')).glsl).toBe('-42.0');
        });

        it('should compile float constants as is', () => {
            expect(compileGLSL(parse('3.14')).glsl).toBe('3.14');
            expect(compileGLSL(parse('-0.5')).glsl).toBe('-0.5');
            expect(compileGLSL(parse('1e-5')).glsl).toBe('0.00001');
        });

        it('should compile coordinate symbols (x, y, z)', () => {
            expect(compileGLSL(parse('x')).glsl).toBe('x');
            expect(compileGLSL(parse('y')).glsl).toBe('y');
            expect(compileGLSL(parse('z')).glsl).toBe('z');
        });

        it('should translate mathematical constants (e, pi)', () => {
            expect(compileGLSL(parse('e')).glsl).toBe('2.718281828459045');
            expect(compileGLSL(parse('pi')).glsl).toBe('3.141592653589793');
            expect(compileGLSL(parse('PI')).glsl).toBe('3.141592653589793');
        });

        it('should extract unknown variables as uniforms', () => {
            const res = compileGLSL(parse('a * x + b * y + c'));
            expect(res.glsl).toBe('(((a * x) + (b * y)) + c)');
            expect(res.uniforms).toContain('a');
            expect(res.uniforms).toContain('b');
            expect(res.uniforms).toContain('c');
        });

        it('should properly compile NaN', () => {
            expect(compileGLSL(parse('NaN')).glsl).toBe('(0.0/0.0)');
        });
    });

    describe('Real math mode - Operators', () => {
        it('should compile basic arithmetic operators', () => {
            expect(compileGLSL(parse('x + y')).glsl).toBe('(x + y)');
            expect(compileGLSL(parse('x - y')).glsl).toBe('(x - y)');
            expect(compileGLSL(parse('x * y')).glsl).toBe('(x * y)');
            expect(compileGLSL(parse('x / y')).glsl).toBe('(x / y)');
        });

        it('should compile exponentiation using pow()', () => {
            expect(compileGLSL(parse('x ^ 2')).glsl).toBe('pow(x, 2.0)');
            expect(compileGLSL(parse('x ^ y')).glsl).toBe('pow(x, y)');
            expect(compileGLSL(parse('2 ^ x')).glsl).toBe('pow(2.0, x)');
        });

        it('should compile modulo using mod()', () => {
            expect(compileGLSL(parse('x % y')).glsl).toBe('mod(x, y)');
            expect(compileGLSL(parse('10 % 3')).glsl).toBe('mod(10.0, 3.0)');
        });

        it('should compile unary operators', () => {
            expect(compileGLSL(parse('-x')).glsl).toBe('-x');
            expect(compileGLSL(parse('+x')).glsl).toBe('+x');
        });

        it('should compile logical operators', () => {
            expect(compileGLSL(parse('x > 0 and y < 1')).glsl).toBe('((x > 0.0) && (y < 1.0))');
            expect(compileGLSL(parse('x <= 0 or y >= 1')).glsl).toBe('((x <= 0.0) || (y >= 1.0))');
            expect(compileGLSL(parse('x == y')).glsl).toBe('(x == y)');
            expect(compileGLSL(parse('x != y')).glsl).toBe('(x != y)');
        });
    });

    describe('Real math mode - Functions', () => {
        const simpleFunctions = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sqrt', 'exp', 'log', 'abs', 'ceil', 'floor', 'round', 'sign'];
        
        simpleFunctions.forEach(fn => {
            it(`should compile ${fn}() function correctly`, () => {
                expect(compileGLSL(parse(`${fn}(x)`)).glsl).toBe(`${fn}(x)`);
            });
        });

        it('should compile hyperbolic functions with polyfills', () => {
            expect(compileGLSL(parse('sinh(x)')).glsl).toBe('((exp(x) - exp(-(x))) * 0.5)');
            expect(compileGLSL(parse('cosh(x)')).glsl).toBe('((exp(x) + exp(-(x))) * 0.5)');
            expect(compileGLSL(parse('tanh(x)')).glsl).toBe('((exp(x) - exp(-(x))) / (exp(x) + exp(-(x))))');
        });

        it('should compile multi-argument functions', () => {
            expect(compileGLSL(parse('atan2(y, x)')).glsl).toBe('atan(y, x)');
            expect(compileGLSL(parse('max(x, y)')).glsl).toBe('max(x, y)');
            expect(compileGLSL(parse('min(x, y)')).glsl).toBe('min(x, y)');
        });

        it('should compile custom log10 mapping', () => {
            expect(compileGLSL(parse('log10(x)')).glsl).toBe('(log2(x) * 0.30102999566)');
        });
    });

    describe('Real math mode - Expressions & Conditionals', () => {
        it('should compile parenthesis accurately', () => {
            expect(compileGLSL(parse('(x + y) * 2')).glsl).toBe('(((x + y)) * 2.0)');
        });

        it('should compile ternary operators (Conditionals)', () => {
            expect(compileGLSL(parse('x > 0 ? 1 : -1')).glsl).toBe('( ((x > 0.0)) ? (1.0) : (-1.0) )');
            expect(compileGLSL(parse('x > y ? x : y')).glsl).toBe('( ((x > y)) ? (x) : (y) )');
        });
    });

    

        describe('Error handling', () => {
        it('should throw an error for assignment operations', () => {
            expect(() => compileGLSL(parse('a = 5'))).toThrow('Assignments not supported in WebGL formula');
        });

        it('should throw an error for unsupported functions', () => {
            expect(() => compileGLSL(parse('unsupported_func(x)'))).toThrow('Function unsupported_func not supported in WebGL');
        });

        it('should throw an error for unknown node types', () => {
            // Force a fake AST node
            expect(() => compileGLSL({ type: 'FakeNode' })).toThrow('Unsupported math node: FakeNode');
        });
    });
});
