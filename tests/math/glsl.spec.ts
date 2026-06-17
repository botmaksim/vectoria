import { describe, it, expect } from 'vitest';
import { parse } from 'mathjs';
import { compileGLSL } from '../../src/core/math/glslCompiler';

describe('GLSL Fragment Shader Compiler', () => {
    describe('Real math mode', () => {
        it('should compile constants and append float decimals if needed', () => {
            const node1 = parse('5');
            const res1 = compileGLSL(node1, false);
            expect(res1.glsl).toBe('5.0');
            expect(res1.uniforms).toEqual([]);

            const node2 = parse('3.14');
            const res2 = compileGLSL(node2, false);
            expect(res2.glsl).toBe('3.14');
        });

        it('should compile coordinate symbols and mathematical constants', () => {
            const node = parse('x + y * e + pi');
            const res = compileGLSL(node, false);
            expect(res.glsl).toBe('((x + (y * 2.718281828459045)) + 3.141592653589793)');
            expect(res.uniforms).toEqual([]);
        });

        it('should compile unknown variables as uniforms', () => {
            const node = parse('k * x + offset');
            const res = compileGLSL(node, false);
            expect(res.glsl).toBe('((k * x) + offset)');
            expect(res.uniforms).toContain('k');
            expect(res.uniforms).toContain('offset');
        });

        it('should compile logical operators and modulo', () => {
            const nodeAnd = parse('x > 0 and y < 1');
            expect(compileGLSL(nodeAnd).glsl).toBe('((x > 0.0) && (y < 1.0))');

            const nodeOr = parse('x < -1 or y > 5');
            expect(compileGLSL(nodeOr).glsl).toBe('((x < -1.0) || (y > 5.0))');

            const nodeMod = parse('x % 2');
            expect(compileGLSL(nodeMod).glsl).toBe('mod(x, 2.0)');
        });

        it('should compile ternary conditionals', () => {
            const node = parse('x > 0 ? sin(x) : cos(x)');
            const res = compileGLSL(node, false);
            expect(res.glsl).toBe('( ((x > 0.0)) ? (sin(x)) : (cos(x)) )');
        });

        it('should compile supported math functions', () => {
            const node = parse('sqrt(abs(min(x, 10)))');
            expect(compileGLSL(node).glsl).toBe('sqrt(abs(min(x, 10.0)))');
        });

        it('should map log10 to log2 formula', () => {
            const node = parse('log10(x)');
            expect(compileGLSL(node).glsl).toBe('(log2(x) * 0.30102999566)');
        });
    });

    describe('Complex math mode', () => {
        it('should compile constants to vec2 representations', () => {
            const node = parse('2.5');
            const res = compileGLSL(node, true);
            expect(res.glsl).toBe('vec2(2.5, 0.0)');
        });

        it('should compile coordinate symbols to z', () => {
            const nodeX = parse('x');
            const nodeY = parse('y');
            expect(compileGLSL(nodeX, true).glsl).toBe('z');
            expect(compileGLSL(nodeY, true).glsl).toBe('z');
        });

        it('should map imaginary unit symbol i to vec2(0, 1)', () => {
            const node = parse('i');
            expect(compileGLSL(node, true).glsl).toBe('vec2(0.0, 1.0)');
        });

        it('should compile operators to complex functions', () => {
            const nodeMul = parse('x * y');
            expect(compileGLSL(nodeMul, true).glsl).toBe('c_mul(z, z)');

            const nodeDiv = parse('x / y');
            expect(compileGLSL(nodeDiv, true).glsl).toBe('c_div(z, z)');

            const nodePow = parse('x ^ 2');
            expect(compileGLSL(nodePow, true).glsl).toBe('c_pow(z, vec2(2.0, 0.0))');
        });

        it('should compile complex math functions', () => {
            const node = parse('sin(x) + cos(x)');
            expect(compileGLSL(node, true).glsl).toBe('(c_sin(z) + c_cos(z))');
        });
    });

    describe('Error handling', () => {
        it('should throw an error for assignment nodes', () => {
            const node = parse('a = 5');
            expect(() => compileGLSL(node)).toThrow('Assignments not supported in WebGL formula');
        });

        it('should throw an error for unsupported functions', () => {
            const node = parse('unsupported_func(x)');
            expect(() => compileGLSL(node)).toThrow('Function unsupported_func not supported in WebGL');
        });
    });
});
