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
        description: 'A pendulum animation driven by parametric equations.',
        gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
        camera: { x: 0, y: 0, zoom: 150 },
        sliders: {
            a: { name: 'a', value: 2.01, min: 1, max: 5, step: 0.01, isPlaying: false, animSpeed: 1, animDir: 1 },
            b: { name: 'b', value: 3, min: 1, max: 5, step: 0.01, isPlaying: false, animSpeed: 1, animDir: 1 }
        },
        expressions: [
            { text: 'a = 2.01', latex: 'a = 2.01', color: '#f6d365' },
            { text: 'b = 3.0', latex: 'b = 3.0', color: '#f6d365' },
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
        id: 'golden-spiral',
        title: 'Golden Spiral',
        description: 'A logarithmic spiral simulating the golden ratio.',
        gradient: 'linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)',
        camera: { x: 0, y: 0, zoom: 50 },
        expressions: [
            { text: 'r = e^(0.3063489 * theta)', latex: 'r = e^{0.3063489 \\cdot \\theta}', color: '#2c3e50', lineWidth: 2 }
        ]
    },
    {
        id: 'lissajous-knot',
        title: 'Lissajous Knot',
        description: 'Complex 3D-like knot represented via 2D parametric paths.',
        gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
        camera: { x: 0, y: 0, zoom: 100 },
        expressions: [
            { text: '(sin(3*t + pi/4), cos(4*t))', latex: '(\\sin(3t + \\frac{\\pi}{4}), \\cos(4t))', color: '#8e44ad', lineWidth: 2 }
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
        id: 'synth-oscillator',
        title: 'Wavetable Synthesizer',
        description: 'Utilize Web Audio APIs to transform a continuous mathematical function directly into an auditory oscillator. Adjust variables to modulate timbre.',
        gradient: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
        camera: { x: 0, y: 0, zoom: 50 },
        expressions: [
            { text: 'y = sin(x*freq) + a*sin(3*x*freq) + b*sin(5*x*freq)', latex: 'y = \\sin(x \\cdot freq) + a \\cdot \\sin(3 \\cdot x \\cdot freq) + b \\cdot \\sin(5 \\cdot x \\cdot freq)', color: '#10b981', lineWidth: 2 }
        ],
        sliders: {
            'freq': { name: 'freq', value: 2, min: 0.1, max: 10, step: 0.1 },
            'a': { name: 'a', value: 0.5, min: 0, max: 1, step: 0.05 },
            'b': { name: 'b', value: 0.2, min: 0, max: 1, step: 0.05 }
        }
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
    }
];
