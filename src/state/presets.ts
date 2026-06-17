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
        id: 'neon-ripple',
        title: 'Neon Ripple',
        description: 'Diverging waves animated over time using the variable t.',
        gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'sin(10 * sqrt(x^2 + y^2) - t*5) = 0', latex: '\\sin(10 \\cdot \\sqrt{x^2 + y^2} - t \\cdot 5) = 0', color: '#00f2fe', lineWidth: 3 }
        ]
    },
    {
        id: 'fractal-butterfly',
        title: 'Parametric Butterfly',
        description: 'A complex fractal-like pattern generated using polar coordinates.',
        gradient: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
        camera: { x: 0, y: 0, zoom: 70 },
        expressions: [
            { text: 'r = e^(sin(theta)) - 2*cos(4*theta) + sin((2*theta - pi)/24)^5', latex: 'r = e^{\\sin(\\theta)} - 2\\cdot\\cos(4\\theta) + \\sin(\\frac{2\\theta - \\pi}{24})^5', color: '#ff0844', lineWidth: 2 }
        ]
    },
    {
        id: 'moire-illusion',
        title: 'Moiré Illusion',
        description: 'An optical illusion of interference created by an implicit function.',
        gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
        camera: { x: 0, y: 0, zoom: 80 },
        expressions: [
            { text: 'sin(x^2 + y^2) = cos(x*y)', latex: '\\sin(x^2 + y^2) = \\cos(x \\cdot y)', color: '#30cfd0', lineWidth: 1 }
        ]
    },
    {
        id: 'dancing-harmonograph',
        title: 'Harmonograph',
        description: 'A pendulum animation driven by parametric equations. Control frequencies using sliders a and b.',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        camera: { x: 0, y: 0, zoom: 150 },
        sliders: {
            a: { name: 'a', value: 2.01, min: 1, max: 5, step: 0.01, isPlaying: false, animSpeed: 1, animDir: 1 },
            b: { name: 'b', value: 3, min: 1, max: 5, step: 0.01, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: '(sin(t*a) * e^(-0.05*t), cos(t*b) * e^(-0.05*t))', latex: '(\\sin(t \\cdot a) \\cdot e^{-0.05 \\cdot t}, \\cos(t \\cdot b) \\cdot e^{-0.05 \\cdot t})', color: '#fda085', lineWidth: 2 }
        ]
    },
    {
        id: 'heartbeat',
        title: 'Heartbeat',
        description: 'A pulsating heart shape based on a classical contour equation.',
        gradient: 'linear-gradient(135deg, #ff758c 0%, #ff7eb3 100%)',
        camera: { x: 0, y: 0, zoom: 200 },
        expressions: [
            { text: '(x^2 + y^2 - 1)^3 - x^2 * y^3 = sin(t*5)*0.1', latex: '(x^2 + y^2 - 1)^3 - x^2 \\cdot y^3 = \\sin(t \\cdot 5) \\cdot 0.1', color: '#ff758c', lineWidth: 3 }
        ]
    },
    {
        id: 'hydrodynamics',
        title: 'Fluid Vector Field',
        description: 'Advection visualization illustrating sink/source hydrodynamic curl simulation.',
        gradient: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'VectorField(sin(y) - cos(x), -sin(x) - cos(y))', latex: '\\text{VectorField}(\\sin(y) - \\cos(x), -\\sin(x) - \\cos(y))', color: '#0984e3', lineWidth: 1.5 }
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
        id: 'matrix-transform',
        title: 'Matrix Transformations',
        description: 'Applies a global 2D linear transformation matrix [[a, b], [c, d]] to coordinates dynamically using sliders.',
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
            { text: 'c1 = Circle((0, 0), 3)', latex: 'c1 = \\text{Circle}((0, 0), 3)', color: '#3b82f6', lineWidth: 3 },
            { text: 's1 = Segment((-3, -3), (3, 3))', latex: 's1 = \\text{Segment}((-3, -3), (3, 3))', color: '#8b5cf6', lineWidth: 2 }
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
            { text: 'g(x) = x^2 / 2', latex: 'g(x) = \\frac{x^2}{2}', color: '#10b981', lineWidth: 2 },
            { text: 'h(x) = f(g(x))', latex: 'h(x) = f(g(x))', color: '#8b5cf6', lineWidth: 2.5 },
            { text: 'y = h\'(x)', latex: 'y = h\'(x)', color: '#ef4444', lineWidth: 2 },
            { text: 'area = int(h(x), -3, 3)', latex: '\\text{area} = \\int_{-3}^{3} h(x) \\, dx', color: '#f59e0b', lineWidth: 1.5 }
        ]
    },
    {
        id: 'inequality-systems',
        title: 'Inequality Regions',
        description: 'Renders systems of mathematical inequalities and boundary constraints using WebGL shaders.',
        gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'y > x^2 - 3', latex: 'y > x^2 - 3', color: '#ef4444', lineWidth: 1.5 },
            { text: 'y < 3 - x^2', latex: 'y < 3 - x^2', color: '#3b82f6', lineWidth: 1.5 },
            { text: 'x^2 + y^2 < 5', latex: 'x^2 + y^2 < 5', color: '#10b981', lineWidth: 1.5 }
        ]
    },
    {
        id: 'fourier-epicycles',
        title: 'Fourier Epicycles',
        description: 'Mathematical tracing using the Discrete Fourier Transform over structured data arrays.',
        gradient: 'linear-gradient(135deg, #c3cfe2 0%, #c3cfe2 100%)',
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
                    { x: -5, y: -2 },
                    { x: -2, y: 4 },
                    { x: 2, y: 4 },
                    { x: 5, y: -2 },
                    { x: 0, y: -5 }
                ]
            },
            {
                text: 'Trace(Fourier(x_1, y_1))', 
                latex: '\\text{Trace}(\\text{Fourier}(x_1, y_1))', 
                color: '#e74c3c'
            }
        ]
    },
    {
        id: 'euler-line',
        title: 'Euler Line',
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
        id: 'circle-tangents',
        title: 'Circle Tangents',
        description: 'Constructs the two tangent lines from an external point to a circle.',
        gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        camera: { x: 0, y: 0, zoom: 45 },
        expressions: [
            { text: 'O = (0, 0)', latex: 'O = (0, 0)', color: '#ef4444' },
            { text: 'B = (3, 0)', latex: 'B = (3, 0)', color: '#ef4444' },
            { text: 'c1 = Circle(O, B)', latex: 'c1 = \\text{Circle}(O, B)', color: '#3b82f6' },
            { text: 'A = (-6, 2)', latex: 'A = (-6, 2)', color: '#ef4444' },
            { text: 'tangents = Tangent(A, c1)', latex: 'tangents = \\text{Tangent}(A, c1)', color: '#10b981', lineWidth: 2 }
        ]
    },
    {
        id: 'conic-bisectors',
        title: 'Conic & Bisectors',
        description: 'Fits a conic section through 5 draggable points and shows the angle bisectors between two lines.',
        gradient: 'linear-gradient(135deg, #da22ff 0%, #9733ee 100%)',
        camera: { x: 0, y: 0, zoom: 45 },
        expressions: [
            { text: 'A = (-3, 2)', latex: 'A = (-3, 2)', color: '#ef4444' },
            { text: 'B = (-1, 4)', latex: 'B = (-1, 4)', color: '#ef4444' },
            { text: 'C = (2, 3)', latex: 'C = (2, 3)', color: '#ef4444' },
            { text: 'D = (4, -1)', latex: 'D = (4, -1)', color: '#ef4444' },
            { text: 'E = (-2, -3)', latex: 'E = (-2, -3)', color: '#ef4444' },
            { text: 'conic1 = Conic(A, B, C, D, E)', latex: 'conic1 = \\text{Conic}(A, B, C, D, E)', color: '#8b5cf6', lineWidth: 2 },
            { text: 'P = (3, 2)', latex: 'P = (3, 2)', color: '#ef4444' },
            { text: 'L1 = Line(P, A)', latex: 'L1 = \\text{Line}(P, A)', color: '#64748b' },
            { text: 'L2 = Line(P, B)', latex: 'L2 = \\text{Line}(P, B)', color: '#64748b' },
            { text: 'bisectors = AngleBisector(L1, L2)', latex: 'bisectors = \\text{AngleBisector}(L1, L2)', color: '#10b981', lineWidth: 2 }
        ]
    },
    {
        id: 'space-partition',
        title: 'Voronoi & Delaunay Partition',
        description: 'Simulates spatial geometric separation using Dual algorithms across randomly distributed coordinate structures.',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            {
                text: '',
                latex: '',
                type: 'table',
                xCol: 'x_1',
                yCol: 'y_1',
                color: '#e67e22',
                points: Array.from({length: 12}, () => ({ x: (Math.random() - 0.5) * 16, y: (Math.random() - 0.5) * 12 }))
            },
            {
                text: 'Voronoi(x_1, y_1)', 
                latex: '\\text{Voronoi}(x_1, y_1)', 
                color: '#e74c3c'
            },
            {
                text: 'Delaunay(x_1, y_1)', 
                latex: '\\text{Delaunay}(x_1, y_1)', 
                color: '#3498db'
            }
        ]
    },
    {
        id: 'julia-fractal',
        title: 'Julia Set',
        description: 'Interactive Julia Set fractal shader controlled dynamically by complex coordinates (cx, cy).',
        gradient: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)',
        camera: { x: 0, y: 0, zoom: 35 },
        sliders: {
            cx: { name: 'cx', value: -0.7, min: -2.0, max: 2.0, step: 0.01, isPlaying: true, animSpeed: 0.1, animDir: 1 },
            cy: { name: 'cy', value: 0.27015, min: -2.0, max: 2.0, step: 0.01, isPlaying: true, animSpeed: 0.08, animDir: 1 }
        },
        expressions: [
            { text: 'Julia(cx, cy, 120)', latex: '\\text{Julia}(c_x, c_y, 120)', color: '#fd79a8' }
        ]
    },
    {
        id: 'mandelbrot-fractal',
        title: 'Mandelbrot Set',
        description: 'The iconic Mandelbrot fractal generated natively inside a high-performance WebGL shader.',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        camera: { x: -0.7, y: 0, zoom: 30 },
        expressions: [
            { text: 'Mandelbrot(150)', latex: '\\text{Mandelbrot}(150)', color: '#9b59b6' }
        ]
    },
    {
        id: 'vanderpol-oscillator',
        title: 'Van der Pol Oscillator',
        description: 'A limit cycle vector field visualizing a self-oscillatory system with a damping parameter mu.',
        gradient: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        camera: { x: 0, y: 0, zoom: 12 },
        sliders: {
            mu: { name: 'mu', value: 1.5, min: 0.1, max: 5.0, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'VectorField(y, mu * (1 - x^2) * y - x)', latex: '\\text{VectorField}(y, \\mu \\cdot (1 - x^2) \\cdot y - x)', color: '#00cec9', lineWidth: 1.5 }
        ]
    },
    {
        id: 'lotka-volterra',
        title: 'Lotka-Volterra Predator-Prey',
        description: 'Vector field simulation showing the cyclic population dynamics of prey (x) and predator (y).',
        gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
        camera: { x: 4, y: 4, zoom: 12 },
        sliders: {
            alpha: { name: 'alpha', value: 1.5, min: 0.5, max: 3.0, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 },
            beta: { name: 'beta', value: 1.0, min: 0.2, max: 2.0, step: 0.1, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'gamma = 3.0', latex: '\\gamma = 3.0', color: '#3b82f6' },
            { text: 'delta = 1.0', latex: '\\delta = 1.0', color: '#3b82f6' },
            { text: 'VectorField(x * (alpha - beta * y), y * (delta * x - gamma))', latex: '\\text{VectorField}(x(\\alpha - \\beta y), y(\\delta x - \\gamma))', color: '#1abc9c', lineWidth: 1.5 }
        ]
    },
    {
        id: 'fourier-series-square',
        title: 'Fourier Series (Square Wave)',
        description: 'Sum of harmonic sines approximating a square wave function.',
        gradient: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
        camera: { x: 0, y: 0, zoom: 40 },
        expressions: [
            { text: 'f1(x) = sin(x)', latex: 'f_1(x) = \\sin(x)', color: '#3b82f6', lineWidth: 1.5 },
            { text: 'f3(x) = f1(x) + sin(3*x)/3', latex: 'f_3(x) = f_1(x) + \\frac{\\sin(3x)}{3}', color: '#10b981', lineWidth: 1.5 },
            { text: 'f5(x) = f3(x) + sin(5*x)/5', latex: 'f_5(x) = f_3(x) + \\frac{\\sin(5x)}{5}', color: '#f59e0b', lineWidth: 1.5 },
            { text: 'f7(x) = f5(x) + sin(7*x)/7', latex: 'f_7(x) = f_5(x) + \\frac{\\sin(7x)}{7}', color: '#8b5cf6', lineWidth: 1.5 },
            { text: 'f9(x) = f7(x) + sin(9*x)/9', latex: 'f_9(x) = f_7(x) + \\frac{\\sin(9x)}{9}', color: '#ec4899', lineWidth: 3 }
        ]
    },
    {
        id: 'verlet-bridge',
        title: 'Verlet Rope Bridge',
        description: 'A multi-node suspended bridge simulation with dynamic gravity and tension links.',
        gradient: 'linear-gradient(135deg, #ff9966 0%, #ff5e62 100%)',
        camera: { x: 0, y: 0, zoom: 30 },
        expressions: [
            { text: 'PhysicsNode("AnchorLeft", -8, 4, true)', latex: '\\text{PhysicsNode}("AnchorLeft", -8, 4, \\text{true})', color: '#e74c3c' },
            { text: 'PhysicsNode("Node1", -6, 2)', latex: '\\text{PhysicsNode}("Node1", -6, 2)', color: '#3498db' },
            { text: 'PhysicsNode("Node2", -4, 0.5)', latex: '\\text{PhysicsNode}("Node2", -4, 0.5)', color: '#3498db' },
            { text: 'PhysicsNode("Node3", -2, -0.5)', latex: '\\text{PhysicsNode}("Node3", -2, -0.5)', color: '#3498db' },
            { text: 'PhysicsNode("Node4", 0, -1)', latex: '\\text{PhysicsNode}("Node4", 0, -1)', color: '#3498db' },
            { text: 'PhysicsNode("Node5", 2, -0.5)', latex: '\\text{PhysicsNode}("Node5", 2, -0.5)', color: '#3498db' },
            { text: 'PhysicsNode("Node6", 4, 0.5)', latex: '\\text{PhysicsNode}("Node6", 4, 0.5)', color: '#3498db' },
            { text: 'PhysicsNode("Node7", 6, 2)', latex: '\\text{PhysicsNode}("Node7", 6, 2)', color: '#3498db' },
            { text: 'PhysicsNode("AnchorRight", 8, 4, true)', latex: '\\text{PhysicsNode}("AnchorRight", 8, 4, \\text{true})', color: '#e74c3c' },
            { text: 'PhysicsLink("AnchorLeft", "Node1", 2.5)', latex: '\\text{PhysicsLink}("AnchorLeft", "Node1", 2.5)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node1", "Node2", 2.2)', latex: '\\text{PhysicsLink}("Node1", "Node2", 2.2)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node2", "Node3", 2.1)', latex: '\\text{PhysicsLink}("Node2", "Node3", 2.1)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node3", "Node4", 2.0)', latex: '\\text{PhysicsLink}("Node3", "Node4", 2.0)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node4", "Node5", 2.0)', latex: '\\text{PhysicsLink}("Node4", "Node5", 2.0)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node5", "Node6", 2.1)', latex: '\\text{PhysicsLink}("Node5", "Node6", 2.1)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node6", "Node7", 2.2)', latex: '\\text{PhysicsLink}("Node6", "Node7", 2.2)', color: '#f1c40f', lineWidth: 3 },
            { text: 'PhysicsLink("Node7", "AnchorRight", 2.5)', latex: '\\text{PhysicsLink}("Node7", "AnchorRight", 2.5)', color: '#f1c40f', lineWidth: 3 }
        ]
    }
];
