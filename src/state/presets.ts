import type { Expression, CameraState } from '../core/types';
import type { Slider } from './store';

export interface Preset {
    id: string;
    title: string;
    description: string;
    gradient: string;
    expressions: Partial<Expression>[];
    camera: CameraState;
    sliders?: Record<string, Slider>;
}

export const PRESETS: Preset[] = [
    {
        id: 'advanced-geometry',
        title: 'Advanced Geometry',
        description: 'Showcases intersections between conics, tangent finding, and PointOn curve binding.',
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'A = [-4, -2]', latex: 'A = [-4, -2]', color: '#ef4444' },
            { text: 'c1 = Circle(A, 4)', latex: 'c1 = \\text{Circle}(A, 4)', color: '#3b82f6', lineWidth: 2 },
            { text: 'P = PointOn(c1, 0, 2)', latex: 'P = \\text{PointOn}(c1, 0, 2)', color: '#10b981' },
            { text: 'c2 = x^2/16 + y^2/9 - 1', latex: '\\frac{x^2}{16} + \\frac{y^2}{9} = 1', color: '#8b5cf6', lineWidth: 2 },
            { text: 'I = Intersect(c1, c2)', latex: 'I = \\text{Intersect}(c1, c2)', color: '#f59e0b' },
            { text: 'L = Line(A, P)', latex: 'L = \\text{Line}(A, P)', color: '#64748b' },
            { text: 'T = Tangent(L, c2)', latex: 'T = \\text{Tangent}(L, c2)', color: '#ec4899', lineWidth: 2 }
        ]
    },
    {
        id: 'fractal-butterfly',
        title: 'Parametric Butterfly',
        description: 'A complex fractal-like pattern generated using polar coordinates.',
        gradient: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
        camera: { x: 0, y: 0, zoom: 70 },
        expressions: [
            { text: 'r = e^(sin(theta)) - 2*cos(4*theta) + sin((2*theta - pi)/24)^5', latex: 'r = e^{\\sin(\\theta)} - 2\\cdot\\cos(4\\theta) + \\sin(\\\frac{2\\theta - \\pi}{24})^5', color: '#ff0844', lineWidth: 2 }
        ]
    },
    {
        id: 'dancing-harmonograph',
        title: 'Parametric Harmonograph',
        description: 'A pendulum animation driven by parametric equations. Control frequencies using sliders.',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        camera: { x: 0, y: 0, zoom: 150 },
        sliders: {
            a: { name: 'a', value: 2.01, min: 1, max: 5, step: 0.01, isPlaying: true, animSpeed: 1, animDir: 1 },
            b: { name: 'b', value: 3, min: 1, max: 5, step: 0.01, isPlaying: true, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: '(sin(t*a) * e^(-0.05*t), cos(t*b) * e^(-0.05*t))', latex: '(\\sin(t \\cdot a) \\cdot e^{-0.05 \\cdot t}, \\cos(t \\cdot b) \\cdot e^{-0.05 \\cdot t})', color: '#fda085', lineWidth: 2 }
        ]
    },
    {
        id: 'heartbeat',
        title: 'Implicit Heartbeat',
        description: 'A pulsating heart shape based on a classical implicit contour equation.',
        gradient: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)',
        camera: { x: 0, y: 0, zoom: 200 },
        expressions: [
            { text: '(x^2 + y^2 - 1)^3 - x^2 * y^3 = sin(t*5)*0.1', latex: '(x^2 + y^2 - 1)^3 - x^2 \\cdot y^3 = \\sin(t \\cdot 5) \\cdot 0.1', color: '#ff758c', lineWidth: 3 }
        ]
    },
    {
        id: 'matrix-transform',
        title: 'Linear Transformations',
        description: 'Applies a global 2D linear transformation matrix to geometric coordinates dynamically using sliders.',
        gradient: 'linear-gradient(135deg, #11ffbd 0%, #aafec6 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        sliders: {
            a: { name: 'a', value: 1.0, min: -3, max: 3, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 },
            c: { name: 'c', value: 0.0, min: -3, max: 3, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 },
            d: { name: 'd', value: 1.0, min: -3, max: 3, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'b = 0.5 * sin(t)', latex: 'b = 0.5 \\cdot \\sin(t)', color: '#64748b' },
            { text: 'M = [[a, b], [c, d]]', latex: 'M = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', color: '#10b981' },
            { text: 'Transform(M)', latex: '\\text{Transform}(M)', color: '#ef4444' },
            { text: 'P1 = Polygon((-2, -2), (2, -2), (2, 2), (-2, 2))', latex: 'P1 = \\text{Polygon}((-2, -2), (2, -2), (2, 2), (-2, 2))', color: '#3b82f6', lineWidth: 2 }
        ]
    },
    {
        id: 'calculus-composition',
        title: 'Calculus & Composition',
        description: 'Demonstrates function nesting h(x) = f(g(x)), symbolic derivation h\'(x), and numerical definite area integration.',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        camera: { x: 0, y: 0, zoom: 35 },
        expressions: [
            { text: 'f(x) = sin(x)', latex: 'f(x) = \\sin(x)', color: '#3b82f6', lineWidth: 2 },
            { text: 'g(x) = x^2 / 2', latex: 'g(x) = \\\frac{x^2}{2}', color: '#10b981', lineWidth: 2 },
            { text: 'h(x) = f(g(x))', latex: 'h(x) = f(g(x))', color: '#8b5cf6', lineWidth: 2.5 },
            { text: 'y = h\'(x)', latex: 'y = h\'(x)', color: '#ef4444', lineWidth: 2 },
            { text: 'area = int(h(x), -3, 3)', latex: '\\text{area} = \\int_{-3}^{3} h(x) \\, dx', color: '#f59e0b', lineWidth: 1.5 }
        ]
    },
    {
        id: 'inequality-systems',
        title: 'Sets & Inequalities',
        description: 'Intersection of sets and mathematical regions rendered via WebGL constraints.',
        gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'y > x^2 - 3', latex: 'y > x^2 - 3', color: '#ef4444', lineWidth: 1.5 },
            { text: 'y < 3 - x^2', latex: 'y < 3 - x^2', color: '#3b82f6', lineWidth: 1.5 },
            { text: 'x^2 + y^2 < 5', latex: 'x^2 + y^2 < 5', color: '#10b981', lineWidth: 1.5 }
        ]
    },
    {
        id: 'statistical-regression',
        title: 'Statistical Regression',
        description: 'Dynamic data fitting and correlation solving using ~ syntax.',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            {
                text: '',
                latex: '',
                type: 'table',
                xCol: 'x_1',
                yCol: 'y_1',
                color: '#3498db',
                points: [
                    { x: -3, y: 9.1 },
                    { x: -1, y: 1.2 },
                    { x: 0, y: -0.1 },
                    { x: 1, y: 0.9 },
                    { x: 3, y: 8.8 }
                ]
            },
            {
                text: 'y_1 ~ a*x_1^2 + b*x_1 + c', 
                latex: 'y_1 \\sim a\\cdot x_1^2 + b\\cdot x_1 + c', 
                color: '#e74c3c'
            }
        ]
    },
    {
        id: 'euler-line',
        title: 'Euler Line Construction',
        description: 'Demonstrates the collinearity of the circumcenter, centroid, and orthocenter in any triangle.',
        gradient: 'linear-gradient(135deg, #42a5f5 0%, #0077c2 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'A = (-4, -2)', latex: 'A = (-4, -2)', color: '#ef4444' },
            { text: 'B = (2, 4)', latex: 'B = (2, 4)', color: '#ef4444' },
            { text: 'C = (4, -3)', latex: 'C = (4, -3)', color: '#ef4444' },
            { text: 's_{ab} = Segment(A, B)', latex: 's_{ab} = \\text{Segment}(A, B)', color: '#64748b' },
            { text: 's_{bc} = Segment(B, C)', latex: 's_{bc} = \\text{Segment}(B, C)', color: '#64748b' },
            { text: 's_{ca} = Segment(C, A)', latex: 's_{ca} = \\text{Segment}(C, A)', color: '#64748b' },
            { text: 'pb_{ab} = PerpendicularBisector(s_{ab})', latex: 'pb_{ab} = \\text{PerpendicularBisector}(s_{ab})', color: '#10b981' },
            { text: 'pb_{bc} = PerpendicularBisector(s_{bc})', latex: 'pb_{bc} = \\text{PerpendicularBisector}(s_{bc})', color: '#10b981' },
            { text: 'O = Intersect(pb_{ab}, pb_{bc})', latex: 'O = \\text{Intersect}(pb_{ab}, pb_{bc})', color: '#3b82f6' },
            { text: 'M_{bc} = Midpoint(s_{bc})', latex: 'M_{bc} = \\text{Midpoint}(s_{bc})', color: '#64748b' },
            { text: 'median1 = Line(A, M_{bc})', latex: 'median1 = \\text{Line}(A, M_{bc})', color: '#8b5cf6' },
            { text: 'M_{ca} = Midpoint(s_{ca})', latex: 'M_{ca} = \\text{Midpoint}(s_{ca})', color: '#64748b' },
            { text: 'median2 = Line(B, M_{ca})', latex: 'median2 = \\text{Line}(B, M_{ca})', color: '#8b5cf6' },
            { text: 'G = Intersect(median1, median2)', latex: 'G = \\text{Intersect}(median1, median2)', color: '#3b82f6' },
            { text: 'alt1 = Perpendicular(A, s_{bc})', latex: 'alt1 = \\text{Perpendicular}(A, s_{bc})', color: '#ec4899' },
            { text: 'alt2 = Perpendicular(B, s_{ca})', latex: 'alt2 = \\text{Perpendicular}(B, s_{ca})', color: '#ec4899' },
            { text: 'H = Intersect(alt1, alt2)', latex: 'H = \\text{Intersect}(alt1, alt2)', color: '#3b82f6' },
            { text: 'eulerLine = Line(O, G)', latex: 'eulerLine = \\text{Line}(O, G)', color: '#f59e0b', lineWidth: 3 }
        ]
    },
    {
        id: 'fourier-epicycles',
        title: 'Fourier Epicycles',
        description: 'Draws a path using Fourier series epicycles generated from points.',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            {
                text: '',
                latex: '',
                type: 'table',
                xCol: 'x_1',
                yCol: 'y_1',
                color: '#3498db',
                points: [
                    { x: -3, y: -4 },
                    { x: -3, y: 5 },
                    { x: 2, y: 3 },
                    { x: 3, y: -3 }
                ]
            },
            { text: 'Fourier(x_1, y_1)', latex: '\\text{Fourier}(x_1, y_1)', color: '#8b5cf6', lineWidth: 2 }
        ]
    },
    {
        id: 'verlet-pendulum',
        title: 'Verlet Kinematics',
        description: 'Coupled pendulum mechanism simulated using the discrete Verlet constraints engine.',
        gradient: 'linear-gradient(135deg, #fad0c4 0%, #ffd1ff 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'PhysicsNode("Pivot", 0, 5, true)', latex: '\\text{PhysicsNode}("Pivot", 0, 5, \\text{true})', color: '#d63031' },
            { text: 'PhysicsNode("Mass1", 2, 2)', latex: '\\text{PhysicsNode}("Mass1", 2, 2)', color: '#0984e3' },
            { text: 'PhysicsNode("Mass2", -2, -2)', latex: '\\text{PhysicsNode}("Mass2", -2, -2)', color: '#0984e3' },
            { text: 'PhysicsLink("Pivot", "Mass1", 5)', latex: '\\text{PhysicsLink}("Pivot", "Mass1", 5)', color: '#636e72', lineWidth: 2 },
            { text: 'PhysicsLink("Mass1", "Mass2", 4)', latex: '\\text{PhysicsLink}("Mass1", "Mass2", 4)', color: '#636e72', lineWidth: 2 }
        ]
    },
    {
        id: 'hydrodynamics',
        title: 'Fluid Vector Field',
        description: 'Advection visualization illustrating sink/source hydrodynamic curl simulation using VectorField().',
        gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'VectorField(sin(y) - cos(x), -sin(x) - cos(y))', latex: '\\text{VectorField}(\\sin(y) - \\cos(x), -\\sin(x) - \\cos(y))', color: '#0984e3', lineWidth: 1.5 }
        ]
    },
    {
        id: 'fourier-series',
        title: 'Fourier Square Wave',
        description: 'Approximates a square wave by summing the first few odd harmonics of a sine wave.',
        gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        sliders: {
            n: { name: 'n', value: 3, min: 1, max: 15, step: 2, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'f_1(x) = sin(x)', latex: 'f_1(x) = \\sin(x)', color: '#3b82f6', lineWidth: 1 },
            { text: 'f_3(x) = f_1(x) + sin(3*x)/3', latex: 'f_3(x) = f_1(x) + \\\frac{\\sin(3x)}{3}', color: '#10b981', lineWidth: 1.5 },
            { text: 'f_5(x) = f_3(x) + sin(5*x)/5', latex: 'f_5(x) = f_3(x) + \\\frac{\\sin(5x)}{5}', color: '#f59e0b', lineWidth: 2 },
            { text: 'y = f_5(x) + sin(7*x)/7', latex: 'y = f_5(x) + \\\frac{\\sin(7x)}{7}', color: '#ef4444', lineWidth: 3 }
        ]
    },
    {
        id: 'lotka-volterra',
        title: 'Lotka-Volterra ODE System',
        description: 'Predator-prey dynamic model solved using numeric ODE integration. Place a spawn point to see the phase portrait.',
        gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        camera: { x: 5, y: 5, zoom: 30 },
        expressions: [
            { text: 'alpha = 2/3', latex: '\\alpha = 2/3', color: '#64748b' },
            { text: 'beta = 4/3', latex: '\\beta = 4/3', color: '#64748b' },
            { text: 'gamma = 1', latex: '\\gamma = 1', color: '#64748b' },
            { text: 'delta = 1', latex: '\\delta = 1', color: '#64748b' },
            { text: 'dx/dt = alpha*x - beta*x*y', latex: '\\\frac{dx}{dt} = \\alpha x - \\beta x y', color: '#3b82f6' },
            { text: 'dy/dt = delta*x*y - gamma*y', latex: '\\\frac{dy}{dt} = \\delta x y - \\gamma y', color: '#ef4444' },
            { text: 'ODE(dx/dt, dy/dt)', latex: '\\text{ODE}(\\\frac{dx}{dt}, \\\frac{dy}{dt})', color: '#10b981', lineWidth: 2 }
        ]
    },

    {
        id: 'conic-sections',
        title: 'Dynamic Conic Sections',
        description: 'A cone sliced by a dynamic plane, resulting in hyperbola, parabola, and ellipse shapes.',
        gradient: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        camera: { x: 0, y: 0, zoom: 50 },
        sliders: {
            k: { name: 'k', value: 0.5, min: 0, max: 2, step: 0.05, isPlaying: true, animSpeed: 0.5, animDir: 1 }
        },
        expressions: [
            { text: 'x^2 + y^2 - k*x = 1', latex: 'x^2 + y^2 - k\\cdot x = 1', color: '#ec4899', lineWidth: 3 }
        ]
    },
    {
        id: 'physics-cloth',
        title: 'Verlet Cloth Simulation',
        description: 'A 2D cloth lattice simulated via physics constraints. PhysicsCloth(startX, startY, rows, cols, spacing, i1, j1, i2, j2...).',
        gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'PhysicsCloth(-8, 10, 5, 8, 2, 0, 0, 1, 3)', latex: '\\text{PhysicsCloth}(-8, 10, 5, 8, 2, 0, 0, 1, 3)', color: '#e74c3c', lineWidth: 2 }
        ]
    },
    {
        id: 'spirograph',
        title: 'Parametric Spirograph',
        description: 'Hypotrochoid patterns generated by tracing a point attached to a circle rolling inside another circle.',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        sliders: {
            R: { name: 'R', value: 5, min: 1, max: 10, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 },
            r: { name: 'r', value: 2.1, min: 0.1, max: 5, step: 0.1, isPlaying: true, animSpeed: 0.5, animDir: 1 },
            d: { name: 'd', value: 3.5, min: 0, max: 10, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: '((R-r)*cos(t) + d*cos((R-r)/r*t), (R-r)*sin(t) - d*sin((R-r)/r*t))', latex: '((R-r)\\cos(t) + d\\cos(\\\frac{R-r}{r}t), (R-r)\\sin(t) - d\\sin(\\\frac{R-r}{r}t))', color: '#8b5cf6', lineWidth: 2 }
        ]
    },
    {
        id: 'tessellation',
        title: 'Voronoi & Delaunay',
        description: 'Generates Voronoi cells and Delaunay triangulation from a scattered dataset. Try dragging the points!',
        gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            {
                text: '', latex: '', type: 'table', xCol: 'x_1', yCol: 'y_1', color: '#10b981',
                points: [
                    { x: -5, y: -4 }, { x: -2, y: 6 }, { x: 4, y: 5 },
                    { x: 6, y: -2 }, { x: 0, y: 0 }, { x: -8, y: 2 },
                    { x: 3, y: -6 }
                ]
            },
            { text: 'Voronoi(x_1, y_1)', latex: '\\text{Voronoi}(x_1, y_1)', color: '#3b82f6', lineWidth: 1.5 },
            { text: 'Delaunay(x_1, y_1)', latex: '\\text{Delaunay}(x_1, y_1)', color: '#f59e0b', lineWidth: 1.5 }
        ]
    },
    {
        id: 'van-der-pol',
        title: 'Van der Pol Oscillator',
        description: 'Phase portrait of the Van der Pol non-linear oscillator, demonstrating limit cycle behavior.',
        gradient: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        sliders: {
            mu: { name: 'mu', value: 1.5, min: 0, max: 5, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'dx/dt = y', latex: '\\\frac{dx}{dt} = y', color: '#3b82f6' },
            { text: 'dy/dt = mu * (1 - x^2) * y - x', latex: '\\\frac{dy}{dt} = \\mu (1 - x^2) y - x', color: '#ef4444' },
            { text: 'ODE(dx/dt, dy/dt)', latex: '\\text{ODE}(\\\frac{dx}{dt}, \\\frac{dy}{dt})', color: '#10b981', lineWidth: 2 }
        ]
    },
    {
        id: 'rose-curve',
        title: 'Mathematical Rose',
        description: 'A beautiful rhodonea curve generated in polar coordinates.',
        gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        camera: { x: 0, y: 0, zoom: 60 },
        sliders: {
            k: { name: 'k', value: 5, min: 1, max: 20, step: 1, isPlaying: true, animSpeed: 0.2, animDir: 1 }
        },
        expressions: [
            { text: 'r = 5 * cos(k * theta)', latex: 'r = 5 \\cdot \\cos(k \\cdot \\theta)', color: '#ec4899', lineWidth: 2 }
        ]
    },
    {
        id: 'taylor-series',
        title: 'Taylor Approximation',
        description: 'Polynomial approximation of the sine function using Taylor series expansion.',
        gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'f(x) = sin(x)', latex: 'f(x) = \\sin(x)', color: '#3b82f6', lineWidth: 2 },
            { text: 'T_1(x) = x', latex: 'T_1(x) = x', color: '#94a3b8', lineWidth: 1 },
            { text: 'T_3(x) = T_1(x) - x^3 / 6', latex: 'T_3(x) = T_1(x) - \\\frac{x^3}{6}', color: '#cbd5e1', lineWidth: 1 },
            { text: 'T_5(x) = T_3(x) + x^5 / 120', latex: 'T_5(x) = T_3(x) + \\\frac{x^5}{120}', color: '#10b981', lineWidth: 2 }
        ]
    }
];
