import { describe, it, expect } from 'vitest';
import { compileExpression } from '../../../src/core/math/evaluator';

describe('Geometry Compiler', () => {
    describe('Point constructor', () => {
        it('should compile simple point coordinates as draggable', () => {
            const compiled = compileExpression('(3, 4)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');
            expect(compiled!.isDraggable).toBe(true);
            expect(compiled!.pointData).toBeDefined();

            const pt = compiled!.pointData!({});
            expect(pt).toEqual({ x: 3, y: 4 });
        });

        it('should compile point with variable dependencies as non-draggable', () => {
            const compiled = compileExpression('(a, b * 2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');
            expect(compiled!.isDraggable).toBe(false);

            const scope = { a: 5, b: 3 };
            const pt = compiled!.pointData!(scope);
            expect(pt).toEqual({ x: 5, y: 6 });
        });

        it('should compile parametric points depending on variable t', () => {
            const compiled = compileExpression('(cos(t), sin(t))');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('parametric');
            expect(compiled!.fnParametric).toBeDefined();

            const pt1 = compiled!.fnParametric!(0, {});
            expect(pt1.x).toBeCloseTo(1);
            expect(pt1.y).toBeCloseTo(0);
        });
    });

    describe('Segment constructor', () => {
        it('should compile Segment from points in scope', () => {
            const compiled = compileExpression('Segment(A_1, B_1)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('segment');
            expect(compiled!.segmentData).toBeDefined();

            const scope = {
                A_1: { x: 1, y: 2 },
                B_1: { x: 5, y: 8 }
            };
            const seg = compiled!.segmentData!(scope);
            expect(seg).toEqual({ x1: 1, y1: 2, x2: 5, y2: 8 });
        });

        it('should handle missing points by returning null or throwing', () => {
            const compiled = compileExpression('Segment(A, B)');
            const scope = { A: { x: 1, y: 2 } }; // Missing B
            
            try {
                const seg = compiled!.segmentData!(scope);
                if (seg) expect(seg.x1).toBeNaN(); // Alternatively expect seg to be null
                else expect(seg).toBeNull();
            } catch (e: any) {
                expect(e).toBeDefined();
            }
        });
    });

    describe('Circle constructors', () => {
        it('should compile Circle with center and scalar radius', () => {
            const compiled = compileExpression('Circle(A_1, 5)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('circle');

            const scope = { A_1: [10, 20] };
            const circle = compiled!.circleData!(scope);
            expect(circle).toEqual({ cx: 10, cy: 20, r: 5 });
        });

        it('should compile Circle with center and point on boundary', () => {
            const compiled = compileExpression('Circle(A_1, B_1)');
            const scope = { A_1: [0, 0], B_1: [3, 4] };
            const circle = compiled!.circleData!(scope);
            expect(circle!.cx).toBe(0);
            expect(circle!.cy).toBe(0);
            expect(circle!.r).toBeCloseTo(5);
        });

        it('should compile Circle through three non-collinear points', () => {
            const compiled = compileExpression('Circle(A_1, B_1, C_1)');
            const scope = { A_1: [0, 1], B_1: [1, 0], C_1: [2, 1] };
            const circle = compiled!.circleData!(scope);
            expect(circle!.cx).toBeCloseTo(1);
            expect(circle!.cy).toBeCloseTo(1);
            expect(circle!.r).toBeCloseTo(1);
        });
    });

    describe('Polygon constructor', () => {
        it('should compile Polygon with variable points', () => {
            const compiled = compileExpression('Polygon(A, B, C)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('polygon');
            
            const scope = {
                A: [0, 0],
                B: [10, 0],
                C: [5, 10]
            };
            const poly = compiled!.polygonData!(scope);
            expect(poly.length).toBe(3);
            expect(poly[0]).toEqual({ x: 0, y: 0 });
            expect(poly[1]).toEqual({ x: 10, y: 0 });
        });
    });

    describe('Midpoints & Intersects', () => {
        it('should compile Midpoint of two points', () => {
            const compiled = compileExpression('Midpoint(A_1, B_1)');
            expect(compiled!.type).toBe('point');

            const scope = { A_1: [2, 4], B_1: [6, 12] };
            expect(compiled!.pointData!(scope)).toEqual({ x: 4, y: 8 });
        });

        it('should compile Midpoint of a segment', () => {
            const compiled = compileExpression('Midpoint(seg1)');
            const scope = { seg1: { x1: 2, y1: 4, x2: 6, y2: 12 } };
            expect(compiled!.pointData!(scope)).toEqual({ x: 4, y: 8 });
        });

        it('should compile Intersection of two lines', () => {
            const compiled = compileExpression('Intersect(L1, L2)');
            expect(compiled).not.toBeNull();
            expect(compiled!.type).toBe('point');
            expect(compiled!.isDraggable).toBe(false);

            // L1: y = x (implicit: -x + y = 0 => a=-1, b=1, c=0)
            // L2: y = -x + 2 (implicit: x + y - 2 = 0 => a=1, b=1, c=-2)
            const scope = {
                L1: { a: -1, b: 1, c: 0 },
                L2: { a: 1, b: 1, c: -2 }
            };
            const pt = compiled!.pointData!(scope);
            // Intersection is (1, 1)
            expect(pt.x).toBeCloseTo(1);
            expect(pt.y).toBeCloseTo(1);
        });
    });

    describe('Line constructions', () => {
        it('should compile a Line between two points', () => {
            const compiled = compileExpression('Line(A_1, B_1)');
            const scope = { A_1: [1, 2], B_1: [4, 6] };
            expect(compiled!.lineData!(scope)).toEqual({ px: 1, py: 2, dx: 3, dy: 4 });
        });

        it('should compile a Line parallel to an existing line through a point', () => {
            const compiled = compileExpression('Parallel(pt1, originalLine1)');
            const scope = { pt1: [5, 5], originalLine1: { px: 0, py: 0, dx: 2, dy: 1 } };
            expect(compiled!.lineData!(scope)).toEqual({ px: 5, py: 5, dx: 2, dy: 1 });
        });

        it('should compile a Line perpendicular to an existing line through a point', () => {
            const compiled = compileExpression('Perpendicular(pt1, originalLine1)');
            const scope = { pt1: [2, 3], originalLine1: { px: 0, py: 0, dx: 3, dy: 4 } };
            expect(compiled!.lineData!(scope)).toEqual({ px: 2, py: 3, dx: -4, dy: 3 });
        });

        it('should compile Perpendicular Bisector between two points', () => {
            const compiled = compileExpression('PerpendicularBisector(A_1, B_1)');
            const scope = { A_1: [0, 0], B_1: [6, 8] };
            const line = compiled!.lineData!(scope);
            expect(line!.px).toBe(3);
            expect(line!.py).toBe(4);
            expect(line!.dx).toBe(-8);
            expect(line!.dy).toBe(6);
        });

        it('should compile Angle Bisectors of two intersecting lines', () => {
            const compiled = compileExpression('AngleBisector(l1, l2)');
            const scope = { l1: { a: 1, b: 0, c: 0 }, l2: { a: 0, b: 1, c: 0 } };
            const bisectors = compiled!.lineData!(scope);
            expect(bisectors.length).toBe(2);
            expect(bisectors[0]).toEqual({ a: 1, b: -1, c: 0 });
            expect(bisectors[1]).toEqual({ a: 1, b: 1, c: 0 });
        });
    });

    describe('Analytical Tangents', () => {
        it('should solve tangents from a point to a circle', () => {
            const compiled = compileExpression('Tangent(pt1, circ1)');
            const scope = { pt1: [5, 0], circ1: { cx: 0, cy: 0, r: 3 } };
            const tangents = compiled!.lineData!(scope);
            expect(tangents.length).toBe(2);
            expect(tangents[0].px).toBe(5);
        });

        it('should solve tangents from a point to an ellipse', () => {
            const compiled = compileExpression('Tangent(pt1, ell1)');
            const scope = { pt1: [5, 0], ell1: { cx: 0, cy: 0, rx: 4, ry: 2 } };
            const tangents = compiled!.lineData!(scope);
            expect(tangents.length).toBe(2);
            expect(tangents[0].px).toBe(5);
        });

        it('should solve common tangents between two circles', () => {
            const compiled = compileExpression('Tangent(c1, c2)');
            const scope = { c1: { cx: -5, cy: 0, r: 2 }, c2: { cx: 5, cy: 0, r: 2 } };
            const tangents = compiled!.lineData!(scope);
            expect(tangents.length).toBe(4);
        });
    });

    describe('Conic Solver', () => {
        it('should fit a conic through 5 points and return implicit formula', () => {
            const compiled = compileExpression('Conic(A_1, B_1, C_1, D_1, E_1)');
            const scope: any = {
                A_1: [1, 0], B_1: [0, 1], C_1: [-1, 0], D_1: [0, -1], E_1: [Math.sqrt(0.5), Math.sqrt(0.5)]
            };
            expect(compiled!.fnImplicit!(1, 0, scope)).toBeCloseTo(0, 4);
            expect(compiled!.fnImplicit!(0, 1, scope)).toBeCloseTo(0, 4);
        });
    });

    describe('Complex Functions & Physics Compilers', () => {
        it('should compile Label with string extraction', () => {
            const compiled = compileExpression('Label(3, 4, "Hello")');
            expect(compiled!.type).toBe('label');
            const data = compiled!.labelData!({});
            expect(data).toEqual({ x: 3, y: 4, text: 'Hello' });
        });

        it('should compile PhysicsNode correctly', () => {
            const compiled = compileExpression('PhysicsNode("N1", 10, 20, true)');
            expect(compiled!.type).toBe('physicsNode');
            const data = compiled!.physicsData!({});
            expect(data).toEqual({ id: 'N1', x: 10, y: 20, pinned: true });
        });

        it('should compile PhysicsLink correctly', () => {
            const compiled = compileExpression('PhysicsLink("N1", "N2", 50)');
            expect(compiled!.type).toBe('physicsLink');
            const data = compiled!.physicsData!({});
            expect(data).toEqual({ nodeA: 'N1', nodeB: 'N2', length: 50 });
        });

        it('should compile VectorField and evaluate vectors', () => {
            const compiled = compileExpression('VectorField(-y, x)');
            expect(compiled!.type).toBe('vectorField');
            const vector = compiled!.vectorData!(3, 4, {});
            expect(vector).toEqual({ dx: -4, dy: 3 });
        });

        it('should compile ODE parameters', () => {
            const compiled = compileExpression('ODE(-y, x)');
            expect(compiled!.type).toBe('vectorField');
            const vector = compiled!.vectorData!(3, 4, {});
            expect(vector).toEqual({ dx: -4, dy: 3 });
        });

        it('should compile Fourier array sequences', () => {
            const compiled = compileExpression('Fourier(x_1, y_1)');
            expect(compiled!.type).toBe('fourier');
            expect(compiled!.isTraced).toBe(true);
            const scope = { x_1: [1, 2], y_1: [3, 4] };
            const data = compiled!.dataFn!(scope);
            expect(data).toEqual([{ x: 1, y: 3 }, { x: 2, y: 4 }]);
        });

        it('should compile Voronoi/Delaunay array sequences', () => {
            const vor = compileExpression('Voronoi(x_1, y_1)');
            expect(vor!.type).toBe('voronoi');
            const scope = { x_1: [1, 2], y_1: [3, 4] };
            expect(vor!.dataFn!(scope)).toEqual([{ x: 1, y: 3 }, { x: 2, y: 4 }]);
            
            const del = compileExpression('Delaunay(x_1, y_1)');
            expect(del!.type).toBe('delaunay');
            expect(del!.dataFn!(scope)).toEqual([{ x: 1, y: 3 }, { x: 2, y: 4 }]);
        });
    });
});
