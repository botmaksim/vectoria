import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../src/core/math/evaluator';

describe('Geometry Compiler', () => {
    describe('Point constructor', () => {
        it('should compile simple point coordinates', () => {
            const compiled = compileExpression('(3, 4)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');
            expect(compiled!.isDraggable).toBe(true);
            expect(compiled!.pointData).toBeDefined();

            const pt = compiled!.pointData!({});
            expect(pt).toEqual({ x: 3, y: 4 });
        });

        it('should compile parametric points depending on variable t', () => {
            const compiled = compileExpression('(cos(t), sin(t))');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('parametric');
            expect(compiled!.fnParametric).toBeDefined();

            const pt1 = compiled!.fnParametric!(0, {});
            expect(pt1.x).toBeCloseTo(1);
            expect(pt1.y).toBeCloseTo(0);

            const pt2 = compiled!.fnParametric!(Math.PI / 2, {});
            expect(pt2.x).toBeCloseTo(0);
            expect(pt2.y).toBeCloseTo(1);
        });
    });

    describe('Segment constructor', () => {
        it('should compile Segment from points in scope', () => {
            const compiled = compileExpression('Segment(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('segment');
            expect(compiled!.segmentData).toBeDefined();

            // Point A_1 and B_1 represented as objects of the same type
            const scope = {
                A_1: { x: 1, y: 2 },
                B_1: { x: 5, y: 8 }
            };
            const seg = compiled!.segmentData!(scope);
            expect(seg).toEqual({ x1: 1, y1: 2, x2: 5, y2: 8 });
        });
    });

    describe('Circle constructors', () => {
        it('should compile Circle with center and scalar radius', () => {
            const compiled = compileExpression('Circle(A_1, 5)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('circle');
            expect(compiled!.circleData).toBeDefined();

            const scope = { A_1: [10, 20] };
            const circle = compiled!.circleData!(scope);
            expect(circle).toEqual({ cx: 10, cy: 20, r: 5 });
        });

        it('should compile Circle with center and point on boundary', () => {
            const compiled = compileExpression('Circle(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('circle');

            const scope = { A_1: [0, 0], B_1: [3, 4] };
            const circle = compiled!.circleData!(scope);
            expect(circle!.cx).toBe(0);
            expect(circle!.cy).toBe(0);
            expect(circle!.r).toBeCloseTo(5);
        });

        it('should compile Circle through three non-collinear points', () => {
            const compiled = compileExpression('Circle(A_1, B_1, C_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('circle');

            const scope = {
                A_1: [0, 1],
                B_1: [1, 0],
                C_1: [2, 1]
            };
            const circle = compiled!.circleData!(scope);
            expect(circle!.cx).toBeCloseTo(1);
            expect(circle!.cy).toBeCloseTo(1);
            expect(circle!.r).toBeCloseTo(1);
        });
    });

    describe('Midpoints', () => {
        it('should compile Midpoint of two points', () => {
            const compiled = compileExpression('Midpoint(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');

            const scope = { A_1: [2, 4], B_1: [6, 12] };
            const mid = compiled!.pointData!(scope);
            expect(mid).toEqual({ x: 4, y: 8 });
        });

        it('should compile Midpoint of a segment', () => {
            const compiled = compileExpression('Midpoint(seg1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');

            const scope = {
                seg1: { x1: 2, y1: 4, x2: 6, y2: 12 }
            };
            const mid = compiled!.pointData!(scope);
            expect(mid).toEqual({ x: 4, y: 8 });
        });
    });

    describe('Line compilation', () => {
        it('should compile a Line between two points', () => {
            const compiled = compileExpression('Line(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            const scope = { A_1: [1, 2], B_1: [4, 6] };
            const line = compiled!.lineData!(scope);
            expect(line).toEqual({ px: 1, py: 2, dx: 3, dy: 4 });
        });
    });

    describe('Parallel lines', () => {
        it('should compile a Line parallel to an existing line through a point', () => {
            const compiled = compileExpression('Parallel(pt1, originalLine1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            const scope = {
                pt1: [5, 5],
                originalLine1: { px: 0, py: 0, dx: 2, dy: 1 }
            };
            const line = compiled!.lineData!(scope);
            expect(line).toEqual({ px: 5, py: 5, dx: 2, dy: 1 });
        });
    });

    describe('Perpendicular lines', () => {
        it('should compile a Line perpendicular to an existing line/segment through a point', () => {
            const compiled = compileExpression('Perpendicular(pt1, originalLine1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            const scope = {
                pt1: [2, 3],
                originalLine1: { px: 0, py: 0, dx: 3, dy: 4 }
            };
            const line = compiled!.lineData!(scope);
            expect(line).toEqual({ px: 2, py: 3, dx: -4, dy: 3 });
        });
    });

    describe('Perpendicular Bisector', () => {
        it('should compile perpendicular bisector between two points', () => {
            const compiled = compileExpression('PerpendicularBisector(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            const scope = { A_1: [0, 0], B_1: [6, 8] };
            const line = compiled!.lineData!(scope);
            // Midpoint should be (3, 4). Vector is (6, 8), so perp vector is (-8, 6)
            expect(line!.px).toBe(3);
            expect(line!.py).toBe(4);
            expect(line!.dx).toBe(-8);
            expect(line!.dy).toBe(6);
        });
    });

    describe('Angle Bisectors', () => {
        it('should compile double bisectors of two intersecting lines', () => {
            const compiled = compileExpression('AngleBisector(l1, l2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            // l1: x = 0 (vertical) -> a=1, b=0, c=0
            // l2: y = 0 (horizontal) -> a=0, b=1, c=0
            const scope = {
                l1: { a: 1, b: 0, c: 0 },
                l2: { a: 0, b: 1, c: 0 }
            };
            const bisectors = compiled!.lineData!(scope);
            expect(Array.isArray(bisectors)).toBe(true);
            expect(bisectors.length).toBe(2);

            // Bisectors should represent y = x and y = -x
            // First: a1 - a2 = 1 - 0 = 1, b1 - b2 = 0 - 1 = -1 -> x - y = 0
            expect(bisectors[0]).toEqual({ a: 1, b: -1, c: 0 });
            // Second: a1 + a2 = 1 + 0 = 1, b1 + b2 = 0 + 1 = 1 -> x + y = 0
            expect(bisectors[1]).toEqual({ a: 1, b: 1, c: 0 });
        });
    });

    describe('Analytical Tangents', () => {
        it('should solve tangents from a point to a circle', () => {
            const compiled = compileExpression('Tangent(pt1, circ1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            // Point pt1 = (5, 0). Circle circ1 centered at (0, 0) with radius 3.
            const scope = {
                pt1: [5, 0],
                circ1: { cx: 0, cy: 0, r: 3 }
            };
            const tangents = compiled!.lineData!(scope);
            expect(Array.isArray(tangents)).toBe(true);
            expect(tangents.length).toBe(2);

            // Tangent vectors should start at pt1 (5, 0)
            expect(tangents[0].px).toBe(5);
            expect(tangents[0].py).toBe(0);
        });

        it('should solve tangents from a point to an ellipse', () => {
            const compiled = compileExpression('Tangent(pt1, ell1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            const scope = {
                pt1: [5, 0],
                ell1: { cx: 0, cy: 0, rx: 4, ry: 2 }
            };
            const tangents = compiled!.lineData!(scope);
            expect(Array.isArray(tangents)).toBe(true);
            expect(tangents.length).toBe(2);
            expect(tangents[0].px).toBe(5);
            expect(tangents[0].py).toBe(0);
        });

        it('should solve tangents from a point to a mathematical function curve', () => {
            const compiled = compileExpression('Tangent(pt1, f)');
            expect(compiled).not.toBeNull();

            // Point pt1 = (2, 0). f(x) = x^2.
            const scope = {
                pt1: [2, 0],
                f: (x: number) => x * x
            };
            const tangents = compiled!.lineData!(scope);
            expect(Array.isArray(tangents)).toBe(true);
            expect(tangents.length).toBeGreaterThan(0);
        });

        it('should solve common tangents between two circles', () => {
            const compiled = compileExpression('Tangent(c1, c2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('line');

            // Circle c1 at (-5, 0) r=2. Circle c2 at (5, 0) r=2.
            const scope = {
                c1: { cx: -5, cy: 0, r: 2 },
                c2: { cx: 5, cy: 0, r: 2 }
            };
            const tangents = compiled!.lineData!(scope);
            // With equal radii: 2 external tangents (parallel lines) and 2 internal tangents
            expect(Array.isArray(tangents)).toBe(true);
            expect(tangents.length).toBe(4);
        });
    });

    describe('Conic Solver', () => {
        it('should fit a conic through 5 points and return implicit formula', () => {
            // Conic(A_1, B_1, C_1, D_1, E_1)
            const compiled = compileExpression('Conic(A_1, B_1, C_1, D_1, E_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('implicit');
            expect(compiled!.fnImplicit).toBeDefined();

            // 5 points on the unit circle: x^2 + y^2 = 1
            const scope: any = {
                A_1: [1, 0],
                B_1: [0, 1],
                C_1: [-1, 0],
                D_1: [0, -1],
                E_1: [Math.sqrt(0.5), Math.sqrt(0.5)]
            };

            // Let's verify fnImplicit is close to 0 at point A_1
            expect(compiled!.fnImplicit!(1, 0, scope)).toBeCloseTo(0, 4);
            // And close to 0 at point B_1
            expect(compiled!.fnImplicit!(0, 1, scope)).toBeCloseTo(0, 4);
        });
    });
});
